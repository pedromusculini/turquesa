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
  googlePullErrors: string[];
  consultas: AgendaViewConsulta[];
};

function logAgendaSyncFull(
  owner: string,
  payload: Omit<AgendaSyncFullResult, 'consultas'> & {
    consultasCount: number;
    durationMs: number;
  },
): void {
  console.info(
    '[agenda/sync-full]',
    JSON.stringify({
      owner_email: owner,
      duration_ms: payload.durationMs,
      google_imported: payload.googleImported,
      deduped_deleted: payload.repaired.deleted,
      deduped_migrated: payload.repaired.migrated,
      google_pushed: payload.googlePushed,
      google_push_skipped: payload.googlePushSkipped,
      google_push_errors: payload.googlePushErrors,
      google_pull_errors: payload.googlePullErrors,
      consultas_count: payload.consultasCount,
    }),
  );
}

/**
 * Sync completo servidor (Fase 3): Google pull → push Turquesa → dedupe/repair → agenda-view.
 * Idempotente: pode ser chamado várias vezes sem duplicar google_event_id.
 */
export async function runAgendaSyncFull(ownerEmail: string): Promise<AgendaSyncFullResult> {
  const started = Date.now();
  const owner = ownerEmail.toLowerCase().trim();

  const googleResult = await syncConsultasAgendaFromGoogleCalendars(owner, {
    timeMin: agendaWindowTimeMin(),
    timeMax: agendaWindowTimeMax(),
    maxResults: '500',
    paginate: true,
  });

  const pushResult = await pushPendingConsultasToGoogleCalendars(owner);

  const repaired = await repairConsultasAgendaForOwner(owner);

  const consultas = await buildAgendaViewForOwner(owner);

  const result: AgendaSyncFullResult = {
    googleImported: googleResult.upserted,
    repaired,
    googlePushed: pushResult.pushed,
    googlePushSkipped: pushResult.skipped,
    googlePushErrors: pushResult.errors,
    googlePullErrors: googleResult.errors,
    consultas,
  };

  logAgendaSyncFull(owner, {
    googleImported: result.googleImported,
    repaired: result.repaired,
    googlePushed: result.googlePushed,
    googlePushSkipped: result.googlePushSkipped,
    googlePushErrors: result.googlePushErrors,
    googlePullErrors: result.googlePullErrors,
    consultasCount: consultas.length,
    durationMs: Date.now() - started,
  });

  return result;
}
