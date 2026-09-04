import type { AgendaSyncHealth } from '@/lib/agendaSyncHealth';
import { isValidAgendaTelefone } from '@/lib/agendaSyncHealth';
import type { ConsultationRecord } from '@/lib/consultations';

export type { AgendaSyncHealth };

export type AgendaSyncHealthFilter =
  | 'todos'
  | 'turquesa'
  | 'google_pendente'
  | 'atencao';

export const SYNC_HEALTH_FILTER_CHIPS: {
  id: AgendaSyncHealthFilter;
  label: string;
}[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'turquesa', label: 'Turquesa' },
  { id: 'google_pendente', label: 'Google (pendente)' },
  { id: 'atencao', label: 'Precisam atenção' },
];

export const SYNC_HEALTH_UI: Record<
  AgendaSyncHealth,
  { label: string; tooltip: string; ariaLabel: string }
> = {
  google_only: {
    label: 'Só no Google',
    tooltip: 'Só no Google — vincule cliente e WhatsApp',
    ariaLabel: 'Só no Google: vincule cliente e WhatsApp',
  },
  linked_ok: {
    label: 'Vinculado',
    tooltip: 'Cliente e WhatsApp vinculados ao evento do Google',
    ariaLabel: 'Vinculado: cliente e WhatsApp ok',
  },
  linked_partial: {
    label: 'Vínculo incompleto',
    tooltip: 'Falta cliente ou WhatsApp — complete o cadastro',
    ariaLabel: 'Vínculo incompleto: falta cliente ou WhatsApp',
  },
  turquesa_only: {
    label: 'Só no Turquesa',
    tooltip: 'Agendamento criado no Turquesa, sem evento no Google',
    ariaLabel: 'Só no Turquesa Agenda',
  },
  needs_review: {
    label: 'Conflito de horário',
    tooltip: 'Google e Turquesa têm horários diferentes — escolha qual manter',
    ariaLabel: 'Conflito de horário entre Google e Turquesa',
  },
};

/** Primeiro agendamento em conflito de horário, ignorando IDs adiados nesta sessão. */
export function pickTimeConflictEvent(
  list: ConsultationRecord[],
  dismissedIds?: Set<string>,
): ConsultationRecord | null {
  return (
    list.find((ev) => {
      if (dismissedIds?.has(String(ev.id))) return false;
      if (inferSyncHealth(ev) !== 'needs_review') return false;
      return !!(ev.conflictGoogleInicio ?? ev.start);
    }) ?? null
  );
}

/** Fallback client-side quando o evento ainda não veio do agenda-view. */
export function inferSyncHealth(ev: ConsultationRecord): AgendaSyncHealth {
  if (ev.syncHealth) return ev.syncHealth;

  const hasGoogle = !!ev.googleEventId?.trim();
  if (!hasGoogle) return 'turquesa_only';

  const hasCliente = !!ev.clienteDriveId?.trim();
  const hasTel = isValidAgendaTelefone(ev.telefone);
  if (hasCliente && hasTel) return 'linked_ok';
  if (hasCliente || hasTel) return 'linked_partial';
  return 'google_only';
}

export function filterEventsBySyncHealth(
  events: ConsultationRecord[],
  filter: AgendaSyncHealthFilter,
): ConsultationRecord[] {
  if (filter === 'todos') return events;

  return events.filter((ev) => {
    const health = inferSyncHealth(ev);
    switch (filter) {
      case 'turquesa':
        return health === 'turquesa_only';
      case 'google_pendente':
        return health === 'google_only';
      case 'atencao':
        return (
          health === 'google_only' ||
          health === 'linked_partial' ||
          health === 'needs_review'
        );
      default:
        return true;
    }
  });
}

export function shouldShowSyncHealthBadge(health: AgendaSyncHealth): boolean {
  return health !== 'turquesa_only';
}
