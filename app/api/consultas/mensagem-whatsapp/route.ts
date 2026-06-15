import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  formatConsultaDataHora,
  renderMensagemForOwner,
  type MensagemTipo,
} from '@/lib/mensagensWhatsapp';
import { buildWhatsAppUrls } from '@/lib/whatsapp';
import { isValidPhone, normalizePhoneForWhatsApp } from '@/lib/phoneMatch';
import { getConsultaCalendarLink } from '@/lib/calendarToken';
import { enderecoVarsFromProfile, loadOwnerProfile } from '@/lib/agendamento';
import { buildConsultaInicioBr } from '@/lib/registrarConsultaLembrete';
import { upsertConsultasAgenda } from '@/lib/consultasAgenda';

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
    const horaFimRaw = String(body.horaFim ?? body.hora_fim ?? '').trim();

    if (!nome || !dataRaw || !horaRaw) {
      return NextResponse.json(
        { error: 'Informe nome do cliente, data e horário' },
        { status: 400 },
      );
    }

    const telefone = normalizePhoneForWhatsApp(telefoneRaw);
    if (!telefoneRaw || !isValidPhone(telefoneRaw)) {
      return NextResponse.json(
        { error: 'Informe o WhatsApp do cliente (BR com DDD ou internacional com +)' },
        { status: 400 },
      );
    }

    const inicio = buildConsultaInicioBr(dataRaw, horaRaw);
    const { data, hora } = formatConsultaDataHora(inicio);
    const fimIso = horaFimRaw
      ? buildConsultaInicioBr(dataRaw, horaFimRaw)
      : new Date(new Date(inicio).getTime() + 40 * 60 * 1000).toISOString();

    const profile = await loadOwnerProfile(email);
    const clinica =
      String(profile?.clinic_name ?? profile?.full_name ?? '').trim() || 'seu salão';
    const { local: localPerfil, link_maps } = enderecoVarsFromProfile(profile);

    let link_calendario = '';
    if (consultaId) {
      const consultaPayload = {
        id: consultaId,
        paciente: nome,
        servico: String(body.servico ?? body.service ?? 'Atendimento').trim() || 'Atendimento',
        telefone,
        inicio,
        fim: fimIso,
        local: localInput || localPerfil || null,
        medico: medico || null,
        status: 'agendado' as const,
        lembretes_whatsapp: body.lembretesWhatsapp !== false,
        cliente_drive_id: body.clienteDriveId
          ? String(body.clienteDriveId)
          : body.cliente_drive_id
            ? String(body.cliente_drive_id)
            : null,
      };

      try {
        await upsertConsultasAgenda(email, [consultaPayload]);
      } catch (err) {
        console.warn('[consultas/mensagem-whatsapp] upsert consulta:', err);
      }

      try {
        link_calendario = await getConsultaCalendarLink({
          consultaId,
          ownerEmail: email,
        });
      } catch (err) {
        console.warn('[consultas/mensagem-whatsapp] link calendário:', err);
      }
    }

    if (tipo === 'confirmacao_apos_agendar' && !link_calendario.trim()) {
      return NextResponse.json(
        {
          error:
            'Não foi possível gerar o link para o cliente adicionar à agenda. Aguarde a sincronização e tente novamente.',
        },
        { status: 503 },
      );
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

    const {
      web: whatsapp_url,
      app: whatsapp_app_url,
      android: whatsapp_android_url,
    } = buildWhatsAppUrls(telefone, mensagem);

    return NextResponse.json({
      mensagem,
      whatsapp_url,
      whatsapp_app_url,
      whatsapp_android_url,
    });
  } catch (error) {
    console.error('[consultas/mensagem-whatsapp]', error);
    return NextResponse.json({ error: 'Erro ao montar mensagem' }, { status: 500 });
  }
}
