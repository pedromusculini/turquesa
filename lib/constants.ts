// ============================================================
// Constantes centralizadas — Turquesa Agenda
// ============================================================

export const PRODUCT_NAME = 'Turquesa Agenda';
export const PRODUCT_NAME_SHORT = 'Turquesa Agenda';

/** Production site (canonical). Set AUTH_URL / NEXTAUTH_URL to this on Vercel. */
export const CANONICAL_APP_HOST = 'www.turquesaagenda.com.br';
export const CANONICAL_APP_URL = `https://${CANONICAL_APP_HOST}`;

/** Painel admin (sem link no app — acesso direto pela URL). */
export const ADMIN_PANEL_PATH = '/painel-turque-agenda';
export const ADMIN_API_PREFIX = '/api/painel-turque-agenda';

/** OTP por e-mail após login Google (Resend + Supabase verification_codes). */
export const VERIFICATION_CODE_DIGITS = 6;

// === LocalStorage Keys ===
export const STORAGE_KEY_CONSULTATIONS = 'turquesa-agenda-consultations';
export const STORAGE_KEY_FINANCEIRO = 'turquesa-agenda-financeiro';
export const STORAGE_KEY_SESSION_TOKEN = 'session_token';

// === Categorias Financeiras ===
export const CATEGORIAS_ENTRADA = ['consulta', 'procedimento', 'exame', 'outro'] as const;

export const CATEGORIAS_SAIDA = [
  'aluguel',
  'salario',
  'material',
  'marketing',
  'software',
  'imposto',
  'outro',
] as const;

export const TIPOS_ATENDIMENTO = ['consulta', 'retorno', 'exame', 'procedimento', 'outro'] as const;

export const STATUS_ATENDIMENTO = [
  'agendado',
  'confirmado',
  'realizado',
  'cancelado',
  'faltou',
] as const;

export const STATUS_PAGAMENTO = ['pago', 'pendente', 'parcial', 'cancelado'] as const;

export const FORMAS_PAGAMENTO = [
  'pix',
  'dinheiro',
  'cartao_credito',
  'cartao_debito',
  'permuta',
  'convenio',
  'transferencia',
  'outro',
] as const;

export const ATENDIMENTO_LABEL: Record<string, string> = {
  consulta: 'Consulta',
  retorno: 'Retorno',
  exame: 'Exame',
  procedimento: 'Procedimento',
  outro: 'Outro',
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
  faltou: 'Faltou',
  pago: 'Pago',
  pendente: 'Pendente',
  parcial: 'Parcial',
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão crédito',
  cartao_debito: 'Cartão débito',
  convenio: 'Convênio',
  transferencia: 'Transferência',
  permuta: 'Permuta',
};

export const CATEGORIA_LABEL: Record<string, string> = {
  consulta: 'Consulta',
  procedimento: 'Procedimento',
  exame: 'Exame',
  aluguel: 'Aluguel',
  salario: 'Salário',
  material: 'Material',
  marketing: 'Marketing',
  software: 'Software',
  imposto: 'Imposto',
  outro: 'Outro',
};

// === Planos (landing + onboarding) ===
export const PLANOS = {
  ilimitado: {
    nome: 'Turquesa Agenda Ilimitado',
    valor: 79.9,
    periodo: '/mês',
    medicos: 'Profissionais ilimitados',
    descricao: 'Um plano para solo e equipe — profissionais sem limite artificial.',
    destaque: true,
  },
} as const;

export const LANDING_PLANOS = [PLANOS.ilimitado] as const;

/**
 * Cores do app — PROVISÓRIO (Paleta A / project_summary).
 * Cliente escolhe paleta final em /paleta-cores — não alterar definitivamente até confirmação.
 */
export const CORES = {
  primary: '#1B3A4B',
  primaryHover: '#0f766e',
  primaryDark: '#134e4a',
  primaryBg: '#f0fdfa',
  accent: '#D4A574',
  googleBlue: '#4285F4',
  googleBlueHover: '#3367d6',
  googleGreen: '#34A853',
  bgPage: '#f8fafc',
  bgOnboarding: '#ecfeff',
} as const;

// === Utilitários de formatação ===
export function formatCurrency(val: number): string {
  return `R$ ${val.toFixed(2).replace('.', ',')}`;
}

export function aplicarMascaraCNPJ(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '').slice(0, 14);
  let mascara = apenasNumeros;
  if (apenasNumeros.length > 2) mascara = apenasNumeros.slice(0, 2) + '.' + apenasNumeros.slice(2);
  if (apenasNumeros.length > 5) mascara = mascara.slice(0, 6) + '.' + mascara.slice(6);
  if (apenasNumeros.length > 8) mascara = mascara.slice(0, 10) + '/' + mascara.slice(10);
  if (apenasNumeros.length > 12) mascara = mascara.slice(0, 15) + '-' + mascara.slice(15);
  return mascara;
}

export { formatarTelefoneBr as aplicarMascaraWhatsapp } from '@/lib/phoneMatch';

export function validarCNPJ(cnpj: string): boolean {
  const numeros = cnpj.replace(/\D/g, '');
  return numeros.length === 14;
}
