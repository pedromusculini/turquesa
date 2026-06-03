import type { ConsultationRecord } from '@/lib/consultations';
import { TIPO_CONSULTA_UI } from '@/lib/consultations';
import { ATENDIMENTO_LABEL } from '@/lib/constants';
import {
  PLANO_SAUDE_OUTRO,
  PLANOS_SAUDE_TODOS,
  formatarOutroConvenio,
  isOutroConvenioSalvo,
  parseSelecaoConvenios,
  planoSaudeLabel,
  textoOutroConvenio,
} from '@/lib/planosSaude';

export type ClienteResumoBackup = {
  nome: string;
  convenio?: string | null;
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

/** Expande valor salvo (incl. "Outro: Nome" e listas separadas por vírgula) */
function expandConvenioSalvo(raw: string): string[] {
  const out = new Set<string>();
  const trimmed = raw.trim();
  if (!trimmed) return [];

  out.add(trimmed);

  const { padrao, outros } = parseSelecaoConvenios(trimmed);
  for (const p of padrao) out.add(p);
  for (const nome of outros) {
    out.add(formatarOutroConvenio(nome));
  }

  if (isOutroConvenioSalvo(trimmed)) {
    out.add(PLANO_SAUDE_OUTRO.label);
  }

  return [...out];
}

function planoMatchesFilter(planoSalvo: string, filter: string): boolean {
  if (planoSalvo === filter) return true;

  if (filter === PLANO_SAUDE_OUTRO.label && isOutroConvenioSalvo(planoSalvo)) {
    return true;
  }

  if (isOutroConvenioSalvo(filter) && isOutroConvenioSalvo(planoSalvo)) {
    const nomeFiltro = textoOutroConvenio(filter);
    const nomeSalvo = textoOutroConvenio(planoSalvo);
    if (!nomeFiltro || filter === PLANO_SAUDE_OUTRO.label) return true;
    return nomeFiltro.toLowerCase() === nomeSalvo.toLowerCase();
  }

  return false;
}

/** Planos fixos no topo do menu de rolagem do backup */
const PLANOS_PINADOS_TOPO = [
  PLANO_SAUDE_OUTRO.label,
  'Particular (sem convênio)',
  'Particular',
  'Particular ou não informado',
  'SUS',
];

function ordenarOpcoesPlano(
  options: { value: string; label: string }[],
): { value: string; label: string }[] {
  const pinned = PLANOS_PINADOS_TOPO.filter((label) =>
    options.some((o) => o.value === label),
  ).map((label) => ({ value: label, label }));

  const pinnedSet = new Set(PLANOS_PINADOS_TOPO);
  const rest = options.filter((o) => !pinnedSet.has(o.value));
  return [...pinned, ...rest];
}

/** Rótulos de plano/convênio associados à consulta */
export function planosDaConsulta(event: ConsultationRecord): string[] {
  const out = new Set<string>();
  if (event.convenio?.trim()) out.add(event.convenio.trim());
  if (event.payment?.convenio?.trim()) out.add(event.payment.convenio.trim());
  return [...out];
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
  for (const label of ['Consulta médica', 'Retorno', 'Consulta', 'Exame', 'Procedimento']) {
    values.add(label);
  }
  return uniqSorted(values);
}

export function buildPlanoFilterOptions(
  events: ConsultationRecord[],
  clientes: ClienteResumoBackup[],
): { value: string; label: string }[] {
  const values = new Set<string>();

  for (const p of PLANOS_SAUDE_TODOS) {
    values.add(p.label);
  }
  values.add('Particular');
  values.add('Particular ou não informado');

  for (const e of events) {
    for (const p of planosDaConsulta(e)) {
      for (const label of expandConvenioSalvo(p)) values.add(label);
    }
  }
  for (const c of clientes) {
    if (c.convenio?.trim()) {
      for (const label of expandConvenioSalvo(c.convenio.trim())) {
        values.add(label);
        values.add(planoSaudeLabel(label));
      }
    }
  }

  return ordenarOpcoesPlano(uniqSorted(values));
}

export function consultaMatchesServicoFilter(
  event: ConsultationRecord,
  filters: string[],
): boolean {
  if (filters.length === 0) return true;
  const servico = servicoDaConsulta(event);
  return filters.includes(servico);
}

export function consultaMatchesPlanoFilter(
  event: ConsultationRecord,
  filters: string[],
  convenioPorPaciente: Map<string, string>,
): boolean {
  if (filters.length === 0) return true;

  const planos = planoesDaConsultaComCliente(event, convenioPorPaciente);
  return filters.some((f) => planos.some((p) => planoMatchesFilter(p, f)));
}

function planoesDaConsultaComCliente(
  event: ConsultationRecord,
  convenioPorPaciente: Map<string, string>,
): string[] {
  const out = new Set<string>();
  for (const p of planosDaConsulta(event)) {
    for (const label of expandConvenioSalvo(p)) out.add(label);
  }
  const key = event.patient?.trim().toLowerCase();
  if (key && convenioPorPaciente.has(key)) {
    for (const label of expandConvenioSalvo(convenioPorPaciente.get(key)!)) {
      out.add(label);
      out.add(planoSaudeLabel(label));
    }
  }
  return [...out];
}

export function mapConvenioPorPaciente(
  clientes: ClienteResumoBackup[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of clientes) {
    if (c.nome?.trim() && c.convenio?.trim()) {
      map.set(c.nome.trim().toLowerCase(), c.convenio.trim());
    }
  }
  return map;
}
