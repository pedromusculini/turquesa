import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';

/** Campos de repasse gravados na finalização (ver docs/REGRAS_FINANCEIRO.md). */
export type TransacaoRepasse = {
  tipo: 'entrada' | 'saida';
  valor: number;
  medico?: string | null;
  valor_bruto?: number | null;
  taxa_pagamento?: number | null;
  valor_liquido?: number | null;
  valor_profissional?: number | null;
  valor_salao?: number | null;
};

export type RepasseProfissional = {
  nome: string;
  qtd: number;
  bruto: number;
  taxa: number;
  liquido: number;
  profissional: number;
  salao: number;
};

/** Bruto → taxa → líquido → parte da profissional → parte do salão, por profissional. */
export function relatorioRepasseProfissionais(
  transacoes: TransacaoRepasse[],
): RepasseProfissional[] {
  const porProf: Record<string, RepasseProfissional> = {};

  for (const t of transacoes) {
    if (t.tipo !== 'entrada' || !t.medico) continue;
    const nome = t.medico;
    const r = (porProf[nome] ??= {
      nome,
      qtd: 0,
      bruto: 0,
      taxa: 0,
      liquido: 0,
      profissional: 0,
      salao: 0,
    });
    const bruto = t.valor_bruto ?? t.valor;
    const taxa = t.taxa_pagamento ?? 0;
    const liquido = t.valor_liquido ?? bruto - taxa;
    const vp = t.valor_profissional ?? 0;
    r.bruto += bruto;
    r.taxa += taxa;
    r.liquido += liquido;
    r.profissional += vp;
    r.salao += t.valor_salao ?? liquido - vp;
    r.qtd += 1;
  }

  return Object.values(porProf).sort((a, b) => b.profissional - a.profissional);
}

export type PeriodoRepasseId = 'hoje' | 'semana' | 'mes' | 'mes_anterior';

export type PeriodoRepasse = {
  id: PeriodoRepasseId;
  label: string;
  start: string;
  end: string;
  /** Texto usado na mensagem de WhatsApp ("hoje", "nesta semana (06/10 a 12/10)"…). */
  descricao: string;
};

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const dm = (d: Date) => format(d, 'dd/MM');

export function periodoRepasse(id: PeriodoRepasseId, now = new Date()): PeriodoRepasse {
  switch (id) {
    case 'hoje':
      return { id, label: 'Hoje', start: ymd(now), end: ymd(now), descricao: `hoje (${dm(now)})` };
    case 'semana': {
      const s = startOfWeek(now, { weekStartsOn: 1 });
      const e = endOfWeek(now, { weekStartsOn: 1 });
      return {
        id,
        label: 'Semana',
        start: ymd(s),
        end: ymd(e),
        descricao: `na semana de ${dm(s)} a ${dm(e)}`,
      };
    }
    case 'mes': {
      const s = startOfMonth(now);
      return {
        id,
        label: 'Mês',
        start: ymd(s),
        end: ymd(endOfMonth(now)),
        descricao: `no mês de ${format(s, 'MM/yyyy')}`,
      };
    }
    case 'mes_anterior': {
      const s = startOfMonth(subMonths(now, 1));
      return {
        id,
        label: 'Mês anterior',
        start: ymd(s),
        end: ymd(endOfMonth(s)),
        descricao: `no mês de ${format(s, 'MM/yyyy')}`,
      };
    }
  }
}

export const PERIODOS_REPASSE: PeriodoRepasseId[] = ['hoje', 'semana', 'mes', 'mes_anterior'];

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Resumo para a profissional conferir — enviado pelo WhatsApp (wa.me, sem telefone fixo). */
export function mensagemRepasseProfissional(
  r: RepasseProfissional,
  periodoDescricao: string,
): string {
  const primeiroNome = r.nome.trim().split(/\s+/)[0] || r.nome;
  const atend = r.qtd === 1 ? '1 atendimento' : `${r.qtd} atendimentos`;
  return (
    `Oi, ${primeiroNome}! Seu resumo ${periodoDescricao}:\n\n` +
    `${atend}\n` +
    `Total atendido: ${brl(r.bruto)}\n` +
    (r.taxa > 0 ? `Taxas de pagamento: ${brl(r.taxa)}\n` : '') +
    `Sua parte: *${brl(r.profissional)}*\n\n` +
    `Qualquer dúvida, me chama.`
  );
}
