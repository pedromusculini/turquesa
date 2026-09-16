import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseClient';
import { generateSlugBase, getSlugByOwner, loadOwnerProfile, enderecoVarsFromProfile } from '@/lib/agendamento';
import { ensureAutocadastroLink, getActiveAutocadastroLink } from '@/lib/formularioLinks';
import { loadMedicosPublicos } from '@/lib/medicosPublicos';
import { buildCatalogoPublicPath, buildFormularioPublicPath } from '@/lib/publicFormLinks';
import {
  getAgendarLandingPath,
  getSalaoLandingPath,
  isPublicLandingSlug,
  landingWhatsAppUrl,
  parseLandingConfig,
  type LandingConfig,
  type LandingPublicData,
} from '@/lib/salonLanding';

export function getSalaoLandingPublicUrl(slug: string): string {
  return getSalaoLandingPath(slug);
}

export async function ensureSalaoPublicSlug(ownerEmail: string): Promise<{
  slug: string;
  nome_exibicao: string;
}> {
  const owner = ownerEmail.toLowerCase().trim();
  const existing = await getSlugByOwner(owner);
  if (existing?.slug) {
    return {
      slug: existing.slug as string,
      nome_exibicao: (existing.nome_exibicao as string) || 'Salão',
    };
  }

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('clinic_name, full_name')
    .eq('email', owner)
    .maybeSingle();

  const nomeExibicao = profile?.clinic_name || profile?.full_name || 'Salão';
  const slug = generateSlugBase(nomeExibicao);

  const { data, error } = await supabaseAdmin
    .from('agendamento_slugs')
    .upsert(
      {
        owner_email: owner,
        slug,
        nome_exibicao: nomeExibicao,
        ativo: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_email' },
    )
    .select('slug, nome_exibicao')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Não foi possível gerar o link do site');
  }

  return { slug: data.slug as string, nome_exibicao: data.nome_exibicao as string };
}

export async function loadLandingPublicBySlug(
  slug: string,
): Promise<LandingPublicData | null> {
  if (!isPublicLandingSlug(slug)) return null;

  const { data: slugRow } = await supabaseAdmin
    .from('agendamento_slugs')
    .select('owner_email, slug, nome_exibicao, ativo')
    .eq('slug', slug.toLowerCase().trim())
    .eq('ativo', true)
    .maybeSingle();

  if (!slugRow) return null;

  const profile = await loadOwnerProfile(slugRow.owner_email as string);
  if (!profile) return null;

  const config = parseLandingConfig(profile);
  if (!config.publicada) return null;

  return assembleLandingPublic(slugRow.owner_email as string, slugRow.slug as string, {
    nomeExibicao: (slugRow.nome_exibicao as string) || '',
    profile,
    config,
    createMissingLinks: false,
  });
}

export async function assembleLandingPublic(
  ownerEmail: string,
  slug: string,
  opts: {
    nomeExibicao: string;
    profile: Record<string, unknown>;
    config: LandingConfig;
    createMissingLinks?: boolean;
  },
): Promise<LandingPublicData> {
  const nome =
    opts.nomeExibicao.trim() ||
    String(opts.profile.clinic_name ?? '').trim() ||
    String(opts.profile.full_name ?? '').trim() ||
    'Salão';

  const endereco = enderecoVarsFromProfile(opts.profile);
  const { medicos } = await loadMedicosPublicos(ownerEmail);

  let cadastroUrl: string | null = null;
  let catalogoUrl: string | null = null;
  let catalogoToken: string | null = null;
  try {
    const auto = opts.createMissingLinks
      ? await ensureAutocadastroLink(ownerEmail, nome)
      : await getActiveAutocadastroLink(ownerEmail);
    const token = auto?.token as string | undefined;
    if (token) {
      catalogoToken = token;
      cadastroUrl = buildFormularioPublicPath(token);
      catalogoUrl = buildCatalogoPublicPath(token);
    }
  } catch (err) {
    console.warn('[salon-landing] autocadastro', err);
  }

  return {
    ...opts.config,
    slug,
    nome,
    endereco: endereco.local,
    mapsUrl: endereco.link_maps,
    urls: {
      site: getSalaoLandingPath(slug),
      agendar: getAgendarLandingPath(slug),
      cadastro: cadastroUrl,
      catalogo: catalogoUrl,
      whatsapp: landingWhatsAppUrl(opts.profile.whatsapp),
    },
    catalogoToken,
    equipe: medicos.map((m) => ({
      nome: m.nome,
      specialty: m.specialty,
    })),
  };
}
