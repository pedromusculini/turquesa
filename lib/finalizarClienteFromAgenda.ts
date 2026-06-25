import type { AtendimentoItemLinha } from '@/lib/atendimentoItens';
import type { FormaPagamentoConsulta } from '@/lib/consultations';

export type FinalizarClienteAgendaBody = {
  data: string;
  hora: string | null;
  valor: number;
  valorOriginal: number;
  descontoPercent: number;
  descontoValor: number;
  forma_pagamento: FormaPagamentoConsulta;
  medico: string;
  parcelas: number;
  observacoes: string | null;
  catalogo_itens: AtendimentoItemLinha[];
};

export type FinalizarClienteAgendaResult =
  | { ok: true }
  | { ok: false; error: string };

/** POST /api/clientes/:id/finalizar com tratamento de erro HTTP. */
export async function postFinalizarClienteFromAgenda(
  clienteDriveId: string,
  body: FinalizarClienteAgendaBody,
): Promise<FinalizarClienteAgendaResult> {
  try {
    const res = await fetch(`/api/clientes/${clienteDriveId}/finalizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: body.data,
        hora: body.hora,
        valor: body.valorOriginal,
        valorOriginal: body.valorOriginal,
        descontoPercent: body.descontoPercent,
        descontoValor: body.descontoValor,
        forma_pagamento: body.forma_pagamento,
        medico: body.medico,
        parcelas: body.parcelas,
        tipo: 'consulta',
        observacoes: body.observacoes,
        catalogo_itens: body.catalogo_itens,
      }),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: data.error?.trim() || `Erro ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro de rede',
    };
  }
}

export const MSG_FINALIZAR_CLIENTE_FALHOU =
  'Sessão finalizada na agenda, mas não foi possível registrar na ficha do cliente. Abra a ficha do cliente para sincronizar ou lance o atendimento manualmente.';
