import { agendaWindowTimeMin, agendaWindowTimeMax } from '@/lib/consultations';
import { repairConsultasAgendaForOwner } from '@/lib/consultasAgenda';
import { buildAgendaViewForOwner, type AgendaViewConsulta } from '@/lib/agendaViewServer';
import { pushPendingConsultasToGoogleCalendars } from '@/lib/pushConsultasToGoogleServer';
import { syncConsultasAgendaFromGoogleCalendars } from '@/lib/syncConsultasFromGoogleServer';

export type AgendaSyncFullResult = {
  googleImported: number;
  repaired: { deleted: number; migrated: number };
  googlePushed: number;
  googlePushSkipped: number;
  googlePushErrors: string[];
  consultas: AgendaViewConsulta[];
};

/**
 * Sync completo servidor (Fase 3): Google pull → dedupe/repair → push Turquesa → agenda-view.
 * Idempotente: pode ser chamado várias vezes sem duplicar google_event_id.
 */
export async function runAgendaSyncFull(ownerEmail: string): Promise<AgendaSyncFullResult> {
  const owner = ownerEmail.toLowerCase().trim();

  const googleResult = await syncConsultasAgendaFromGoogleCalendars(owner, {
    timeMin: agendaWindowTimeMin(),
    timeMax: agendaWindowTimeMax(),
    maxResults: '500',
    paginate: true,
  });

  const repaired = await repairConsultasAgendaForOwner(owner);

  const pushResult = await pushPendingConsultasToGoogleCalendars(owner);

  if (pushResult.pushed > 0) {
    await repairConsultasAgendaForOwner(owner);
  }

  const consultas = await buildAgendaViewForOwner(owner);

  return {
    googleImported: googleResult.upserted,
    repaired,
    googlePushed: pushResult.pushed,
    googlePushSkipped: pushResult.skipped,
    googlePushErrors: pushResult.errors,
    consultas,
  };
}
