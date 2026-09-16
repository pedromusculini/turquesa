import { isValidPhone } from '@/lib/phoneMatch';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

export const LANDING_ESTILOS = ['editorial', 'vidro', 'atelie'] as const;
export type LandingEstilo = (typeof LANDING_ESTILOS)[number];

export const LANDING_PALETAS = [
  'turquesa',
  'areia',
  'noite',
  'azul',
  'verde',
  'amarelo',
  'rosa',
] as const;
export type LandingPaleta = (typeof LANDING_PALETAS)[number];

export type LandingBlocos = {
  agendar: boolean;
  cadastro: boolean;
  catalogo: boolean;
  equipe: boolean;
  endereco: boolean;
  experiencia: boolean;
  whatsapp: boolean;
};

export type LandingConfig = {
  estilo: LandingEstilo;
  paleta: LandingPaleta;
  capaUrl: string | null;
  tituloHero: string;
  textoExperiencia: string;
  blocos: LandingBlocos;
  publicada: boolean;
};

export type LandingPublicEquipe = {
  nome: string;
  specialty: string | null;
};

export type LandingPublicData = LandingConfig & {
  slug: string;
  nome: string;
  endereco: string;
  mapsUrl: string;
  urls: {
    site: string;
    agendar: string;
    cadastro: string | null;
    catalogo: string | null;
    whatsapp: string | null;
  };
  catalogoToken: string | null;
  equipe: LandingPublicEquipe[];
};

export const LANDING_ESTILO_META: {
  id: LandingEstilo;
  nome: string;
  resumo: string;
}[] = [
  {
    id: 'editorial',
    nome: 'Editorial',
    resumo: 'Capa ampla, texto da dona em destaque, catálogo em lista.',
  },
  {
    id: 'vidro',
    nome: 'Studio vidro',
    resumo: 'Painel translúcido sobre a foto. CTAs flutuam sem competir com a capa.',
  },
  {
    id: 'atelie',
    nome: 'Ateliê',
    resumo: 'Foto numa coluna e ficha na outra — compacto no celular.',
  },
];

export type LandingPaletaMeta = {
  id: LandingPaleta;
  nome: string;
  swatch: string;
  ink: string;
  muted: string;
  brand: string;
  brand2: string;
  accent: string;
  surface: string;
  bg: string;
  glass: string;
  stroke: string;
  btnOnBrand: string;
};

export const LANDING_PALETA_META: Record<LandingPaleta, LandingPaletaMeta> = {
  turquesa: {
    id: 'turquesa',
    nome: 'Turquesa',
    swatch: '#047482',
    ink: '#0c3d44',
    muted: '#4d6b70',
    brand: '#047482',
    brand2: '#3795a1',
    accent: '#c69c6c',
    surface: '#f8fafc',
    bg: '#e8f2f3',
    glass: 'rgba(248, 250, 252, 0.42)',
    stroke: 'rgba(4, 116, 130, 0.18)',
    btnOnBrand: '#ffffff',
  },
  areia: {
    id: 'areia',
    nome: 'Areia',
    swatch: '#c69c6c',
    ink: '#3a2718',
    muted: '#7a5c42',
    brand: '#8b5a2b',
    brand2: '#c69c6c',
    accent: '#e2c39a',
    surface: '#faf6f0',
    bg: '#f3eadf',
    glass: 'rgba(255, 248, 238, 0.46)',
    stroke: 'rgba(139, 90, 43, 0.2)',
    btnOnBrand: '#ffffff',
  },
  noite: {
    id: 'noite',
    nome: 'Noite',
    swatch: '#1b2430',
    ink: '#f4efe8',
    muted: '#b7c4c6',
    brand: '#c69c6c',
    brand2: '#7eb8c2',
    accent: '#3795a1',
    surface: '#12161a',
    bg: '#0b0d10',
    glass: 'rgba(18, 22, 26, 0.48)',
    stroke: 'rgba(198, 156, 108, 0.28)',
    btnOnBrand: '#12161a',
  },
  azul: {
    id: 'azul',
    nome: 'Azul',
    swatch: '#1d4e89',
    ink: '#102a44',
    muted: '#4a6580',
    brand: '#1d4e89',
    brand2: '#3b82c4',
    accent: '#7eb6d9',
    surface: '#f3f8fc',
    bg: '#e7f0f8',
    glass: 'rgba(243, 248, 252, 0.46)',
    stroke: 'rgba(29, 78, 137, 0.2)',
    btnOnBrand: '#ffffff',
  },
  verde: {
    id: 'verde',
    nome: 'Verde',
    swatch: '#2d6a4f',
    ink: '#143528',
    muted: '#4d6b5e',
    brand: '#2d6a4f',
    brand2: '#52b788',
    accent: '#95d5b2',
    surface: '#f3faf6',
    bg: '#e7f4ec',
    glass: 'rgba(243, 250, 246, 0.46)',
    stroke: 'rgba(45, 106, 79, 0.2)',
    btnOnBrand: '#ffffff',
  },
  amarelo: {
    id: 'amarelo',
    nome: 'Amarelo',
    swatch: '#c9a227',
    ink: '#3d3208',
    muted: '#7a6a32',
    brand: '#b8860b',
    brand2: '#d4a017',
    accent: '#f0d78c',
    surface: '#fffbf0',
    bg: '#f7f1dc',
    glass: 'rgba(255, 251, 240, 0.5)',
    stroke: 'rgba(184, 134, 11, 0.22)',
    btnOnBrand: '#1a1404',
  },
  rosa: {
    id: 'rosa',
    nome: 'Rosa',
    swatch: '#b76e79',
    ink: '#4a2430',
    muted: '#8a5a66',
    brand: '#b76e79',
    brand2: '#d4a0a8',
    accent: '#f2c9d0',
    surface: '#fff7f8',
    bg: '#faeef0',
    glass: 'rgba(255, 247, 248, 0.5)',
    stroke: 'rgba(183, 110, 121, 0.22)',
    btnOnBrand: '#ffffff',
  },
};

