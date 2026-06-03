import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { normalizeFotoUrls } from '@/lib/catalogoFotos';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';

export type ServicoCatalogo = {
  id: string;
  owner_email: string;
  nome: string;
  duracao_minutos: number;
  preco_centavos: number;
  ativo: boolean;
  foto_urls: string[];
  created_at: string;
  updated_at: string;
};

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
    const servicos = (data ?? []).map((row) => ({
      ...row,
      foto_urls: normalizeFotoUrls(row.foto_urls),
    }));
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
      return NextResponse.json({ error: 'Nome do serviço é obrigatório' }, { status: 400 });
    }

    const duracao = Math.max(1, Number(body.duracao_minutos) || 30);
    const precoCentavos = Math.max(0, Math.round(Number(body.preco_centavos) || 0));
    const ativo = body.ativo !== false;

    const { data, error } = await supabaseAdmin
      .from('servicos_catalogo')
      .insert({
        owner_email: email,
        nome,
        duracao_minutos: duracao,
        preco_centavos: precoCentavos,
        ativo,
      })
      .select()
      .single();

    if (error) throw error;
    const servico = {
      ...data,
      foto_urls: normalizeFotoUrls(data.foto_urls),
    };
    return NextResponse.json({ id: servico.id, servico }, { status: 201 });
  } catch (error) {
    console.error('[catalogo/servicos/POST]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao cadastrar serviço') },
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
      return NextResponse.json({ error: 'ID do serviço é obrigatório' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.nome != null) updates.nome = String(body.nome).trim();
    if (body.duracao_minutos != null) {
      updates.duracao_minutos = Math.max(1, Number(body.duracao_minutos));
    }
    if (body.preco_centavos != null) {
      updates.preco_centavos = Math.max(0, Math.round(Number(body.preco_centavos)));
    }
    if (body.ativo != null) updates.ativo = !!body.ativo;
    if (body.foto_urls != null) {
      updates.foto_urls = normalizeFotoUrls(body.foto_urls);
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
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ servico: data });
  } catch (error) {
    console.error('[catalogo/servicos/PATCH]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao atualizar serviço') },
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
      { error: supabaseErrorMessage(error, 'Erro ao remover serviço') },
      { status: 500 },
    );
  }
}
