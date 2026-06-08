import { NextRequest, NextResponse } from 'next/server';
import { normalizeFotoUrls } from '@/lib/catalogoFotos';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 });
  }

  const { data: link, error: linkError } = await supabaseAdmin
    .from('formulario_links')
    .select('owner_email, ativo, expires_at')
    .eq('token', token)
    .single();

  if (linkError || !link) {
    return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 404 });
  }

  if (!link.ativo) {
    return NextResponse.json({ error: 'Este formulário não está mais ativo' }, { status: 410 });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expirado' }, { status: 410 });
  }

  const { data: servicos, error } = await supabaseAdmin
    .from('servicos_catalogo')
    .select('id, nome, tipo, duracao_minutos, preco_centavos, descricao, estoque, foto_urls')
    .eq('owner_email', link.owner_email)
    .eq('ativo', true)
    .order('nome', { ascending: true });

  if (error) {
    console.error('[public/catalogo/GET]', error);
    return NextResponse.json({ error: 'Erro ao carregar catálogo' }, { status: 500 });
  }

  const vitrine = (servicos ?? []).map((s) => ({
    id: s.id,
    nome: s.nome,
    tipo: s.tipo === 'produto' ? 'produto' : 'servico',
    duracao_minutos: s.duracao_minutos,
    preco_centavos: s.preco_centavos,
    descricao: s.descricao ?? null,
    estoque: s.estoque ?? null,
    foto_urls: normalizeFotoUrls(s.foto_urls),
  }));

  return NextResponse.json({ servicos: vitrine });
}
