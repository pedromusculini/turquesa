import { after, NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { requireFinanceiroUnlocked } from '@/lib/financeiroPin';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { loadFaturamentoStore, saveFaturamentoStore } from '@/lib/clientesDrive';
import { getOwnerGoogleAccessToken } from '@/lib/ownerGoogleTokens';
import { registrarEntradaFinanceira } from '@/lib/registrarEntradaFinanceira';
import { normalizeCatalogoItensBody } from '@/lib/atendimentoItens';
import {
  listFinanceiroTransacoes,
  listSplitsForTransacoes,
} from '@/lib/financeiroList';

/** Espelho Drive 100% em background (token incluso) — não atrasa o POST/DELETE. */
function mirrorFaturamentoDrive(params: {
  ownerEmail: string;
  googleSub: string;
  cookieDriveToken: string | null;
  mutate: (store: Awaited<ReturnType<typeof loadFaturamentoStore>>) => void;
  logLabel: string;
}) {
  const { ownerEmail, googleSub, cookieDriveToken, mutate, logLabel } = params;
  after(async () => {
    try {
      let driveToken = cookieDriveToken;
      if (!driveToken) {
        driveToken = await getOwnerGoogleAccessToken(googleSub, 'drive');
      }
      if (!driveToken) return;
      const store = await loadFaturamentoStore(driveToken, ownerEmail);
      mutate(store);
      await saveFaturamentoStore(driveToken, store);
    } catch (driveErr) {
      console.warn(`[financeiro/${logLabel}] Espelho Drive:`, driveErr);
    }
  });
}

// GET /api/financeiro?start=YYYY-MM-DD&end=YYYY-MM-DD&type=entrada|saida&medicos=med1,med2
export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const pinGuard = await requireFinanceiroUnlocked(email, req);
  if (pinGuard) return pinGuard;

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const typeParam = searchParams.get('type');
    const medicos = searchParams.get('medicos');

    const type =
      typeParam === 'entrada' || typeParam === 'saida' ? typeParam : null;
    const medicoList = medicos
      ? medicos.split(',').map((m) => m.trim()).filter(Boolean)
      : null;

    const data = await listFinanceiroTransacoes(email, {
      start,
      end,
      type,
      medicos: medicoList,
    });

    const entradasIds = data
      .filter((t) => t.tipo === 'entrada')
      .map((t) => String(t.id));

    const splitsMap: Record<string, unknown[]> = {};
    const splitsData = await listSplitsForTransacoes(entradasIds);
    for (const split of splitsData) {
      const tid = String(split.transacao_id);
      if (!splitsMap[tid]) splitsMap[tid] = [];
      splitsMap[tid].push(split);
    }

    const hydrated = data.map((t) => ({
      ...t,
      splits: splitsMap[String(t.id)] || [],
    }));

    return NextResponse.json(hydrated);
  } catch (error: unknown) {
    console.error('[financeiro/GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email, googleSub } = authResult;
  const cookieDriveToken = req.cookies.get('google_drive_token')?.value ?? null;

  const pinGuard = await requireFinanceiroUnlocked(email, req);
  if (pinGuard) return pinGuard;

  try {
    const body = await req.json();
    const { tipo, descricao, data, valor, categoria, medico, splits, observacao } = body;
    const catalogoItens = normalizeCatalogoItensBody(body.catalogo_itens);

    if (!tipo || !descricao || !data || valor === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: tipo, descricao, data, valor' },
        { status: 400 },
      );
    }

    if (!['entrada', 'saida'].includes(tipo)) {
      return NextResponse.json(
        { error: 'tipo deve ser "entrada" ou "saida"' },
        { status: 400 },
      );
    }

    let transacao: Record<string, unknown>;
    let insertedSplits: unknown[] = [];

    if (
      tipo === 'entrada' &&
      medico &&
      body.percentual_profissional != null &&
      Number(body.percentual_profissional) >= 0
    ) {
      try {
        const { transacao: t } = await registrarEntradaFinanceira({
          ownerEmail: email,
          descricao,
          data,
          valorBruto: Number(valor),
          categoria: categoria || null,
          medico: String(medico),
          observacao: observacao || null,
          formaPagamento: body.forma_pagamento || null,
          parcelas: Math.max(1, Number(body.parcelas) || 1),
          percentualProfissional: Number(body.percentual_profissional),
          repassarCusto: body.repassar_custo,
          catalogoItens,
        });
        transacao = t as Record<string, unknown>;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar entrada';
        console.error('[financeiro/POST] registrarEntrada:', err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from('financeiro_transacoes')
        .insert({
          tipo,
          descricao,
          data,
          valor: Number(valor),
          categoria: categoria || null,
          medico: medico || null,
          observacao: observacao || null,
          owner_email: email,
          forma_pagamento: body.forma_pagamento || null,
          parcelas: body.parcelas ? Math.max(1, Number(body.parcelas)) : null,
          percentual_profissional: body.percentual_profissional ?? null,
          ...(catalogoItens.length > 0 ? { catalogo_itens: catalogoItens } : {}),
        })
        .select()
        .single();

      if (error) {
        console.error('[financeiro/POST] Insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      transacao = inserted as Record<string, unknown>;
    }

    if (tipo === 'entrada' && splits?.length > 0) {
      const splitsToInsert = splits.map((s: { medico: string; porcentagem: number }) => ({
        transacao_id: transacao.id,
        medico: s.medico,
        porcentagem: Number(s.porcentagem),
        valor_split: (Number(valor) * Number(s.porcentagem)) / 100,
      }));

      const { data: splitsResult, error: splitsError } = await supabaseAdmin
        .from('financeiro_splits')
        .insert(splitsToInsert)
        .select();

      if (splitsError) {
        console.error('[financeiro/POST] Splits error:', splitsError);
      } else {
        insertedSplits = splitsResult || [];
      }
    }

    const responseBody = { ...transacao, splits: insertedSplits };
    mirrorFaturamentoDrive({
      ownerEmail: email,
      googleSub,
      cookieDriveToken,
      mutate: (store) => {
        store.transacoes.unshift(responseBody);
      },
      logLabel: 'POST',
    });

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error: unknown) {
    console.error('[financeiro/POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email, googleSub } = authResult;
  const cookieDriveToken = req.cookies.get('google_drive_token')?.value ?? null;

  const pinGuard = await requireFinanceiroUnlocked(email, req);
  if (pinGuard) return pinGuard;

  try {
    const body = await req.json();
    const id = String(body.id ?? '').trim();
    const { descricao, data, valor, categoria, observacao } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }
    if (!descricao || !data || valor === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: descricao, data, valor' },
        { status: 400 },
      );
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('financeiro_transacoes')
      .select('*')
      .eq('id', id)
      .eq('owner_email', email)
      .maybeSingle();

    if (fetchError) {
      console.error('[financeiro/PATCH] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 });
    }
    if (existing.tipo !== 'saida') {
      return NextResponse.json(
        { error: 'Somente saídas (despesas) podem ser editadas manualmente.' },
        { status: 400 },
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from('financeiro_transacoes')
      .update({
        descricao: String(descricao).trim(),
        data: String(data),
        valor: Number(valor),
        categoria: categoria ? String(categoria) : null,
        observacao: observacao ? String(observacao).trim() : null,
      })
      .eq('id', id)
      .eq('owner_email', email)
      .select()
      .single();

    if (error) {
      console.error('[financeiro/PATCH] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const responseBody = { ...updated, splits: [] as unknown[] };
    mirrorFaturamentoDrive({
      ownerEmail: email,
      googleSub,
      cookieDriveToken,
      mutate: (store) => {
        const idx = store.transacoes.findIndex(
          (t) => String((t as { id?: string }).id) === id,
        );
        if (idx >= 0) {
          store.transacoes[idx] = {
            ...(store.transacoes[idx] as Record<string, unknown>),
            ...responseBody,
          };
        } else {
          store.transacoes.unshift(responseBody);
        }
      },
      logLabel: 'PATCH',
    });

    return NextResponse.json(responseBody);
  } catch (error: unknown) {
    console.error('[financeiro/PATCH] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email, googleSub } = authResult;
  const cookieDriveToken = req.cookies.get('google_drive_token')?.value ?? null;

  const pinGuard = await requireFinanceiroUnlocked(email, req);
  if (pinGuard) return pinGuard;

  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    const { data: owned } = await supabaseAdmin
      .from('financeiro_transacoes')
      .select('id')
      .eq('id', id)
      .eq('owner_email', email)
      .maybeSingle();

    if (!owned) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 });
    }

    await supabaseAdmin.from('financeiro_splits').delete().eq('transacao_id', id);

    const { error } = await supabaseAdmin
      .from('financeiro_transacoes')
      .delete()
      .eq('id', id)
      .eq('owner_email', email);

    if (error) {
      console.error('[financeiro/DELETE] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    mirrorFaturamentoDrive({
      ownerEmail: email,
      googleSub,
      cookieDriveToken,
      mutate: (store) => {
        store.transacoes = store.transacoes.filter(
          (t) => (t as { id?: string }).id !== id,
        );
      },
      logLabel: 'DELETE',
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[financeiro/DELETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
