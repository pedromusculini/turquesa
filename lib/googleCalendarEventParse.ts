import type { ConsultationRecord } from '@/lib/consultations';
import type { ProfissionalOption } from '@/lib/loadMedicosOptions';

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

function medicoFromProfissionalId(
  profissionalId: string | undefined,
  profissionais: ProfissionalOption[],
): string | undefined {
  if (!profissionalId) return undefined;
  return profissionais.find((p) => p.id === profissionalId)?.nome;
}

/** Converte item da API Google Calendar para registro da agenda local. */
export function googleCalendarItemToConsultation(
  item: GoogleCalendarItem,
  profissionais: ProfissionalOption[] = [],
): ConsultationRecord {
  const patient =
    extractFromDescription(item.description, 'Cliente') ||
    item.attendees?.[0]?.email ||
    item.creator?.email ||
    'Cliente';

  const service =
    extractFromDescription(item.description, 'Serviço') ||
    item.summary ||
    'Evento de agenda';

  const medico =
    medicoFromProfissionalId(item._profissionalId, profissionais) ||
    extractFromDescription(item.description, 'Profissional');

  return {
    id: `google-${item.id}`,
    googleEventId: item.id,
    googleProfissionalId: item._profissionalId,
    title: item.summary || service,
    patient,
    service,
    medico,
    value: 0,
    location: item.location || undefined,
    start: item.start?.dateTime || item.start?.date || '',
    end: item.end?.dateTime || item.end?.date || '',
  };
}
