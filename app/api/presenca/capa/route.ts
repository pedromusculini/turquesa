import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireVerifiedOwner } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import {
  LANDING_CAPA_MIME_TYPES,
  validateLandingCapaBuffer,
} from '@/lib/salonLandingCapa';
import {
  compressLandingCapaForStorage,
  removeLandingCapaFromStorage,
  uploadLandingCapa,
} from '@/lib/salonLandingCapaStorage';
import { checkRateLimit } from '@/lib/rateLimit';
import { parseLandingConfig } from '@/lib/salonLanding';

export async function POST(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const rl = checkRateLimit(`presenca-capa:${email}`, 12, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitos envios. Aguarde alguns minutos.' }, { status: 429 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de imagem é obrigatório' }, { status: 400 });
    }

    const mime = file.type;
    if (
      mime &&
      !(LANDING_CAPA_MIME_TYPES as readonly string[]).includes(mime) &&
      mime !== 'application/octet-stream'
    ) {
      return NextResponse.json({ error: 'Use JPEG, PNG, WebP ou HEIC.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateLandingCapaBuffer(buffer, mime);
    if (validation) {
      return NextResponse.json({ error: validation }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('landing_capa_webp_url')
      .eq('email', email)
      .maybeSingle();

    let webpBuffer: Buffer;
    try {
      webpBuffer = await compressLandingCapaForStorage(buffer);
    } catch {
      return NextResponse.json(
        { error: 'Não foi possível converter a foto. Tente JPEG ou PNG.' },
        { status: 400 },
      );
    }

    const { publicUrl } = await uploadLandingCapa(email, webpBuffer);
    const previous = parseLandingConfig(profile ?? undefined).capaUrl;

    const { error } = await supabaseAdmin
      .from('onboarding_profiles')
      .update({ landing_capa_webp_url: publicUrl })
      .eq('email', email);

    if (error) {
      await removeLandingCapaFromStorage(publicUrl);
      throw error;
    }

    if (previous && previous !== publicUrl) {
      await removeLandingCapaFromStorage(previous);
    }

    return NextResponse.json({ capaUrl: publicUrl });
  } catch (error) {
    console.error('[presenca/capa/POST]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao enviar a capa') },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('landing_capa_webp_url')
      .eq('email', email)
      .maybeSingle();

    const current = parseLandingConfig(profile ?? undefined).capaUrl;
    const { error } = await supabaseAdmin
      .from('onboarding_profiles')
      .update({ landing_capa_webp_url: null })
      .eq('email', email);
    if (error) throw error;
    if (current) await removeLandingCapaFromStorage(current);
    return NextResponse.json({ capaUrl: null });
  } catch (error) {
    console.error('[presenca/capa/DELETE]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao remover a capa') },
      { status: 500 },
    );
  }
}
