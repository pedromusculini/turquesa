import { NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import {
  isConsultasAgendaTableMissing,
  listConsultasAgendaForOwner,
  updateConsultaAgendaStatus,
} from '@/lib/consultasAgenda';
import {
  findConsultasToReconcileFromFinanceiro,
  type FinanceiroTransacaoResumo,
} from '@/lib/reconcileConsultasFinanceiro';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

/** Repara status em consultas_agenda a partir de entradas no financeiro (mesmo cliente + data). */
export async function POST() {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const daysPast = 90;
    const since = new Date(Date.now() - daysPast * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: financeiro, error: finErr } = await supabaseAdmin
      .from('financeiro_transacoes')
      .select('data, descricao, valor, forma_pagamento, medico, categoria, tipo')
      .eq('owner_email', email)
      .eq('tipo', 'entrada')
      .gte('data', since);

    if (finErr) {
      return NextResponse.json({ error: finErr.message }, { status: 500 });
    }

    const consultas = await listConsultasAgendaForOwner(email, { daysPast });
    const ids = findConsultasToReconcileFromFinanceiro(
      consultas,
      (financeiro ?? []) as FinanceiroTransacaoResumo[],
    );

    let updated = 0;
    for (const id of ids) {
      const ok = await updateConsultaAgendaStatus(id, email, 'realizado');
      if (ok) updated += 1;
    }

    return NextResponse.json({ success: true, updated, candidates: ids.length });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (isConsultasAgendaTableMissing(e)) {
      return NextResponse.json({ success: true, updated: 0, candidates: 0 });
    }
    return NextResponse.json(
      { error: e.message ?? 'Erro ao reconciliar atendimentos' },
      { status: 500 },
    );
  }
}
