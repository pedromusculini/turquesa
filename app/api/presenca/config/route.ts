import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireVerifiedOwner } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseErrorMessage } from '@/lib/supabaseErrors';
import {
  isLandingEstilo,
  isLandingPaleta,
  landingConfigToColumns,
  parseLandingConfig,
  sanitizeLandingTexto,
  type LandingBlocos,
  type LandingConfig,
} from '@/lib/salonLanding';
import {
  assembleLandingPublic,
  ensureSalaoPublicSlug,
} from '@/lib/salonLandingServer';

function parseBlocos(raw: unknown, current: LandingBlocos): LandingBlocos {
  if (!raw || typeof raw !== 'object') return current;
  const src = raw as Record<string, unknown>;
  const pick = (key: keyof LandingBlocos) =>
    typeof src[key] === 'boolean' ? (src[key] as boolean) : current[key];
  return {
    agendar: pick('agendar'),
    cadastro: pick('cadastro'),
    catalogo: pick('catalogo'),
    equipe: pick('equipe'),
    endereco: pick('endereco'),
    experiencia: pick('experiencia'),
  };
}

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const slugInfo = await ensureSalaoPublicSlug(email);
    const { data: profile, error } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    const config = parseLandingConfig(profile ?? undefined);
    const publicData = await assembleLandingPublic(email, slugInfo.slug, {
      nomeExibicao: slugInfo.nome_exibicao,
      profile: (profile ?? {}) as Record<string, unknown>,
      config,
      createMissingLinks: true,
    });

    return NextResponse.json({ config, public: publicData });
  } catch (error) {
    console.error('[presenca/config/GET]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao carregar o site do salão') },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { data: currentRow } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!currentRow) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    const current = parseLandingConfig(currentRow);
    const next: LandingConfig = {
      estilo: isLandingEstilo(body.estilo) ? body.estilo : current.estilo,
      paleta: isLandingPaleta(body.paleta) ? body.paleta : current.paleta,
      capaUrl: current.capaUrl,
      textoExperiencia:
        typeof body.textoExperiencia === 'string'
          ? sanitizeLandingTexto(body.textoExperiencia)
          : current.textoExperiencia,
      blocos: parseBlocos(body.blocos, current.blocos),
      publicada: typeof body.publicada === 'boolean' ? body.publicada : current.publicada,
    };

    const { error } = await supabaseAdmin
      .from('onboarding_profiles')
      .update(landingConfigToColumns(next))
      .eq('email', email);

    if (error) throw error;

    const slugInfo = await ensureSalaoPublicSlug(email);
    const publicData = await assembleLandingPublic(email, slugInfo.slug, {
      nomeExibicao: slugInfo.nome_exibicao,
      profile: { ...currentRow, ...landingConfigToColumns(next) },
      config: next,
      createMissingLinks: true,
    });

    return NextResponse.json({ config: next, public: publicData });
  } catch (error) {
    console.error('[presenca/config/PUT]', error);
    return NextResponse.json(
      { error: supabaseErrorMessage(error, 'Erro ao salvar o site do salão') },
      { status: 500 },
    );
  }
}
