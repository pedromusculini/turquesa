import { isAnamneseLocationUrl } from '@/lib/calendarInvite';
import type { ConsultationRecord } from '@/lib/consultations';
import type { ProfissionalOption } from '@/lib/loadMedicosOptions';
import {
  normalizeLegacyKey,
  type LegacyServicoCatalog,
  resolveLegacyServico,
} from '@/lib/legacyProcedimentoCatalog';
import { googleEventDescriptionHasTurquesaCliente } from '@/lib/googleCalendarTurquesaOwned';

type GoogleCalendarItem = {
  id: string;
  summary?: string;
  description?: string;
  attendees?: { email?: string }[];
  creator?: { email?: string };
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  _profissionalId?: string;
};

function looksLikeEmail(value: string | undefined): boolean {
  const v = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function extractFromDescription(
  description: string | undefined,
  label: string,
): string | undefined {
  if (!description) return undefined;
  const re = new RegExp(`^${label}:\\s*(.+)$`, 'im');
  const match = description.match(re);
  return match?.[1]?.trim() || undefined;
}

function extractTelefoneFromDescription(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const patterns = [
    /^tel(?:efone)?\s*:\s*(.+)$/im,
    /^whatsapp\s*:\s*(.+)$/im,
  ];
  for (const re of patterns) {
    const match = description.match(re);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return undefined;
}

function medicoFromProfissionalId(
  profissionalId: string | undefined,
  profissionais: ProfissionalOption[],
): string | undefined {
  if (!profissionalId) return undefined;
  return profissionais.find((p) => p.id === profissionalId)?.nome;
}

function resolveGoogleEventService(
  item: GoogleCalendarItem,
  patient: string,
  catalog?: LegacyServicoCatalog,
): string {
  const fromDescription = extractFromDescription(item.description, 'Serviço');
  if (fromDescription?.trim()) return fromDescription.trim();

  const summary = item.summary?.trim() || '';
  if (!summary) return 'Atendimento';

  if (catalog) {
    const resolved = resolveLegacyServico(summary, patient, catalog);
    if (resolved) return resolved;
    if (
      normalizeLegacyKey(summary) === normalizeLegacyKey(patient) ||
      catalog.clientBlocklist.has(normalizeLegacyKey(summary))
    ) {
      return 'Atendimento';
    }
    return 'Atendimento';
  }

  if (normalizeLegacyKey(summary) === normalizeLegacyKey(patient)) {
    return 'Atendimento';
  }

  return summary;
}

/** Converte item da API Google Calendar para registro da agenda local. */
export function googleCalendarItemToConsultation(
  item: GoogleCalendarItem,
  profissionais: ProfissionalOption[] = [],
  options?: { legacyCatalog?: LegacyServicoCatalog },
): ConsultationRecord {
  const fromClienteLine = extractFromDescription(item.description, 'Cliente');
  const isTurquesaOwned = googleEventDescriptionHasTurquesaCliente(item.description);

  // Bloqueio / evento pessoal: título do Google, nunca e-mail do criador.
  let patient: string;
  if (isTurquesaOwned && fromClienteLine) {
    patient = fromClienteLine;
  } else if (isTurquesaOwned) {
    const attendee = item.attendees?.[0]?.email;
    patient =
      (attendee && !looksLikeEmail(attendee) ? attendee : undefined) ||
      fromClienteLine ||
      'Cliente';
  } else {
    const summary = item.summary?.trim();
    patient =
      summary && !looksLikeEmail(summary) ? summary : 'Bloqueio Google';
  }

  const service = isTurquesaOwned
    ? resolveGoogleEventService(item, patient, options?.legacyCatalog)
    : 'Bloqueio';

  const medico =
    medicoFromProfissionalId(item._profissionalId, profissionais) ||
    extractFromDescription(item.description, 'Profissional');

  const telefone = isTurquesaOwned
    ? extractTelefoneFromDescription(item.description)
    : undefined;
  const medicoProfissionalId = item._profissionalId;

  return {
    id: `google-${item.id}`,
    googleEventId: item.id,
    googleProfissionalId: item._profissionalId,
    medicoProfissionalId,
    title: item.summary || service,
    patient,
    service,
    medico,
    telefone,
    lembretesWhatsapp: isTurquesaOwned,
    value: 0,
    location: isAnamneseLocationUrl(item.location) ? undefined : item.location || undefined,
    start: item.start?.dateTime || item.start?.date || '',
    end: item.end?.dateTime || item.end?.date || '',
  };
}

export function googleCalendarItemIsTurquesaOwned(
  item: Pick<GoogleCalendarItem, 'description'>,
): boolean {
  return googleEventDescriptionHasTurquesaCliente(item.description);
}
