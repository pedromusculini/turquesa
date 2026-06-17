import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore } from '@/lib/clientesDrive';
import { resolveMergedPrimaryId } from '@/lib/clientesGoogleSync';
import { repairClienteConsultaLinks } from '@/lib/clienteConsultaLinks';
import { isMergeClientesEnabled } from '@/lib/clientesUnificar';

/** Repara vínculos consultas_agenda ↔ cliente após unificação ou cadastros duplicados. */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  if (!isMergeClientesEnabled(email)) {
    return NextResponse.json({ error: 'Recurso não disponível para esta conta.' }, { status: 403 });
  }

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const body = await req.json().catch(() => ({}));
  const clienteId = String(body.clienteId ?? body.cliente_drive_id ?? '').trim() || null;
  const repairAll = body.all === true || body.repairAll === true;

  const store = await loadClientesStore(tokenResult, email, { force: true });

  if (repairAll) {
    let total = 0;
    let clientes = 0;
    for (const cliente of store.clientes) {
      const n = await repairClienteConsultaLinks(
        email,
        cliente.id,
        cliente,
        store,
        cliente.merged_from_cliente_ids ?? [],
      );
      if (n > 0) {
        total += n;
        clientes += 1;
      }
    }
    return NextResponse.json({ success: true, consultasReparadas: total, clientesAfetados: clientes });
  }

  if (!clienteId) {
    return NextResponse.json(
      { error: 'Informe clienteId ou all: true para reparar todos os cadastros.' },
      { status: 400 },
    );
  }

  const resolvedId = resolveMergedPrimaryId(store, clienteId);
  const cliente = findCliente(store, resolvedId);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const consultasReparadas = await repairClienteConsultaLinks(
    email,
    cliente.id,
    cliente,
    store,
    cliente.merged_from_cliente_ids ?? [],
  );

  return NextResponse.json({
    success: true,
    clienteId: cliente.id,
    consultasReparadas,
  });
}
