import { supabaseAdmin } from '@/lib/supabaseClient';
import type { DisponibilidadeRow } from '@/lib/agendamento';
import {
  brMaxBookingDateString,
  fetchGoogleBusyPeriods,
  isDateWithinPublicBookingWindow,
  resolvePublicCalendarAuth,
  slotOverlapsBusy,
} from '@/lib/publicAgendamentoCalendar';

export type PublicSlot = { inicio: string; fim: string };

export type ListPublicSlotsResult =
  | { ok: true; slots: PublicSlot[]; duracaoMinutos: number }
  | { ok: false; code: 'invalid_date' | 'no_calendar' | 'out_of_range'; error: string };

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToIsoTime(dateStr: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dateStr}T${pad(h)}:${pad(m)}:00`;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function listPublicSlots(params: {
  ownerEmail: string;
  medico: string;
  dateStr: string;
}): Promise<ListPublicSlotsResult> {
  const medico = params.medico.trim();
  if (!medico) {
    return { ok: false, code: 'no_calendar', error: 'Selecione o profissional' };
  }

  const dateStr = params.dateStr.slice(0, 10);
  if (!isDateWithinPublicBookingWindow(dateStr)) {
    return {
      ok: false,
      code: 'out_of_range',
      error: `Agendamento disponível apenas até ${brMaxBookingDateString()}`,
    };
  }

  const auth = await resolvePublicCalendarAuth(params.ownerEmail, medico);
  if (!auth) {
    return {
      ok: false,
      code: 'no_calendar',
      error: 'Profissional sem agenda conectada. Entre em contato com o salão.',
    };
  }

  const owner = params.ownerEmail.toLowerCase().trim();
  const day = new Date(`${dateStr}T12:00:00`);
  const diaSemana = day.getDay();

  const { data: blocosRaw, error } = await supabaseAdmin
    .from('agenda_disponibilidade')
    .select('*')
    .eq('owner_email', owner)
    .eq('dia_semana', diaSemana)
    .eq('ativo', true);

  if (error) throw error;

  const blocos = (blocosRaw ?? []).filter(
    (b) => !b.medico_nome || b.medico_nome === medico,
  ) as DisponibilidadeRow[];

  if (blocos.length === 0) {
    return { ok: true, slots: [], duracaoMinutos: 40 };
  }

  const dayStart = new Date(`${dateStr}T00:00:00-03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const { data: consultas } = await supabaseAdmin
    .from('consultas_agenda')
    .select('inicio, fim, medico')
    .eq('owner_email', owner)
    .gte('inicio', dayStart.toISOString())
    .lt('inicio', dayEnd.toISOString())
    .eq('medico', medico)
    .in('status', ['agendado', 'confirmado']);

  const ocupadosDb = (consultas ?? []).map((c) => ({
    start: new Date(c.inicio),
    end: c.fim
      ? new Date(c.fim)
      : new Date(new Date(c.inicio).getTime() + 40 * 60 * 1000),
  }));

  const googleBusy = await fetchGoogleBusyPeriods(
    auth.accessToken,
    auth.calendarId,
    dayStart.toISOString(),
    dayEnd.toISOString(),
  );

  const slots: PublicSlot[] = [];
  const now = Date.now();
  let maxDur = 40;

  for (const bloco of blocos) {
    if (bloco.medico_nome && bloco.medico_nome !== medico) continue;
    const startMin = parseTimeToMinutes(bloco.hora_inicio.slice(0, 5));
    const endMin = parseTimeToMinutes(bloco.hora_fim.slice(0, 5));
    const dur = bloco.duracao_minutos || 40;
    maxDur = Math.max(maxDur, dur);

    for (let t = startMin; t + dur <= endMin; t += dur) {
      const inicioLocal = minutesToIsoTime(dateStr, t);
      const fimLocal = minutesToIsoTime(dateStr, t + dur);
      const start = new Date(`${inicioLocal}-03:00`);
      const end = new Date(`${fimLocal}-03:00`);
      if (start.getTime() < now) continue;

      const busyDb = ocupadosDb.some((o) => overlaps(start, end, o.start, o.end));
      if (busyDb) continue;

      if (slotOverlapsBusy(start, end, googleBusy)) continue;

      slots.push({ inicio: start.toISOString(), fim: end.toISOString() });
    }
  }

  slots.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return { ok: true, slots, duracaoMinutos: maxDur };
}
