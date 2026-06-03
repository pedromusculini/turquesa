// TODO fase 2: Google Drive — ver docs/CATALOGO_FOTOS_ARMAZENAMENTO.md

import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  CATALOGO_FOTO_MAX_COUNT,
  CATALOGO_FOTO_MIME_TYPES,
  normalizeFotoUrls,
  validateCatalogoFotoBuffer,
  type CatalogoFotoMime,
} from '@/lib/catalogoFotos';
import {
  compressCatalogoFotoForStorage,
  removeCatalogoFotoFromStorage,
  uploadCatalogoFoto,
} from '@/lib/catalogoFotosStorage';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const form = await req.formData();
    const servicoId = String(form.get('servico_id') ?? '').trim();
    const file = form.get('file');

    if (!servicoId) {
      return NextResponse.json({ error: 'ID do serviço é obrigatório' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de imagem é obrigatório' }, { status: 400 });
    }

    const mime = file.type;
    if (!CATALOGO_FOTO_MIME_TYPES.includes(mime as CatalogoFotoMime)) {
      return NextResponse.json(
        { error: 'Use JPEG, PNG ou WebP.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateCatalogoFotoBuffer(buffer, mime);
    if (validation) {
      return NextResponse.json({ error: validation }, { status: 400 });
    }

    const { data: servico, error: fetchErr } = await supabaseAdmin
      .from('servicos_catalogo')
      .select('id, foto_urls')
      .eq('id', servicoId)
      .eq('owner_email', email)
      .single();

    if (fetchErr || !servico) {
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });
    }

    const current = normalizeFotoUrls(servico.foto_urls);
    if (current.length >= CATALOGO_FOTO_MAX_COUNT) {
      return NextResponse.json(
        { error: `Máximo de ${CATALOGO_FOTO_MAX_COUNT} fotos por serviço.` },
        { status: 400 },
      );
    }

    const webpBuffer = await compressCatalogoFotoForStorage(buffer);
    const { publicUrl } = await uploadCatalogoFoto(email, servicoId, webpBuffer);

    const foto_urls = [...current, publicUrl];

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('servicos_catalogo')
      .update({ foto_urls, updated_at: new Date().toISOString() })
      .eq('id', servicoId)
      .eq('owner_email', email)
      .select()
      .single();

    if (updateErr) {
      await removeCatalogoFotoFromStorage(publicUrl);
      throw updateErr;
    }

    return NextResponse.json({ servico: updated, foto_urls });
  } catch (error) {
    console.error('[catalogo/servicos/foto/POST]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao enviar foto') },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const servicoId = new URL(req.url).searchParams.get('servico_id')?.trim();
  const url = new URL(req.url).searchParams.get('url')?.trim();

  if (!servicoId || !url) {
    return NextResponse.json(
      { error: 'servico_id e url são obrigatórios' },
      { status: 400 },
    );
  }

  try {
    const { data: servico, error: fetchErr } = await supabaseAdmin
      .from('servicos_catalogo')
      .select('id, foto_urls')
      .eq('id', servicoId)
      .eq('owner_email', email)
      .single();

    if (fetchErr || !servico) {
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });
    }

    const current = normalizeFotoUrls(servico.foto_urls);
    if (!current.includes(url)) {
      return NextResponse.json({ error: 'Foto não encontrada neste serviço' }, { status: 404 });
    }

    const foto_urls = current.filter((u) => u !== url);

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('servicos_catalogo')
      .update({ foto_urls, updated_at: new Date().toISOString() })
      .eq('id', servicoId)
      .eq('owner_email', email)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await removeCatalogoFotoFromStorage(url);

    return NextResponse.json({ servico: updated, foto_urls });
  } catch (error) {
    console.error('[catalogo/servicos/foto/DELETE]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao remover foto') },
      { status: 500 },
    );
  }
}
