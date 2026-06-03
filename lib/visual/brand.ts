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

/** Paleta provisória (project_summary) — confirmar em /paleta-cores antes de fixar */
export const CORES = {
  primary: '#1B3A4B',
  primaryHover: '#0D9488',
  primaryDark: '#134e4a',
  primaryBg: '#f0fdfa',
  accent: '#D4A574',
  auxiliary: '#06B6D4',
  googleBlue: '#4285F4',
  googleBlueHover: '#3367d6',
  googleGreen: '#34A853',
  bgPage: '#f8fafc',
  bgOnboarding: '#ecfeff',
  /** Hero / animação landing */
  heroAccent: '#40E0D0',
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
};

export type BrandColors = typeof CORES;
