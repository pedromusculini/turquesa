import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  formatConsultaDataHora,
  renderMensagemForOwner,
  type MensagemTipo,
} from '@/lib/mensagensWhatsapp';
import { buildWhatsAppUrl, normalizeBrazilPhone } from '@/lib/whatsapp';
import { getConsultaCalendarLink } from '@/lib/calendarToken';
import { enderecoVarsFromProfile, loadOwnerProfile } from '@/lib/agendamento';
import { buildConsultaInicioBr } from '@/lib/registrarConsultaLembrete';

const TIPOS_PERMITIDOS: MensagemTipo[] = [
  'confirmacao_apos_agendar',
  'lembrete_1_dia',
];

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const tipo = body.tipo as MensagemTipo;
    if (!TIPOS_PERMITIDOS.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de mensagem inválido' }, { status: 400 });
    }

    const nome = String(body.nome ?? body.paciente ?? '').trim();
    const dataRaw = String(body.data ?? '').trim();
    const horaRaw = String(body.hora ?? '').trim();
    const telefoneRaw = String(body.telefone ?? '').trim();
    const medico = String(body.medico ?? '').trim();
    const localInput = String(body.local ?? '').trim();
    const consultaId = body.consultaId ? String(body.consultaId) : null;

    if (!nome || !dataRaw || !horaRaw) {
      return NextResponse.json(
        { error: 'Informe nome do cliente, data e horário' },
        { status: 400 },
      );
    }

    const telefone = normalizeBrazilPhone(telefoneRaw);
    if (!telefone || telefone.length < 12) {
      return NextResponse.json(
        { error: 'Informe o WhatsApp do cliente com DDD' },
        { status: 400 },
      );
    }

    const inicio = buildConsultaInicioBr(dataRaw, horaRaw);
    const { data, hora } = formatConsultaDataHora(inicio);

    const profile = await loadOwnerProfile(email);
    const clinica =
      String(profile?.clinic_name ?? profile?.full_name ?? '').trim() || 'seu salão';
    const { local: localPerfil, link_maps } = enderecoVarsFromProfile(profile);

    let link_calendario = '';
    if (consultaId) {
      try {
        link_calendario = await getConsultaCalendarLink({
          consultaId,
          ownerEmail: email,
        });
      } catch {
        /* token opcional */
      }
    }

    const mensagem = await renderMensagemForOwner(email, tipo, {
      nome,
      data,
      hora,
      medico,
      local: localInput || localPerfil,
      clinica,
      link_calendario,
      link_maps,
    });

    return NextResponse.json({
      mensagem,
      whatsapp_url: buildWhatsAppUrl(telefone, mensagem),
    });
  } catch (error) {
    console.error('[consultas/mensagem-whatsapp]', error);
    return NextResponse.json({ error: 'Erro ao montar mensagem' }, { status: 500 });
  }
}
