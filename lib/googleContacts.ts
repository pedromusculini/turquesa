/**
 * Google People API — importação de contatos para clientes Turquesa Agenda.
 * @see https://developers.google.com/people/api/rest/v1/people.connections.list
 */

import { formatarTelefoneBr } from '@/lib/phoneMatch';

const PEOPLE_API = 'https://people.googleapis.com/v1';
/** Um único endpoint (connections.list) — evita chamadas extras a other/directory. */
const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,birthdays';
const PAGE_SIZE = 200;
const MAX_429_RETRIES = 4;

export function isGoogleContactsQuotaError(status: number, message: string): boolean {
  if (status === 429) return true;
  const lower = message.toLowerCase();
  return (
    lower.includes('quota exceeded') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted')
  );
}

async function peopleApiFetch(url: string, accessToken: string): Promise<Response> {
  for (let attempt = 0; attempt < MAX_429_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status !== 429) return res;
    if (attempt === MAX_429_RETRIES - 1) return res;

    const retryAfter = res.headers.get('Retry-After');
    const waitSec = retryAfter ? Number.parseInt(retryAfter, 10) : 0;
    const waitMs =
      Number.isFinite(waitSec) && waitSec > 0
        ? waitSec * 1000
        : Math.min(1000 * 2 ** attempt, 8000);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw new Error('Erro inesperado ao consultar People API');
}

/** Mensagem amigável quando a People API não está habilitada no projeto Google Cloud. */
export function formatPeopleApiError(rawMessage: string, status?: number): string {
  const lower = rawMessage.toLowerCase();
  const needsEnable =
    lower.includes('has not been used') ||
    lower.includes('it is disabled') ||
    lower.includes('people api') ||
    status === 403;

  if (!needsEnable) return rawMessage;

  const projectMatch = rawMessage.match(/project\s+(\d+)/i);
  const enableUrl = projectMatch?.[1]
    ? `https://console.developers.google.com/apis/api/people.googleapis.com/overview?project=${projectMatch[1]}`
    : 'https://console.cloud.google.com/apis/library/people.googleapis.com';

  return (
    `Ative a People API no Google Cloud (botão "Ativar" ou "Enable"), aguarde 2–5 minutos e tente de novo: ${enableUrl}`
  );
}

export type GoogleContactImport = {
  nome: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  googleResourceName: string;
};

type PersonPhone = {
  value?: string;
  canonicalForm?: string;
  type?: string;
  metadata?: { primary?: boolean };
};

type PersonConnection = {
  resourceName?: string;
  names?: { displayName?: string; givenName?: string; familyName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: PersonPhone[];
  birthdays?: { date?: { year?: number; month?: number; day?: number } }[];
};

/** Prioridade ao escolher WhatsApp entre vários números do contato Google. */
const PHONE_TYPE_PRIORITY = [
  'mobile',
  'cell',
  'iphone',
  'main',
  'work',
  'home',
  'google voice',
  'other',
];

function pickBestGooglePhone(phones: PersonPhone[] | undefined): string | null {
  if (!phones?.length) return null;

  const raw = (p: PersonPhone) => p.canonicalForm?.trim() || p.value?.trim() || null;

  const primary = phones.find((p) => p.metadata?.primary);
  const primaryRaw = primary ? raw(primary) : null;
  if (primaryRaw) return primaryRaw;

  for (const type of PHONE_TYPE_PRIORITY) {
    const found = phones.find((p) => p.type?.toLowerCase() === type);
    const picked = found ? raw(found) : null;
    if (picked) return picked;
  }

  return raw(phones[0]);
}

function formatBirthday(
  date?: { year?: number; month?: number; day?: number },
): string | null {
  if (!date?.month || !date?.day) return null;
  const y = date.year && date.year > 1900 ? date.year : 1900;
  const m = String(date.month).padStart(2, '0');
  const d = String(date.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizePhone(raw: string): string {
  const formatted = formatarTelefoneBr(raw);
  return formatted || raw.trim();
}

function mapPersonToContact(person: PersonConnection): GoogleContactImport | null {
  const resourceName = person.resourceName ?? '';
  const nameObj = person.names?.[0];
  const nome =
    nameObj?.displayName?.trim() ||
    [nameObj?.givenName, nameObj?.familyName].filter(Boolean).join(' ').trim();
  if (!nome) return null;

  const email =
    person.emailAddresses?.find((e) => e.value?.includes('@'))?.value?.trim() ?? null;
  const phoneRaw = pickBestGooglePhone(person.phoneNumbers);
  const telefone = phoneRaw ? normalizePhone(phoneRaw) : null;

  if (!email && !telefone) return null;

  return {
    nome,
    email: email ? email.toLowerCase() : null,
    telefone,
    data_nascimento: formatBirthday(person.birthdays?.[0]?.date),
    googleResourceName: resourceName,
  };
}

export async function fetchGoogleContacts(
  accessToken: string,
): Promise<GoogleContactImport[]> {
  const out: GoogleContactImport[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${PEOPLE_API}/people/me/connections`);
    url.searchParams.set('personFields', PERSON_FIELDS);
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    url.searchParams.set('sortOrder', 'LAST_MODIFIED_ASCENDING');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await peopleApiFetch(url.toString(), accessToken);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const raw =
        (err as { error?: { message?: string } })?.error?.message ||
        `Erro ao ler contatos Google (${res.status})`;
      if (isGoogleContactsQuotaError(res.status, raw)) {
        throw new Error(
          'Contatos Google temporariamente indisponíveis — tente em 1 minuto',
        );
      }
      throw new Error(formatPeopleApiError(raw, res.status));
    }

    const data = (await res.json()) as {
      connections?: PersonConnection[];
      nextPageToken?: string;
    };

    for (const person of data.connections ?? []) {
      const mapped = mapPersonToContact(person);
      if (mapped) out.push(mapped);
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}
