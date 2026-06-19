import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  findPacienteByTelefone,
  enderecoVarsFromProfile,
  getOwnerBySlug,
  upsertPacienteIndex,
} from '@/lib/agendamento';
import { upsertConsultasAgenda } from '@/lib/consultasAgenda';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { normalizeBrazilPhone } from '@/lib/whatsapp';
import {
  formatConsultaDataHora,
  renderMensagemForOwner,
} from '@/lib/mensagensWhatsapp';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { getConsultaCalendarLink } from '@/lib/calendarToken';
import { getAgendarPublicUrl } from '@/lib/agendamento';
import { validateMedicoPublico } from '@/lib/medicosPublicos';
import { loadMedicosPublicos } from '@/lib/medicosPublicos';
import {
  brMaxBookingDateString,
  createPublicBookingCalendarEvent,
  isDateWithinPublicBookingWindow,
  isSlotFreeOnGoogleCalendar,
  resolvePublicCalendarAuth,
} from '@/lib/publicAgendamentoCalendar';
import { listPublicSlots } from '@/lib/publicAgendamentoSlots';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const slug = body.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 });
  }

  const rl = checkRateLimit(`agendar-confirm:${slug}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 });
  }

  if (!body.dataConsent) {
    return NextResponse.json({ error: 'Aceite o aviso de privacidade' }, { status: 400 });
  }

  const slugRow = await getOwnerBySlug(slug);
  if (!slugRow) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 });
  }

  const owner = slugRow.owner_email;
  const telefone = body.telefone?.trim();
  const medico = body.medico?.trim() || null;
  const inicio = body.inicio as string;
  const fim = body.fim as string;
  const nome = body.nome?.trim();

  if (!telefone || !inicio || !fim) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }

  if (!medico) {
    return NextResponse.json({ error: 'Profissional obrigatório' }, { status: 400 });
  }

  const { medicos, isClinica } = await loadMedicosPublicos(owner);
  const medicoErr = validateMedicoPublico({ medicos, isClinica }, medico, {
    requireAgenda: true,
  });
  if (medicoErr) {
    return NextResponse.json({ error: medicoErr }, { status: 400 });
  }

  const dateStr = inicio.slice(0, 10);
  if (!isDateWithinPublicBookingWindow(dateStr)) {
    return NextResponse.json(
      {
        error: `Agendamento disponível apenas até ${brMaxBookingDateString()}`,
        maxDate: brMaxBookingDateString(),
      },
      { status: 400 },
    );
  }

  const calendarAuth = await resolvePublicCalendarAuth(owner, medico);
  if (!calendarAuth) {
    return NextResponse.json(
      { error: 'Profissional sem agenda conectada' },
      { status: 403 },
    );
  }

  const slotResult = await listPublicSlots({ ownerEmail: owner, medico, dateStr });
  if (!slotResult.ok) {
    return NextResponse.json({ error: slotResult.error }, { status: 409 });
  }

  const valid = slotResult.slots.some((s) => s.inicio === inicio);
  if (!valid) {
    return NextResponse.json({ error: 'Horário indisponível' }, { status: 409 });
  }

  const stillFree = await isSlotFreeOnGoogleCalendar({
    auth: calendarAuth,
    inicio,
    fim,
  });
  if (!stillFree) {
    return NextResponse.json(
      { error: 'Horário acabou de ser reservado. Escolha outro.' },
      { status: 409 },
    );
  }

  let pacienteNome = nome;
  let clienteDriveId = body.cliente_drive_id as string | undefined;

  const existente = await findPacienteByTelefone(owner, telefone);
  if (existente) {
    pacienteNome = existente.nome;
    clienteDriveId = existente.cliente_drive_id || clienteDriveId;
  } else if (!pacienteNome || pacienteNome.length < 2) {
    return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
  }

  const consultaId = `pub-${randomBytes(8).toString('hex')}`;

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('*')
    .eq('email', owner)
    .maybeSingle();

  const { local, link_maps } = enderecoVarsFromProfile(profile);
  const clinica = profile?.clinic_name || profile?.full_name || slugRow.nome_exibicao;

  let googleEventId: string | null = null;
  try {
    googleEventId = await createPublicBookingCalendarEvent({
      auth: calendarAuth,
      ownerEmail: owner,
      summary: `${pacienteNome!} — Atendimento`,
      description: `Agendamento online\nCliente: ${pacienteNome}\nTel: ${normalizeBrazilPhone(telefone)}`,
      start: inicio,
      end: fim,
      location: local || undefined,
      clienteDriveId: clienteDriveId ?? null,
      nomeCliente: pacienteNome ?? null,
    });
  } catch (calErr) {
    console.error('[agendar/confirmar] Google Calendar:', calErr);
    return NextResponse.json(
      { error: 'Não foi possível reservar na agenda. Tente outro horário.' },
      { status: 502 },
    );
  }

  await upsertConsultasAgenda(owner, [
    {
      id: consultaId,
      paciente: pacienteNome!,
      servico: 'Atendimento',
      telefone: normalizeBrazilPhone(telefone),
      inicio,
      fim,
      local: local || null,
      medico,
      convenio: body.convenio?.trim() || existente?.convenio || null,
      status: 'confirmado',
      lembretes_whatsapp: true,
      cliente_drive_id: clienteDriveId ?? null,
      google_event_id: googleEventId,
    },
  ]);

  await upsertPacienteIndex({
    ownerEmail: owner,
    telefone,
    nome: pacienteNome!,
    clienteDriveId: clienteDriveId ?? null,
    cpf: body.cpf,
    convenio: body.convenio || existente?.convenio,
  });

  await supabaseAdmin.from('agendamentos_pendentes_drive').insert({
    owner_email: owner,
    consulta_id: consultaId,
    cliente_drive_id: clienteDriveId ?? null,
    dados: {
      nome: pacienteNome,
      telefone: normalizeBrazilPhone(telefone),
      email: body.email || null,
      cpf: body.cpf || null,
      convenio: body.convenio || null,
      medico,
      tipo: 'nova',
    },
    sincronizado: false,
  });

  const { data, hora } = formatConsultaDataHora(inicio);
  const linkCal = await getConsultaCalendarLink({ consultaId, ownerEmail: owner });
  const mensagem = await renderMensagemForOwner(owner, 'confirmacao_apos_agendar', {
    nome: pacienteNome!,
    data,
    hora,
    medico: medico || '',
    local: local || '',
    clinica,
    link_calendario: linkCal,
    link_maps,
  });

  return NextResponse.json({
    ok: true,
    consulta_id: consultaId,
    mensagem_confirmacao: mensagem,
    whatsapp_url: buildWhatsAppUrl(telefone, mensagem),
    link_agendamento: getAgendarPublicUrl(slug),
  });
}
