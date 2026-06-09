import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  baixarEstoqueAtendimento,
  estoqueErrorResponse,
  validarEstoqueAtendimento,
} from '@/lib/catalogoEstoque';
import { normalizeCatalogoItensBody } from '@/lib/atendimentoItens';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';

/** Valida ou baixa estoque de produtos do catálogo (uso interno / atendimentos). */
export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const action = body.action === 'decrement' ? 'decrement' : 'validate';
    const itens = normalizeCatalogoItensBody(body.catalogo_itens ?? body.itens);

    if (action === 'validate') {
      const error = await validarEstoqueAtendimento(email, itens);
      if (error) {
        return NextResponse.json({ ok: false, error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    await baixarEstoqueAtendimento(email, itens);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const estoqueErr = estoqueErrorResponse(err);
    if (estoqueErr) {
      return NextResponse.json({ error: estoqueErr.message }, { status: estoqueErr.status });
    }
    console.error('[catalogo/servicos/estoque/POST]', err);
    return NextResponse.json(
      { error: supabaseErrorMessage(err, 'Erro ao atualizar estoque') },
      { status: 500 },
    );
  }
}

/** Ajuste manual de estoque (valor absoluto, não negativo). */
export async function PATCH(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const id = String(body.id ?? '').trim();
    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const { data: existing, error: loadError } = await supabaseAdmin
      .from('servicos_catalogo')
      .select('id, tipo, estoque')
      .eq('id', id)
      .eq('owner_email', email)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!existing) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    }
    if (existing.tipo !== 'produto') {
      return NextResponse.json({ error: 'Apenas produtos têm estoque' }, { status: 400 });
    }
    if (existing.estoque == null) {
      return NextResponse.json({ error: 'Produto sem controle de estoque' }, { status: 400 });
    }

    const estoque = Math.max(0, Math.round(Number(body.estoque)));
    if (!Number.isFinite(estoque)) {
      return NextResponse.json({ error: 'Estoque inválido' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('servicos_catalogo')
      .update({ estoque, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_email', email)
      .select('id, estoque')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id, estoque: data.estoque });
  } catch (err) {
    console.error('[catalogo/servicos/estoque/PATCH]', err);
    return NextResponse.json(
      { error: supabaseErrorMessage(err, 'Erro ao atualizar estoque') },
      { status: 500 },
    );
  }
}
