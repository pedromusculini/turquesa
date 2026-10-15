/** Partes puras da ficha da cliente — seguras para componentes do navegador (sem banco). */
import type { ClienteAgendaConsulta } from '@/lib/clienteConsultaLinks';
import type { AnamneseCampo } from '@/lib/anamnese';
import type { ClienteDetalhe, ClienteObservacao, ClientePagamento } from '@/lib/types';
import { parseObservacaoAtendimento, resumoServicosItens } from '@/lib/atendimentoItens';

export type { ClienteAgendaConsulta };

export type ClienteFinanceiroEntrada = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  forma_pagamento: string | null;
  medico: string | null;
  observacao: string | null;
};

export type ClienteDetalheEnriquecido = ClienteDetalhe & {
  anamnese_respostas?: Record<string, string | boolean> | null;
  servico_interesse_id?: string | null;
  servico_interesse_nome?: string | null;
  agenda_consultas?: ClienteAgendaConsulta[];
  financeiro_entradas?: ClienteFinanceiroEntrada[];
};

/** Extrai últimas respostas de anamnese gravadas em observações (legado) */
export function parseAnamneseFromObservacoes(
  observacoes: ClienteObservacao[],
): Record<string, string | boolean> | null {
  const bloco = observacoes.find((o) => o.texto.startsWith('[Anamnese —'));
  if (!bloco) return null;
  const lines = bloco.texto.split('\n').slice(1);
  const out: Record<string, string | boolean> = {};
  for (const line of lines) {
    const m = line.match(/^•\s*(.+?):\s*(.+)$/);
    if (!m) continue;
    const label = m[1].trim();
    const val = m[2].trim();
    if (val === 'Sim') out[label] = true;
    else if (val === 'Não') out[label] = false;
    else out[label] = val;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Marca blocos copiados na unificação de cadastros (`mergeClienteIntoPrimary`). */
export const MERGE_OBSERVACAO_TAG = '[Unificação]';

const MERGE_AUDIT_OBS_RE =
  /^\[Unificação\]\s*Cadastro\s+"[^"]+"\s+\([^)]+\)\s+mesclado neste cliente\.?\s*$/i;

/** Registro de auditoria da unificação — não exibir na ficha profissional. */
export function isMergeAuditObservacao(texto: string): boolean {
  return MERGE_AUDIT_OBS_RE.test(texto.trim());
}

/** Observação de sistema gerada pela unificação (lista de observações do cliente). */
export function isMergeSystemObservacao(texto: string): boolean {
  const t = texto.trim();
  return t.startsWith(MERGE_OBSERVACAO_TAG);
}

/** Remove marcas/blocos de unificação; preserva notas reais do cliente. */
export function stripMergeMarkersObservacoesGerais(text: string | null): string | null {
  if (!text?.trim()) return null;

  const blocks = text.split(/\n\n+/);
  const kept: string[] = [];

  for (const block of blocks) {
    let content = block.trim();
    if (!content) continue;

    if (content.startsWith(`${MERGE_OBSERVACAO_TAG}\n`)) {
      content = content.slice(MERGE_OBSERVACAO_TAG.length + 1).trim();
    } else if (content.startsWith(`${MERGE_OBSERVACAO_TAG} `)) {
      if (isMergeAuditObservacao(content)) continue;
      content = content.slice(MERGE_OBSERVACAO_TAG.length).trim();
    }

    if (!content || isMergeAuditObservacao(content)) continue;
    kept.push(content);
  }

  const result = kept.join('\n\n').trim();
  return result || null;
}

/** Mapa atendimento_id → pagamento mais recente */
export function pagamentosPorAtendimento(
  pagamentos: ClientePagamento[],
): Map<string, ClientePagamento> {
  const map = new Map<string, ClientePagamento>();
  for (const p of pagamentos) {
    if (!p.atendimento_id) continue;
    if (!map.has(p.atendimento_id)) map.set(p.atendimento_id, p);
  }
  return map;
}

export function formatAnamneseValor(
  campo: AnamneseCampo,
  val: string | boolean | undefined,
): string {
  if (val === undefined || val === null) return '—';
  if (campo.tipo === 'sim_nao') return val === true || val === 'sim' ? 'Sim' : 'Não';
  return String(val);
}

export function anamneseValuesFromDetalhe(
  detalhe: ClienteDetalheEnriquecido,
  campos: AnamneseCampo[],
): Record<string, string | boolean> {
  const raw = detalhe.anamnese_respostas;
  if (!raw || campos.length === 0) return {};
  const out: Record<string, string | boolean> = {};
  for (const campo of campos) {
    if (raw[campo.id] !== undefined) {
      out[campo.id] = raw[campo.id];
      continue;
    }
    const byLabel = raw[campo.label];
    if (byLabel !== undefined) out[campo.id] = byLabel;
  }
  return out;
}

export function allAtendimentosOrdenados(
  detalhe: ClienteDetalheEnriquecido,
): Array<{
  key: string;
  data: string;
  hora: string | null;
  tipo: string;
  medico: string | null;
  servico: string | null;
  valor: number | null;
  status: string;
  forma_pagamento: string | null;
  observacoes: string | null;
  origem: 'drive' | 'agenda';
  atendimentoId?: string;
}> {
  const pagMap = pagamentosPorAtendimento(detalhe.pagamentos);
  const linhas: ReturnType<typeof allAtendimentosOrdenados> = [];

  for (const a of detalhe.atendimentos) {
    const pag = pagMap.get(a.id);
    const parsed = parseObservacaoAtendimento(a.observacoes);
    const servico = parsed.itens.length > 0 ? resumoServicosItens(parsed.itens) : null;
    linhas.push({
      key: `d-${a.id}`,
      data: a.data,
      hora: a.hora,
      tipo: a.tipo,
      medico: a.medico,
      servico,
      valor: a.valor,
      status: a.status,
      forma_pagamento: pag?.forma_pagamento ?? null,
      observacoes:
        parsed.textoLivre || (parsed.itens.length === 0 ? a.observacoes : null),
      origem: 'drive',
      atendimentoId: a.id,
    });
  }

  const driveKeys = new Set(
    linhas.map((l) => `${l.data}T${(l.hora ?? '').slice(0, 5)}`),
  );

  const seenAgendaSlots = new Set<string>();
  for (const c of detalhe.agenda_consultas ?? []) {
    const inicio = new Date(c.inicio);
    const data = inicio.toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    });
    const hora = inicio.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    });
    const slotKey = `${data}T${hora.slice(0, 5)}`;
    if (driveKeys.has(slotKey)) continue;
    if (seenAgendaSlots.has(slotKey)) continue;
    seenAgendaSlots.add(slotKey);
    linhas.push({
      key: `a-${c.id}`,
      data,
      hora,
      tipo: 'consulta',
      medico: c.medico,
      servico: c.servico,
      valor: null,
      status: c.status ?? 'confirmado',
      forma_pagamento: null,
      observacoes: null,
      origem: 'agenda',
    });
  }

  return linhas.sort((a, b) => {
    const da = `${a.data}T${a.hora || '00:00'}`;
    const db = `${b.data}T${b.hora || '00:00'}`;
    return db.localeCompare(da);
  });
}
