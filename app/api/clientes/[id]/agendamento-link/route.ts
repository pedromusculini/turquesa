import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore } from '@/lib/clientesDrive';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSlugByOwner, getAgendarPublicUrl } from '@/lib/agendamento';
import {
  formatConsultaDataHora,
  renderMensagemForOwner,
} from '@/lib/mensagensWhatsapp';
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
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const slugRow = await getSlugByOwner(email);
  if (!slugRow?.ativo) {
    return NextResponse.json(
      { error: 'Configure o link de agendamento em Configurações antes.' },
      { status: 400 },
    );
  }

  const token = randomBytes(18).toString('hex');
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  await supabaseAdmin.from('paciente_agendamento_tokens').insert({
    token,
    owner_email: email.toLowerCase().trim(),
    cliente_drive_id: clienteId,
    expires_at: expiresAt.toISOString(),
  });

  const link = `${getAgendarPublicUrl(slugRow.slug)}?p=${token}`;
  const mensagem = await renderMensagemForOwner(email, 'convite_agendamento', {
    nome: cliente.nome,
    link,
  });

  return NextResponse.json({
    link,
    token,
    mensagem,
    whatsapp_url: cliente.telefone
      ? buildWhatsAppUrl(cliente.telefone, mensagem)
      : buildWhatsAppUrl(null, mensagem),
  });
}
