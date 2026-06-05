/**
 * Identidade visual Turquesa Agenda — alterar aqui primeiro.
 * Migração gradual: importe BRAND / CORES neste arquivo; evite hex soltos em componentes novos.
 * Sincronize `:root` em app/globals.css quando mudar cores (comentário no final do arquivo).
 */

export const PRODUCT_NAME = 'Turquesa Agenda' as const;
export const PRODUCT_NAME_SHORT = 'Turquesa Agenda' as const;
export const PRODUCT_TAGLINE = 'Gestão para salões e estúdios' as const;

/** Plano único do vertical salão */
export const DEFAULT_PLAN_ID = 'ilimitado' as const;

/** Paleta oficial Turquesa Agenda */
export const CORES = {
  primary: '#047482',
  primaryHover: '#3795a1',
  primaryDark: '#035e6b',
  primaryBg: '#F8FAFC',
  accent: '#c69c6c',
  auxiliary: '#3795a1',
  googleBlue: '#4285F4',
  googleBlueHover: '#3367d6',
  googleGreen: '#34A853',
  bgPage: '#F8FAFC',
  bgOnboarding: '#eef4f5',
  /** Hero / animação landing (fundos claros) */
  heroAccent: '#3795a1',
  /** Texto sobre primary / hero escuro — WCAG ~4.5:1+ em #047482 */
  heroTextOnDark: '#FFFFFF',
  heroTextMutedOnDark: '#D9F0F2',
  /** Dourado claro para rótulos e wordmark sobre teal escuro */
  accentOnDark: '#F2E0C8',
} as const;

export const BRAND = {
  productName: PRODUCT_NAME,
  productNameShort: PRODUCT_NAME_SHORT,
  tagline: PRODUCT_TAGLINE,
  defaultPlanId: DEFAULT_PLAN_ID,
  colors: CORES,
  fonts: {
    sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  radius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    pill: '9999px',
  },
  spacing: {
    pageX: '1.5rem',
    sectionY: '3.5rem',
    cardPad: '2rem',
  },
  copy: {
    trialDays: 30,
    planDisplayName: 'Turquesa Agenda Ilimitado',
    planPriceLabel: 'R$ 79,90/mês',
    googleAgendaTagline: 'Sua agenda profissional conectada ao Google',
  },
} as const;

/** Variáveis CSS — espelhar em app/globals.css :root */
export const BRAND_CSS_VARS: Record<string, string> = {
  '--brand-primary': CORES.primary,
  '--brand-primary-hover': CORES.primaryHover,
  '--brand-primary-dark': CORES.primaryDark,
  '--brand-primary-bg': CORES.primaryBg,
  '--brand-accent': CORES.accent,
  '--brand-auxiliary': CORES.auxiliary,
  '--brand-bg-page': CORES.bgPage,
  '--brand-bg-onboarding': CORES.bgOnboarding,
  '--brand-hero-accent': CORES.heroAccent,
  '--brand-hero-text-on-dark': CORES.heroTextOnDark,
  '--brand-hero-text-muted-on-dark': CORES.heroTextMutedOnDark,
  '--brand-accent-on-dark': CORES.accentOnDark,
};

export type BrandColors = typeof CORES;

/** Paleta para gráficos (donut, barras, linha) — derivada de CORES */
export const CHART_COLORS = [
  CORES.primary,
  CORES.accent,
  CORES.auxiliary,
  CORES.googleGreen,
  '#6b9eb0',
  '#8fbc8f',
  '#d4a574',
  '#5c7cfa',
  '#e07a5f',
  '#81b29a',
] as const;

/** Cores de eventos na agenda (FullCalendar) — variantes da paleta oficial */
export const AGENDA_EVENT_COLORS = {
  nova: { background: '#D9F0F2', border: CORES.primary },
  retorno: { background: '#b8dce3', border: CORES.primaryHover },
  draft: { background: '#fde047', border: '#ca8a04' },
} as const;

/** Monograma LOGO-E (TA em círculo) — paleta / referência */
export const LOGO_E_ICON_PATH =
  '/portfolio-logos/logo-e-monograma-ta.svg' as const;

/** LOGO-CLIENTE-05 — script glam (turquesa + dourado), fundo transparente */
export const LOGO_CLIENTE_05 =
  '/portfolio-logos/logo-cliente-05-transparent.png' as const;

/** Arquivo fonte com fundo claro (paleta / reprocessamento) */
export const LOGO_CLIENTE_05_SOURCE =
  '/portfolio-logos/logo-cliente-05-script-glam-brilho.png' as const;

/** Proporção nativa do PNG cliente-05 (1168×784) */
export const LOGO_CLIENTE_05_ASPECT = 1168 / 784;

/** Cabeçalho, sidebar, botões — monograma LOGO-E (TA em círculo) */
export const LOGO_HEADER_ICON = LOGO_E_ICON_PATH;

/** Wordmark LOGO-CLIENTE-02 (empilhado) — referência / paleta */
export const LOGO_WORDMARK_HEADER_PATH =
  '/portfolio-logos/logo-cliente-02-wordmark-header.svg' as const;

/** @deprecated Use LOGO_HEADER_ICON; mantido para imports legados */
export const LOGO_HEADER_PATH = LOGO_E_ICON_PATH;

/** Hero landing — wordmark profissional serif+sans (SVG, fundo transparente) */
export const LOGO_HERO_PRO =
  '/portfolio-logos/logo-hero-turquesa-agenda-pro.svg' as const;

/** PNG transparente gerado por scripts/process-hero-wordmark.mjs */
export const LOGO_HERO_PRO_PNG =
  '/portfolio-logos/logo-hero-turquesa-agenda-pro-transparent.png' as const;

/** Proporção nativa do wordmark hero (860×240) */
export const LOGO_HERO_ASPECT = 860 / 240;

/** @deprecated Wordmark script glam — substituído por LOGO_HERO_PRO */
export const LOGO_HERO_STACKED =
  '/portfolio-logos/logo-hero-turquesa-agenda-stacked-transparent.png' as const;

/** Hero landing — wordmark sobre fundo teal */
export const LOGO_HERO_PATH = LOGO_HERO_PRO;
