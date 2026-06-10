import { getAppBaseUrl } from '@/lib/mensagensWhatsapp';

export type CalendarEventInput = {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
};

export type GoogleCalendarEventPayload = {
  summary?: string;
  description?: string;
  start: { dateTime?: string; timeZone: string };
  end: { dateTime?: string; timeZone: string };
  location?: string;
  reminders: {
    useDefault: boolean;
    overrides: { method: 'popup'; minutes: number }[];
  };
};

const ANAMNESE_LINE_RE = /^📋 Anamnese: .+$/m;

/** Remove linha de anamnese anterior (evita duplicar em PATCH). */
export function stripAnamneseLineFromDescription(description: string): string {
  return description.replace(ANAMNESE_LINE_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Acrescenta link da ficha/anamnese do cliente na descrição da agenda profissional. */
export function appendAnamneseLinkToProfessionalDescription(
  description: string,
  anamneseUrl: string,
): string {
  const url = anamneseUrl.trim();
  if (!url) return description;
  const base = stripAnamneseLineFromDescription(description);
  const line = `📋 Anamnese: ${url}`;
  return base ? `${base}\n\n${line}` : line;
}

/** Sem lembretes no Google: avisos d7/d1 ficam só no Dashboard/WhatsApp (mensagens_whatsapp_config). */
const PROFESSIONAL_GOOGLE_REMINDERS: GoogleCalendarEventPayload['reminders'] = {
  useDefault: false,
  overrides: [],
};

/** URL de busca no Google Maps a partir de endereço em texto. */
export function googleMapsSearchUrl(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return '';
  return `https://www.google.com/maps/search/${encodeURIComponent(trimmed)}`;
}

/**
 * Payload para agenda Google da profissional: endereço em texto no campo location,
 * sem link do Maps na descrição (calendário mais limpo).
 */
export function buildProfessionalGoogleEventPayload(body: {
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  location?: string;
  timeZone?: string;
}): GoogleCalendarEventPayload {
  const { summary, description, start, end, location, timeZone } = body;
  const tz = timeZone || 'America/Sao_Paulo';
  const address = location?.trim();

  return {
    summary,
    description: description || '',
    start: { dateTime: start, timeZone: tz },
    end: { dateTime: end, timeZone: tz },
    ...(address && { location: address }),
    reminders: PROFESSIONAL_GOOGLE_REMINDERS,
  };
}

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
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@turquesaagenda.com.br`;
  const desc = (event.description || '').replace(/\n/g, '\\n');
  const loc = (event.location || '').replace(/[,;\\]/g, ' ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Turquesa Agenda//PT-BR//EN',
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

export function buildConsultaCalendarEvent(
  params: {
    paciente: string;
    medico?: string | null;
    servico?: string;
    local?: string | null;
    clinica?: string;
    inicio: string;
    fim?: string | null;
  },
  options?: { clientFacing?: boolean },
): CalendarEventInput {
  const start = new Date(params.inicio);
  const end = params.fim
    ? new Date(params.fim)
    : new Date(start.getTime() + 40 * 60 * 1000);
  const medico = params.medico?.trim() || 'profissional';
  const title = `Atendimento — ${medico}`;
  const address = params.local?.trim() || '';
  let description = [
    `Cliente: ${params.paciente}`,
    params.servico ? `Serviço: ${params.servico}` : '',
    params.clinica ? `Salão: ${params.clinica}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (options?.clientFacing && address) {
    const mapsUrl = googleMapsSearchUrl(address);
    description = `${description}\n\n🗺️ Como chegar: ${mapsUrl}`.trim();
  }

  return {
    title,
    description,
    location: address || undefined,
    start,
    end,
  };
}
