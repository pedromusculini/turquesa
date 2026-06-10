import type { ConsultationRecord } from '@/lib/consultations';
import { TIPO_CONSULTA_UI } from '@/lib/consultations';
import { ATENDIMENTO_LABEL } from '@/lib/constants';

export type ClienteResumoBackup = {
  nome: string;
};

function uniqSorted(values: Iterable<string>): { value: string; label: string }[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = v.trim();
    if (t) set.add(t);
  }
  return [...set]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((v) => ({ value: v, label: v }));
}

/** Rótulo de serviço exibido na consulta */
export function servicoDaConsulta(event: ConsultationRecord): string {
  if (event.service?.trim()) return event.service.trim();
  if (event.tipoConsulta && ATENDIMENTO_LABEL[event.tipoConsulta]) {
    return ATENDIMENTO_LABEL[event.tipoConsulta];
  }
  return '';
}

export function buildServicoFilterOptions(
  events: ConsultationRecord[],
): { value: string; label: string }[] {
  const values = new Set<string>();
  for (const e of events) {
    const s = servicoDaConsulta(e);
    if (s) values.add(s);
  }
  for (const label of Object.values(TIPO_CONSULTA_UI).map((t) => t.label)) {
    values.add(label);
  }
  for (const label of ['Sessão', 'Serviço', 'Procedimento']) {
    values.add(label);
  }
  return uniqSorted(values);
}

export function consultaMatchesServicoFilter(
  event: ConsultationRecord,
  filters: string[],
): boolean {
  if (filters.length === 0) return true;
  const servico = servicoDaConsulta(event);
  return filters.includes(servico);
}
