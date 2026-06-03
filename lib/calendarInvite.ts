import { getAppBaseUrl } from '@/lib/mensagensWhatsapp';

export type CalendarEventInput = {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC compact format for Google Calendar URLs */
function toGoogleUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function formatIcsUtc(d: Date): string {
  return toGoogleUtc(d);
}

export function buildGoogleCalendarAddUrl(event: CalendarEventInput): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toGoogleUtc(event.start)}/${toGoogleUtc(event.end)}`,
  });
  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsContent(event: CalendarEventInput): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@medsupapp.com.br`;
  const desc = (event.description || '').replace(/\n/g, '\\n');
  const loc = (event.location || '').replace(/[,;\\]/g, ' ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MedSupAPP//PT-BR//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(event.start)}`,
    `DTEND:${formatIcsUtc(event.end)}`,
    `SUMMARY:${event.title.replace(/[,;\\]/g, ' ')}`,
    desc ? `DESCRIPTION:${desc}` : '',
    loc ? `LOCATION:${loc}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export function buildCalendarAddPageUrl(token: string): string {
  return `${getAppBaseUrl()}/calendario/adicionar/${token}`;
}

export function buildConsultaCalendarEvent(params: {
  paciente: string;
  medico?: string | null;
  servico?: string;
  local?: string | null;
  clinica?: string;
  inicio: string;
  fim?: string | null;
}): CalendarEventInput {
  const start = new Date(params.inicio);
  const end = params.fim
    ? new Date(params.fim)
    : new Date(start.getTime() + 40 * 60 * 1000);
  const medico = params.medico?.trim() || 'profissional';
  const title = `Consulta — ${medico}`;
  const description = [
    `Paciente: ${params.paciente}`,
    params.servico ? `Serviço: ${params.servico}` : '',
    params.clinica ? `Clínica: ${params.clinica}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    title,
    description,
    location: params.local || undefined,
    start,
    end,
  };
}
