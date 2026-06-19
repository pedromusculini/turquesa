import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { loadClientesStore, saveClientesStore } from '@/lib/clientesDrive';
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
  const remover = store.clientes.filter(isPlanilhaImportJunkCliente);
  const manter = store.clientes.filter((c) => !isPlanilhaImportJunkCliente(c));

  const amostra = remover.slice(0, 8).map((c) => ({
    id: c.id,
    nome: c.nome,
    observacoes_gerais: c.observacoes_gerais,
  }));

  if (!dryRun && remover.length > 0) {
    store.clientes = manter;
    await saveClientesStore(tokenResult, store);
  }

  return NextResponse.json({
    dryRun,
    totalAntes,
    removidos: remover.length,
    mantidos: manter.length,
    amostra,
    gravado: !dryRun && remover.length > 0,
  });
}
