import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { normalizeFotoUrls } from '@/lib/catalogoFotos';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';

export type CatalogoItemTipo = 'servico' | 'produto';

export type ServicoCatalogo = {
  id: string;
  owner_email: string;
  nome: string;
  tipo: CatalogoItemTipo;
  duracao_minutos: number | null;
  preco_centavos: number;
  descricao: string | null;
  estoque: number | null;
  ativo: boolean;
  foto_urls: string[];
  created_at: string;
  updated_at: string;
};

function normalizeTipo(raw: unknown): CatalogoItemTipo {
  return raw === 'produto' ? 'produto' : 'servico';
}

function normalizeDescricao(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s || null;
}

function normalizeEstoque(raw: unknown, controlarEstoque: boolean): number | null {
  if (!controlarEstoque) return null;
  return Math.max(0, Math.round(Number(raw) || 0));
}

function mapRow(row: Record<string, unknown>): ServicoCatalogo {
  return {
    ...(row as ServicoCatalogo),
    tipo: normalizeTipo(row.tipo),
    duracao_minutos:
      row.duracao_minutos == null ? null : Math.max(1, Number(row.duracao_minutos)),
    descricao: row.descricao == null ? null : String(row.descricao),
    estoque: row.estoque == null ? null : Math.max(0, Math.round(Number(row.estoque))),
    foto_urls: normalizeFotoUrls(row.foto_urls),
  };
}

function itemLabel(tipo: CatalogoItemTipo) {
  return tipo === 'produto' ? 'produto' : 'serviço';
}

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const { data, error } = await supabaseAdmin
      .from('servicos_catalogo')
      .select('*')
      .eq('owner_email', email)
      .order('nome', { ascending: true });

    if (error) throw error;
    const servicos = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    return NextResponse.json({ servicos });
  } catch (error) {
    console.error('[catalogo/servicos/GET]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar catálogo') },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const nome = String(body.nome ?? '').trim();
    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const tipo = normalizeTipo(body.tipo);
    const precoCentavos = Math.max(0, Math.round(Number(body.preco_centavos) || 0));
    const ativo = body.ativo !== false;
    const descricao = normalizeDescricao(body.descricao);
    const controlarEstoque = body.controlar_estoque === true || body.estoque != null;
    const estoque = tipo === 'produto' ? normalizeEstoque(body.estoque, controlarEstoque) : null;

    let duracao: number | null = null;
    if (tipo === 'servico') {
      duracao = Math.max(1, Number(body.duracao_minutos) || 30);
    }

    const { data, error } = await supabaseAdmin
      .from('servicos_catalogo')
      .insert({
        owner_email: email,
        nome,
        tipo,
        duracao_minutos: duracao,
        preco_centavos: precoCentavos,
        descricao,
        estoque,
        ativo,
      })
      .select()
      .single();

    if (error) throw error;
    const servico = mapRow(data as Record<string, unknown>);
    return NextResponse.json({ id: servico.id, servico }, { status: 201 });
  } catch (error) {
    console.error('[catalogo/servicos/POST]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao cadastrar item') },
      { status: 500 },
    );
  }
}

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
      .select('tipo')
      .eq('id', id)
      .eq('owner_email', email)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!existing) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    }

    const tipo = body.tipo != null ? normalizeTipo(body.tipo) : normalizeTipo(existing.tipo);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.nome != null) updates.nome = String(body.nome).trim();
    if (body.tipo != null) updates.tipo = tipo;
    if (body.descricao !== undefined) updates.descricao = normalizeDescricao(body.descricao);
    if (body.preco_centavos != null) {
      updates.preco_centavos = Math.max(0, Math.round(Number(body.preco_centavos)));
    }
    if (body.ativo != null) updates.ativo = !!body.ativo;
    if (body.foto_urls != null) {
      updates.foto_urls = normalizeFotoUrls(body.foto_urls);
    }

    if (tipo === 'servico') {
      if (body.duracao_minutos != null) {
        updates.duracao_minutos = Math.max(1, Number(body.duracao_minutos));
      } else if (body.tipo === 'servico') {
        updates.duracao_minutos = Math.max(1, Number(body.duracao_minutos) || 30);
      }
      updates.estoque = null;
    } else {
      updates.duracao_minutos = null;
      if (body.controlar_estoque === false) {
        updates.estoque = null;
      } else if (body.controlar_estoque === true || body.estoque != null) {
        updates.estoque = normalizeEstoque(body.estoque, true);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('servicos_catalogo')
      .update(updates)
      .eq('id', id)
      .eq('owner_email', email)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: `${itemLabel(tipo)} não encontrado` }, { status: 404 });
    }
    const servico = mapRow(data as Record<string, unknown>);
    return NextResponse.json({ servico });
  } catch (error) {
    console.error('[catalogo/servicos/PATCH]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao atualizar item') },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('servicos_catalogo')
      .delete()
      .eq('id', id)
      .eq('owner_email', email);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[catalogo/servicos/DELETE]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao remover item') },
      { status: 500 },
    );
  }
}
