import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  CLIENTES_FILE,
  loadClientesStore,
  saveClientesStore,
  type ClientesDriveStore,
} from '@/lib/clientesDrive';
import {
  CLIENTES_BACKUP_PREFIX,
  snapshotClientesStore,
  stripBackupMetadata,
} from '@/lib/clientesDriveBackup';
import { baixarArquivoDoDrive, listarArquivosMedSupApp } from '@/lib/googleDrive';

/**
 * POST — restaura clientes.json a partir de um snapshot no Drive.
 * Body: { fileId: string }
 */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json();
  const fileId = String(body.fileId ?? '').trim();
  if (!fileId) {
    return NextResponse.json({ error: 'Informe fileId do backup.' }, { status: 400 });
  }

  const current = await loadClientesStore(tokenResult, email, { force: true });

  let raw: string;
  try {
    raw = await baixarArquivoDoDrive(tokenResult, fileId);
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o arquivo de backup.' }, { status: 404 });
  }

  let parsed: ClientesDriveStore & { _backup?: unknown };
  try {
    parsed = JSON.parse(raw) as ClientesDriveStore & { _backup?: unknown };
  } catch {
    return NextResponse.json({ error: 'Arquivo de backup inválido (JSON corrompido).' }, { status: 400 });
  }

  if (!parsed.clientes || !Array.isArray(parsed.clientes)) {
    return NextResponse.json({ error: 'Backup não contém lista de clientes.' }, { status: 400 });
  }

  const restored = stripBackupMetadata(parsed);
  restored.owner_email = email;
  restored.atualizado_em = new Date().toISOString();

  const preRestoreBackup = await snapshotClientesStore(
    tokenResult,
    current,
    'pre-restore',
  );

  await saveClientesStore(tokenResult, restored, { skipAutoBackup: true });

  return NextResponse.json({
    success: true,
    clientes: restored.clientes.length,
    pre_restore_backup: preRestoreBackup,
    active_file: CLIENTES_FILE,
  });
}

/** GET — metadados do backup automático (último snapshot). */
export async function GET(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const files = await listarArquivosMedSupApp(tokenResult, {
    namePrefix: CLIENTES_BACKUP_PREFIX,
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
    active_file: CLIENTES_FILE,
  });
}
