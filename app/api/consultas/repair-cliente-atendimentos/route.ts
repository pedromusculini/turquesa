import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore, saveClientesStore } from '@/lib/clientesDrive';
import { repairClienteConsultaLinks } from '@/lib/clienteConsultaLinks';
import { resolveMergedPrimaryId } from '@/lib/clientesGoogleSync';
import { syncRealizadasAgendaToClienteDrive } from '@/lib/syncClienteAtendimentosFromAgenda';

export const runtime = 'nodejs';

/** Backfill: sessões realizadas na agenda → atendimentos na ficha Drive. */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  let clienteId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.clienteId && typeof body.clienteId === 'string') {
      clienteId = body.clienteId.trim() || undefined;
    }
  } catch {
    /* body opcional */
  }

  const store = await loadClientesStore(tokenResult, email);

  if (clienteId) {
    const resolvedId = resolveMergedPrimaryId(store, clienteId);
    const cliente = findCliente(store, resolvedId);
    if (cliente) {
      await repairClienteConsultaLinks(
        email,
        resolvedId,
        cliente,
        store,
        cliente.merged_from_cliente_ids ?? [],
      );
    }
  }

  const result = await syncRealizadasAgendaToClienteDrive(email, store, { clienteId });

  if (result.atendimentos_created > 0) {
    await saveClientesStore(tokenResult, store);
  }

  return NextResponse.json({ success: true, ...result });
}
