import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  findPacienteByTelefone,
  formatEnderecoPerfil,
  getOwnerBySlug,
  listSlots,
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
  const tipo = body.tipo as 'nova' | 'retorno';

  if (!telefone || !inicio || !fim) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }

  const dateStr = inicio.slice(0, 10);
  const slots = await listSlots({ ownerEmail: owner, medico, dateStr });
  const valid = slots.some((s) => s.inicio === inicio);
  if (!valid) {
    return NextResponse.json({ error: 'Horário indisponível' }, { status: 409 });
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

  const local = profile ? formatEnderecoPerfil(profile) : null;
  const clinica = profile?.clinic_name || profile?.full_name || slugRow.nome_exibicao;

  await upsertConsultasAgenda(owner, [
    {
      id: consultaId,
      paciente: pacienteNome!,
      servico: tipo === 'retorno' ? 'Retorno' : 'Consulta',
      telefone: normalizeBrazilPhone(telefone),
      inicio,
      fim,
      local,
      medico,
      convenio: body.convenio?.trim() || existente?.convenio || null,
      status: 'agendado',
      lembretes_whatsapp: true,
      cliente_drive_id: clienteDriveId ?? null,
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
      tipo,
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
  });

  return NextResponse.json({
    ok: true,
    consulta_id: consultaId,
    mensagem_confirmacao: mensagem,
    whatsapp_url: buildWhatsAppUrl(telefone, mensagem),
    link_agendamento: getAgendarPublicUrl(slug),
  });
}