export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  estilo: 'vidro',
  paleta: 'turquesa',
  capaUrl: null,
  tituloHero: '',
  textoExperiencia: '',
  blocos: {
    agendar: true,
    cadastro: true,
    catalogo: true,
    equipe: true,
    endereco: true,
    experiencia: false,
    whatsapp: true,
  },
  publicada: true,
};

export const LANDING_TEXTO_PADRAO =
  'Atendimento sem pressa. Você escolhe o horário; a gente continua com as mãos no serviço.';

export const LANDING_WHATSAPP_MENSAGEM =
  'Olá! Vim do seu site e quero falar com um atendente.';

export function landingWhatsAppUrl(phoneRaw: unknown): string | null {
  const raw = typeof phoneRaw === 'string' ? phoneRaw.trim() : '';
  if (!raw || !isValidPhone(raw)) return null;
  return buildWhatsAppUrl(raw, LANDING_WHATSAPP_MENSAGEM);
}

export function isLandingEstilo(value: unknown): value is LandingEstilo {
  return typeof value === 'string' && (LANDING_ESTILOS as readonly string[]).includes(value);
}

export function isLandingPaleta(value: unknown): value is LandingPaleta {
  return typeof value === 'string' && (LANDING_PALETAS as readonly string[]).includes(value);
}

export function sanitizeLandingTexto(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, 2000);
}

export function sanitizeLandingTitulo(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function isPublicLandingSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug);
}

export function isSafeLandingCapaUrl(url: string | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : '';
    if (supabaseHost && parsed.hostname !== supabaseHost) return false;
    return (
      parsed.pathname.includes('/storage/v1/object/public/catalogo-fotos/') &&
      parsed.pathname.includes('/landing/')
    );
  } catch {
    return false;
  }
}

export function parseLandingConfig(row: Record<string, unknown> | null | undefined): LandingConfig {
  const blocos: LandingBlocos = {
    agendar: row?.landing_bloco_agendar !== false,
    cadastro: row?.landing_bloco_cadastro !== false,
    catalogo: row?.landing_bloco_catalogo !== false,
    equipe: row?.landing_bloco_equipe !== false,
    endereco: row?.landing_bloco_endereco !== false,
    experiencia: row?.landing_bloco_experiencia === true,
    whatsapp: row?.landing_bloco_whatsapp !== false,
  };
  return {
    estilo: isLandingEstilo(row?.landing_estilo) ? row.landing_estilo : DEFAULT_LANDING_CONFIG.estilo,
    paleta: isLandingPaleta(row?.landing_paleta) ? row.landing_paleta : DEFAULT_LANDING_CONFIG.paleta,
    capaUrl:
      typeof row?.landing_capa_webp_url === 'string' && isSafeLandingCapaUrl(row.landing_capa_webp_url.trim())
        ? row.landing_capa_webp_url.trim()
        : null,
    tituloHero:
      typeof row?.landing_titulo_hero === 'string' ? sanitizeLandingTitulo(row.landing_titulo_hero) : '',
    textoExperiencia:
      typeof row?.landing_texto_experiencia === 'string'
        ? sanitizeLandingTexto(row.landing_texto_experiencia)
        : '',
    blocos,
    publicada: row?.landing_publicada !== false,
  };
}

export function landingConfigToColumns(config: LandingConfig): Record<string, unknown> {
  return {
    landing_estilo: config.estilo,
    landing_paleta: config.paleta,
    landing_capa_webp_url: config.capaUrl,
    landing_titulo_hero: config.tituloHero,
    landing_texto_experiencia: config.textoExperiencia,
    landing_bloco_agendar: config.blocos.agendar,
    landing_bloco_cadastro: config.blocos.cadastro,
    landing_bloco_catalogo: config.blocos.catalogo,
    landing_bloco_equipe: config.blocos.equipe,
    landing_bloco_endereco: config.blocos.endereco,
    landing_bloco_experiencia: config.blocos.experiencia,
    landing_bloco_whatsapp: config.blocos.whatsapp,
    landing_publicada: config.publicada,
  };
}

export function paletteCssVars(paleta: LandingPaleta): Record<string, string> {
  const p = LANDING_PALETA_META[paleta];
  return {
    '--lp-ink': p.ink,
    '--lp-muted': p.muted,
    '--lp-brand': p.brand,
    '--lp-brand-2': p.brand2,
    '--lp-accent': p.accent,
    '--lp-surface': p.surface,
    '--lp-bg': p.bg,
    '--lp-glass': p.glass,
    '--lp-stroke': p.stroke,
    '--lp-btn': p.btnOnBrand,
  };
}

export function getSalaoLandingPath(slug: string): string {
  return `/s/${slug}`;
}

export function getAgendarLandingPath(slug: string): string {
  return `/agendar/${slug}`;
}

/** Path interno (mesmo host do Turquesa). Aceita path ou URL absoluta. */
export function landingAppPath(urlOrPath: string): string {
  const raw = urlOrPath.trim();
  if (!raw) return raw;
  if (raw.startsWith('/')) return raw;
  try {
    const parsed = new URL(raw);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
  } catch {
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
}

export function landingUrlOnCurrentOrigin(urlOrPath: string): string {
  const path = landingAppPath(urlOrPath);
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}
