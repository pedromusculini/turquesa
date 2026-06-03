/**
 * Google People API — importação de contatos para clientes MedSupAPP.
 * @see https://developers.google.com/people/api/rest/v1/people.connections.list
 */

import { formatarTelefoneBr } from '@/lib/phoneMatch';

const PEOPLE_API = 'https://people.googleapis.com/v1';
const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,birthdays';
const PAGE_SIZE = 200;

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

type PersonConnection = {
  resourceName?: string;
  names?: { displayName?: string; givenName?: string; familyName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string; canonicalForm?: string }[];
  birthdays?: { date?: { year?: number; month?: number; day?: number } }[];
};

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
  const phoneRaw =
    person.phoneNumbers?.[0]?.canonicalForm ||
    person.phoneNumbers?.[0]?.value ||
    null;
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

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const raw =
        (err as { error?: { message?: string } })?.error?.message ||
        `Erro ao ler contatos Google (${res.status})`;
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
