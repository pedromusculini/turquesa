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

/** Formato antigo (desktop linkifica; iOS Google Calendar ignora URL na descrição). */
const ANAMNESE_OLD_LINE_RE = /^📋 Anamnese: .+$/m;

/** Formato intermediário: URL na descrição (não clicável no iOS Google Calendar). */
const ANAMNESE_MOBILE_BLOCK_RE =
  /^📋 Anamnese da cliente\r?\n\r?\nhttps?:\/\/\S+$/m;

const ANAMNESE_LABEL = '📋 Anamnese da cliente';
const ANAMNESE_HINT = '📋 Anamnese da cliente — toque em Local';

const MAPS_IN_DESCRIPTION_RES: RegExp[] = [
  /^[🗺\uFFFD]?[^\n]*Como chegar:[^\n]*$/gim,
  /https?:\/\/(?:www\.)?google\.com\/maps[^\s]*/gi,
  /https?:\/\/maps\.google\.com[^\s]*/gi,
  /https?:\/\/[^\s/]+\/r\/m[^\s]*/gi,
];

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** URL curta ou ficha profissional (campo location clicável no iOS Google Calendar). */
export function isAnamneseLocationUrl(value: string | undefined | null): boolean {
  const u = (value ?? '').trim().toLowerCase();
  if (!isHttpUrl(u)) return false;
  if (u.includes('/f/') && u.includes('view=profissional')) return true;
  if (u.includes('/r/u')) return true;
  return false;
}

function isMapsLocationUrl(value: string | undefined | null): boolean {
  const u = (value ?? '').trim().toLowerCase();
  if (!u) return false;
  if (u.includes('google.com/maps') || u.includes('maps.google.com')) return true;
  if (isHttpUrl(u) && u.includes('/r/m')) return true;
  return false;
}

/** Location com endereço físico (gera pin duplicado no Google Calendar mobile). */
export function locationIsPhysicalAddress(value: string | undefined | null): boolean {
  const loc = (value ?? '').trim();
  if (!loc) return false;
  if (isAnamneseLocationUrl(loc)) return false;
  if (isMapsLocationUrl(loc)) return true;
  if (isHttpUrl(loc)) return false;
  return true;
}

/** Indica se a descrição ainda traz Maps/endereço (fluxo cliente ou legado). */
export function descriptionHasMapsOrAddress(description: string | undefined | null): boolean {
  const text = description ?? '';
  if (!text.trim()) return false;
  return MAPS_IN_DESCRIPTION_RES.some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

/** Indica se a descrição já tem o rótulo de anamnese (URL fica no campo location). */
export function descriptionHasAnamneseLink(description: string | undefined | null): boolean {
  const text = description ?? '';
  return (
    text.includes(ANAMNESE_HINT) ||
    ANAMNESE_MOBILE_BLOCK_RE.test(text) ||
    ANAMNESE_OLD_LINE_RE.test(text)
  );
}

/** Remove Maps/endereço da descrição da agenda profissional. */
export function stripMapsAndAddressFromProfessionalDescription(description: string): string {
  let out = description ?? '';
  for (const re of MAPS_IN_DESCRIPTION_RES) {
    re.lastIndex = 0;
    out = out.replace(re, '');
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Remove bloco/linha de anamnese anterior (formato antigo ou novo; evita duplicar em PATCH). */
export function stripAnamneseLineFromDescription(description: string): string {
  return stripMapsAndAddressFromProfessionalDescription(description)
    .replace(ANAMNESE_MOBILE_BLOCK_RE, '')
    .replace(ANAMNESE_OLD_LINE_RE, '')
    .replace(new RegExp(`^${ANAMNESE_HINT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), '')
    .replace(new RegExp(`^${ANAMNESE_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Evento profissional normalizado: sem Maps/endereço; anamnese no location quando aplicável. */
export function professionalGoogleEventNeedsPatch(params: {
  description?: string | null;
  location?: string | null;
  expectAnamnese?: boolean;
}): boolean {
  const desc = params.description ?? '';
  const loc = params.location ?? '';

  if (descriptionHasMapsOrAddress(desc)) return true;
  if (locationIsPhysicalAddress(loc) || isMapsLocationUrl(loc)) return true;
  if (ANAMNESE_MOBILE_BLOCK_RE.test(desc) || ANAMNESE_OLD_LINE_RE.test(desc)) return true;

  if (params.expectAnamnese) {
    if (!desc.includes(ANAMNESE_HINT)) return true;
    if (!isAnamneseLocationUrl(loc)) return true;
  } else if (loc.trim() && !isAnamneseLocationUrl(loc)) {
    return true;
  }

  return false;
}

function normalizeAnamneseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Acrescenta rótulo de anamnese na descrição (URL vai no campo location — clicável no iOS).
 */
export function appendAnamneseLinkToProfessionalDescription(
  description: string,
  _anamneseUrl?: string,
): string {
  const base = stripAnamneseLineFromDescription(description);
  return base ? `${base}\n\n${ANAMNESE_HINT}` : ANAMNESE_HINT;
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
 * Payload para agenda Google da profissional.
 * Anamnese no campo location (tappable no iOS Google Calendar); sem endereço/Maps.
 */
export function buildProfessionalGoogleEventPayload(body: {
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  timeZone?: string;
  anamneseUrl?: string;
}): GoogleCalendarEventPayload {
  const { summary, description, start, end, timeZone, anamneseUrl } = body;
  const tz = timeZone || 'America/Sao_Paulo';
  const location = normalizeAnamneseUrl(anamneseUrl || '');

  return {
    summary,
    description: description || '',
    start: { dateTime: start, timeZone: tz },
    end: { dateTime: end, timeZone: tz },
    location,
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
