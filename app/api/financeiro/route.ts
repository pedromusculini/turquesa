import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getGoogleAccessToken } from '@/lib/driveAuth';
import { loadFaturamentoStore, saveFaturamentoStore } from '@/lib/clientesDrive';

// GET /api/financeiro?start=YYYY-MM-DD&end=YYYY-MM-DD&type=entrada|saida&medicos=med1,med2
export async function GET(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const type = searchParams.get('type');
    const medicos = searchParams.get('medicos');

    let query = supabaseAdmin
      .from('financeiro_transacoes')
      .select('*')
      .eq('owner_email', email)
      .order('data', { ascending: false });

    if (start) query = query.gte('data', start);
    if (end) query = query.lte('data', end);
    if (type && (type === 'entrada' || type === 'saida')) {
      query = query.eq('tipo', type);
    }
    if (medicos) {
      const medicoList = medicos.split(',').map((m) => m.trim()).filter(Boolean);
      if (medicoList.length > 0) query = query.in('medico', medicoList);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[financeiro/GET] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entradasIds = (data || [])
      .filter((t: { tipo: string }) => t.tipo === 'entrada')
      .map((t: { id: string }) => t.id);

    const splitsMap: Record<string, unknown[]> = {};
    if (entradasIds.length > 0) {
      const { data: splitsData } = await supabaseAdmin
        .from('financeiro_splits')
        .select('*')
        .in('transacao_id', entradasIds);

      for (const split of splitsData || []) {
        if (!splitsMap[split.transacao_id]) splitsMap[split.transacao_id] = [];
        splitsMap[split.transacao_id].push(split);
      }
    }

    const hydrated = (data || []).map((t: { id: string }) => ({
      ...t,
      splits: splitsMap[t.id] || [],
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
  const { email } = authResult;

  try {
    const body = await req.json();
    const { tipo, descricao, data, valor, categoria, medico, splits, observacao } = body;

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

    const { data: transacao, error } = await supabaseAdmin
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
      })
      .select()
      .single();

    if (error) {
      console.error('[financeiro/POST] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let insertedSplits: unknown[] = [];
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

    const driveToken = await getGoogleAccessToken(req);
    if (driveToken) {
      try {
        const store = await loadFaturamentoStore(driveToken, email);
        store.transacoes.unshift(responseBody);
        await saveFaturamentoStore(driveToken, store);
      } catch (driveErr) {
        console.warn('[financeiro/POST] Espelho Drive:', driveErr);
      }
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error: unknown) {
    console.error('[financeiro/POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

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

    const session = await auth();
    const driveToken = await getGoogleAccessToken(req);
    if (driveToken && session?.user?.email) {
      try {
        const store = await loadFaturamentoStore(
          driveToken,
          session.user.email.toLowerCase().trim(),
        );
        store.transacoes = store.transacoes.filter(
          (t) => (t as { id?: string }).id !== id,
        );
        await saveFaturamentoStore(driveToken, store);
      } catch {
        /* espelho Drive opcional */
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[financeiro/DELETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
