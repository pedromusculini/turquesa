import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireFinanceiroUnlocked } from '@/lib/financeiroPin';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  FATURAMENTO_FILE,
  loadFaturamentoStore,
  saveFaturamentoStore,
  type FaturamentoDriveStore,
} from '@/lib/clientesDrive';
import {
  FATURAMENTO_BACKUP_PREFIX,
  snapshotFaturamentoStore,
  stripFaturamentoBackupMetadata,
} from '@/lib/faturamentoDriveBackup';
import { baixarArquivoDoDrive, listarArquivosMedSupApp } from '@/lib/googleDrive';

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const pinGuard = await requireFinanceiroUnlocked(email, req);
  if (pinGuard) return pinGuard;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();
  const fileId = String(body.fileId ?? '').trim();
  if (!fileId) {
    return NextResponse.json({ error: 'Informe fileId do backup.' }, { status: 400 });
  }

  const current = await loadFaturamentoStore(tokenResult, email);

  let raw: string;
  try {
    raw = await baixarArquivoDoDrive(tokenResult, fileId);
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o arquivo de backup.' }, { status: 404 });
  }

  let parsed: FaturamentoDriveStore & { _backup?: unknown };
  try {
    parsed = JSON.parse(raw) as FaturamentoDriveStore & { _backup?: unknown };
  } catch {
    return NextResponse.json({ error: 'Arquivo de backup inválido (JSON corrompido).' }, { status: 400 });
  }

  if (!parsed.transacoes || !Array.isArray(parsed.transacoes)) {
    return NextResponse.json({ error: 'Backup não contém transações.' }, { status: 400 });
  }

  const restored = stripFaturamentoBackupMetadata(parsed);
  restored.owner_email = email;
  restored.atualizado_em = new Date().toISOString();

  const preRestoreBackup = await snapshotFaturamentoStore(
    tokenResult,
    current,
    'pre-restore',
  );

  await saveFaturamentoStore(tokenResult, restored, { skipAutoBackup: true });

  return NextResponse.json({
    success: true,
    transacoes: restored.transacoes.length,
    pre_restore_backup: preRestoreBackup,
    active_file: FATURAMENTO_FILE,
    note: 'Espelho Drive restaurado. O financeiro operacional continua no Supabase; use reconciliação se necessário.',
  });
}

export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;

  const pinGuard = await requireFinanceiroUnlocked(authResult.email, req);
  if (pinGuard) return pinGuard;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const files = await listarArquivosMedSupApp(tokenResult, {
    namePrefix: FATURAMENTO_BACKUP_PREFIX,
    mimeTypes: ['application/json', 'application/json;charset=utf-8'],
  });

  const auto = files.filter((f) => f.name.includes('_auto.json'));
  const latest = auto[0] ?? files[0] ?? null;

  return NextResponse.json({
    automatic_enabled: true,
    interval_hours: 6,
    max_auto_files: 48,
    latest,
    total_backups: files.length,
    active_file: FATURAMENTO_FILE,
  });
}
