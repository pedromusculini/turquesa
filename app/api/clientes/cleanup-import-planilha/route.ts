import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { clienteTemConsultaNaAgenda } from '@/lib/agendaClienteGuard';
import { loadClientesStore, saveClientesStore } from '@/lib/clientesDrive';
import { snapshotClientesStore } from '@/lib/clientesDriveBackup';
import {
  assertTestProfileCleanupOwner,
  isPlanilhaImportJunkCliente,
} from '@/lib/testProfileClientesCleanup';

/**
 * POST — remove cadastros lixo da importação planilha (somente marrissamartins@gmail.com).
 * ?dryRun=1 — apenas conta, não grava no Drive.
 */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    assertTestProfileCleanupOwner(email);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Não autorizado';
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  const store = await loadClientesStore(tokenResult, email, { force: true });

  const totalAntes = store.clientes.length;
  const candidatos = store.clientes.filter(isPlanilhaImportJunkCliente);
  const bloqueados: { id: string; nome: string; motivo: string }[] = [];
  const remover: typeof candidatos = [];

  for (const c of candidatos) {
    if (await clienteTemConsultaNaAgenda(email, c, store)) {
      bloqueados.push({
        id: c.id,
        nome: c.nome,
        motivo: 'Possui consulta na agenda — cadastro preservado',
      });
      continue;
    }
    remover.push(c);
  }

  const manter = store.clientes.filter(
    (c) => !remover.some((r) => r.id === c.id),
  );

  const amostra = remover.slice(0, 8).map((c) => ({
    id: c.id,
    nome: c.nome,
    observacoes_gerais: c.observacoes_gerais,
  }));

  let backupFile: string | null = null;
  if (!dryRun && remover.length > 0) {
    backupFile = await snapshotClientesStore(tokenResult, store, 'cleanup-import-planilha');
    store.clientes = manter;
    await saveClientesStore(tokenResult, store);
  }

  return NextResponse.json({
    dryRun,
    totalAntes,
    removidos: remover.length,
    bloqueados: bloqueados.length,
    bloqueados_amostra: bloqueados.slice(0, 8),
    mantidos: manter.length,
    amostra,
    backup_file: backupFile,
    gravado: !dryRun && remover.length > 0,
  });
}
