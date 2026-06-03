import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore } from '@/lib/clientesDrive';
import { criarFormularioLink, supabaseSchemaErrorResponse } from '@/lib/formularioLinks';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: clienteId } = await params;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, clienteId);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado no Drive' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const result = await criarFormularioLink({
      ownerEmail: email,
      tipo: 'cliente',
      clienteDriveId: clienteId,
      titulo: body.titulo,
      nomeClinica: body.nomeClinica,
      nomePaciente: cliente.nome,
      mensagemWhatsapp: body.mensagem_whatsapp,
      expiresAt: body.expires_at ?? null,
      telefoneDestino: cliente.telefone,
    });

    return NextResponse.json({
      ...result,
      tipo: 'cliente',
      whatsapp_url: cliente.telefone
        ? result.whatsapp_url
        : buildWhatsAppUrl(null, result.mensagem_whatsapp),
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('[formulario-link]', err);
    const mapped = supabaseSchemaErrorResponse(err);
    return NextResponse.json(
      { error: mapped.error, code: mapped.code },
      { status: mapped.status },
    );
  }
}
