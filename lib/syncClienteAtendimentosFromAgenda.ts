import type { ClienteAtendimento } from '@/lib/types';
import type { FormaPagamentoAtendimento } from '@/lib/atendimentoFinalizar';
import { FORMAS_PAGAMENTO_ATENDIMENTO } from '@/lib/atendimentoFinalizar';
import { collectClienteDriveIdsForLookup } from '@/lib/clienteConsultaLinks';
import {
  finalizarAtendimentoNoCliente,
  findCliente,
  type ClientesDriveStore,
} from '@/lib/clientesDrive';
import { resolveMergedPrimaryId } from '@/lib/clientesGoogleSync';
import { supabaseAdmin } from '@/lib/supabaseClient';

const TZ = 'America/Sao_Paulo';

const FORMAS_VALIDAS = new Set<string>(FORMAS_PAGAMENTO_ATENDIMENTO.map((f) => f.id));

type ConsultaRealizadaRow = {
  id: string;
  cliente_drive_id: string | null;
  inicio: string;
  paciente: string;
  servico: string | null;
  medico: string | null;
  observacoes: string | null;
};

export type SyncClienteAtendimentosResult = {
  consultas_checked: number;
  atendimentos_created: number;
  skipped_existing: number;
};

/** Data/hora da sessão no fuso do salão (bate com finalização na agenda). */
export function consultaSlotFromInicio(inicio: string): { data: string; hora: string } {
  const d = new Date(inicio);
  const data = d.toLocaleDateString('en-CA', { timeZone: TZ });
  const hora = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  });
  return { data, hora };
}

function normalizeHora(h: string | null | undefined): string {
  if (!h) return '';
  return h.trim().slice(0, 5);
}

export function clienteTemAtendimentoNoHorario(
  atendimentos: ClienteAtendimento[],
  data: string,
  hora: string,
): boolean {
  const h = normalizeHora(hora);
  return atendimentos.some((a) => {
    if (a.data !== data) return false;
    const ah = normalizeHora(a.hora);
    if (h && ah) return ah === h;
    return true;
  });
}

function normalizeForma(forma: unknown): FormaPagamentoAtendimento {
  const s = String(forma ?? 'dinheiro');
  return FORMAS_VALIDAS.has(s) ? (s as FormaPagamentoAtendimento) : 'dinheiro';
}

async function fetchRealizadasForOwner(
  owner: string,
  clienteDriveIds?: string[],
): Promise<ConsultaRealizadaRow[]> {
  let q = supabaseAdmin
    .from('consultas_agenda')
    .select('id, cliente_drive_id, inicio, paciente, servico, medico, observacoes')
    .eq('owner_email', owner)
    .eq('status', 'realizado')
    .not('cliente_drive_id', 'is', null)
    .order('inicio', { ascending: true });

  if (clienteDriveIds && clienteDriveIds.length > 0) {
    q = q.in('cliente_drive_id', clienteDriveIds);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ConsultaRealizadaRow[];
}

async function financeiroHintForConsulta(
  owner: string,
  data: string,
  paciente: string,
  medico: string | null,
): Promise<{ valor: number; forma: FormaPagamentoAtendimento } | null> {
  const nome = paciente.replace(/[%_]/g, '').trim();
  if (!nome) return null;

  const { data: rows, error } = await supabaseAdmin
    .from('financeiro_transacoes')
    .select('valor, forma_pagamento, descricao, medico')
    .eq('owner_email', owner)
    .eq('tipo', 'entrada')
    .eq('data', data)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !rows?.length) return null;

  const nomeLower = nome.toLowerCase();
  const medicoLower = medico?.trim().toLowerCase() ?? '';

  for (const row of rows) {
    const desc = String(row.descricao ?? '').toLowerCase();
    const rowMedico = String(row.medico ?? '').toLowerCase();
    const nomeMatch = desc.includes(nomeLower) || nomeLower.split(' ')[0].length >= 3
      ? desc.includes(nomeLower.split(' ')[0])
      : false;
    const medicoMatch = !medicoLower || !rowMedico || rowMedico === medicoLower;
    if (nomeMatch && medicoMatch) {
      return {
        valor: Math.max(0, Number(row.valor) || 0),
        forma: normalizeForma(row.forma_pagamento),
      };
    }
  }

  return null;
}

function resolveClienteForConsulta(
  store: ClientesDriveStore,
  clienteDriveId: string,
) {
  const primaryId = resolveMergedPrimaryId(store, clienteDriveId);
  return findCliente(store, primaryId);
}

/**
 * Cria atendimentos no Drive para sessões `realizado` na agenda que não
 * foram gravadas na ficha (falha silenciosa no /finalizar ou vínculo tardio).
 */
export async function syncRealizadasAgendaToClienteDrive(
  ownerEmail: string,
  store: ClientesDriveStore,
  opts?: { clienteId?: string },
): Promise<SyncClienteAtendimentosResult> {
  const owner = ownerEmail.toLowerCase().trim();
  let driveIds: string[] | undefined;

  if (opts?.clienteId) {
    const cliente = findCliente(store, resolveMergedPrimaryId(store, opts.clienteId));
    if (!cliente) {
      return { consultas_checked: 0, atendimentos_created: 0, skipped_existing: 0 };
    }
    driveIds = collectClienteDriveIdsForLookup(cliente, store);
  }

  const consultas = await fetchRealizadasForOwner(owner, driveIds);
  let created = 0;
  let skipped = 0;

  for (const c of consultas) {
    const clienteDriveId = c.cliente_drive_id ? String(c.cliente_drive_id) : '';
    if (!clienteDriveId) continue;

    const cliente = resolveClienteForConsulta(store, clienteDriveId);
    if (!cliente) continue;

    const { data, hora } = consultaSlotFromInicio(c.inicio);
    if (clienteTemAtendimentoNoHorario(cliente.atendimentos, data, hora)) {
      skipped += 1;
      continue;
    }

    const hint = await financeiroHintForConsulta(owner, data, c.paciente, c.medico);
    const valor = hint?.valor ?? 0;
    const forma = hint?.forma ?? 'dinheiro';
    const obsServico =
      c.servico && c.servico !== 'Atendimento' ? `Serviço: ${c.servico}` : null;
    const observacoes = [c.observacoes?.trim() || null, obsServico]
      .filter(Boolean)
      .join(' · ') || null;

    finalizarAtendimentoNoCliente(cliente, {
      data,
      hora,
      valor,
      valorOriginal: valor,
      forma_pagamento: forma,
      medico: c.medico,
      parcelas: 1,
      tipo: 'consulta',
      observacoes,
      catalogoItens: [],
    });
    created += 1;
  }

  return {
    consultas_checked: consultas.length,
    atendimentos_created: created,
    skipped_existing: skipped,
  };
}
