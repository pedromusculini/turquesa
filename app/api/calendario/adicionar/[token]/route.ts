import { NextRequest, NextResponse } from 'next/server';
import { resolveCalendarToken } from '@/lib/calendarToken';
import { getConsultaAgendaById } from '@/lib/consultasAgenda';
import {
  buildConsultaCalendarEvent,
  buildGoogleCalendarAddUrl,
  buildIcsContent,
} from '@/lib/calendarInvite';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { formatEnderecoPerfil } from '@/lib/agendamento';

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const resolved = await resolveCalendarToken(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Link expirado ou inválido' }, { status: 404 });
  }

  const consulta = await getConsultaAgendaById(resolved.consulta_id);
  if (!consulta || consulta.owner_email !== resolved.owner_email) {
    return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
  }

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('*')
    .eq('email', consulta.owner_email)
    .maybeSingle();

  const clinica = profile?.clinic_name || profile?.full_name || 'Consulta';
  const local =
    consulta.local || (profile ? formatEnderecoPerfil(profile) : '');

  const event = buildConsultaCalendarEvent({
    paciente: consulta.paciente,
    medico: consulta.medico,
    servico: consulta.servico,
    local,
    clinica,
    inicio: consulta.inicio,
    fim: consulta.fim,
  });

  if (req.nextUrl.searchParams.get('format') === 'ics') {
    return new NextResponse(buildIcsContent(event), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="consulta.ics"',
      },
    });
  }

  const start = new Date(consulta.inicio);
  return NextResponse.json({
    paciente: consulta.paciente,
    medico: consulta.medico,
    servico: consulta.servico,
    local,
    clinica,
    inicio: consulta.inicio,
    fim: consulta.fim,
    data: start.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    hora: start.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }),
    google_url: buildGoogleCalendarAddUrl(event),
    ics_url: `/api/calendario/adicionar/${token}?format=ics`,
  });
}
