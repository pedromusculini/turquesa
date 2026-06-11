import { isAnamneseLocationUrl } from '@/lib/calendarInvite';
import type { ConsultationRecord } from '@/lib/consultations';
import type { ProfissionalOption } from '@/lib/loadMedicosOptions';
import {
  normalizeLegacyKey,
  type LegacyServicoCatalog,
  resolveLegacyServico,
} from '@/lib/legacyProcedimentoCatalog';

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
  const patient =
    extractFromDescription(item.description, 'Cliente') ||
    item.attendees?.[0]?.email ||
    item.creator?.email ||
    'Cliente';

  const service = resolveGoogleEventService(item, patient, options?.legacyCatalog);

  const medico =
    medicoFromProfissionalId(item._profissionalId, profissionais) ||
    extractFromDescription(item.description, 'Profissional');

  const telefone = extractTelefoneFromDescription(item.description);
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
    lembretesWhatsapp: true,
    value: 0,
    location: isAnamneseLocationUrl(item.location) ? undefined : item.location || undefined,
    start: item.start?.dateTime || item.start?.date || '',
    end: item.end?.dateTime || item.end?.date || '',
  };
}
