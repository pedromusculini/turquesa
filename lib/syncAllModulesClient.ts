/**
 * Sincronização explícita entre dispositivos (mesmo login).
 * Supabase é fonte de verdade na sync manual; invalida caches locais.
 */
import { invalidateClientesListCache } from '@/lib/clientesListCache';
import { saveConsultations } from '@/lib/consultations';
import type { ConsultationRecord } from '@/lib/consultations';
import {
  flushLocalConsultasToServer,
  pullConsultasAuthoritativeFromServer,
  seedConsultasSyncSnapshot,
  dedupeConsultations,
} from '@/lib/syncConsultasClient';

export type SyncAllModulesResult = {
  consultas: number;
  agendamentosClientes?: number;
};

/** Sync completo: sobe rascunhos pendentes, puxa Supabase, invalida cache de clientes. */
export async function syncAllModules(ownerEmail: string): Promise<SyncAllModulesResult> {
  await flushLocalConsultasToServer(ownerEmail);

  const merged = await pullConsultasAuthoritativeFromServer(
    (await import('@/lib/consultations')).loadConsultations(ownerEmail),
  );
  const events = dedupeConsultations(merged);
  saveConsultations(events, { broadcast: false, ownerEmail });
  seedConsultasSyncSnapshot(events);

  invalidateClientesListCache(ownerEmail);

  let agendamentosClientes: number | undefined;
  try {
    const res = await fetch('/api/clientes/sync-agendamentos', {
      method: 'POST',
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { sincronizados?: number };
      agendamentosClientes = data.sincronizados;
    }
  } catch {
    /* opcional */
  }

  return {
    consultas: events.length,
    agendamentosClientes,
  };
}

export type ApplyConsultasToState = (events: ConsultationRecord[]) => void;

/** Aplica consultas authoritative + retorna contagem (para Agenda). */
export async function syncAgendaAuthoritative(
  ownerEmail: string,
): Promise<{ events: ConsultationRecord[]; meta: SyncAllModulesResult }> {
  const { loadConsultations } = await import('@/lib/consultations');
  await flushLocalConsultasToServer(ownerEmail);

  const merged = await pullConsultasAuthoritativeFromServer(loadConsultations(ownerEmail));
  const events = dedupeConsultations(merged);
  saveConsultations(events, { broadcast: false, ownerEmail });
  seedConsultasSyncSnapshot(events);
  invalidateClientesListCache(ownerEmail);

  let agendamentosClientes: number | undefined;
  try {
    const res = await fetch('/api/clientes/sync-agendamentos', {
      method: 'POST',
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { sincronizados?: number };
      agendamentosClientes = data.sincronizados;
    }
  } catch {
    /* opcional */
  }

  return {
    events,
    meta: { consultas: events.length, agendamentosClientes },
  };
}
