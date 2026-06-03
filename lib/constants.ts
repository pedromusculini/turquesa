// ============================================================
// Constantes centralizadas do MedSupApp
// ============================================================

/** Production site (canonical). Set AUTH_URL / NEXTAUTH_URL to this on Vercel. */
export const CANONICAL_APP_HOST = 'www.medsupapp.com.br';
export const CANONICAL_APP_URL = `https://${CANONICAL_APP_HOST}`;

/** Painel admin (sem link no app — acesso direto pela URL). */
export const ADMIN_PANEL_PATH = '/naomexaaquiseucorno';
export const ADMIN_API_PREFIX = '/api/naomexaaquiseucorno';

/** OTP por e-mail após login Google (Resend + Supabase verification_codes). */
export const VERIFICATION_CODE_DIGITS = 6;

// === LocalStorage Keys ===
export const STORAGE_KEY_CONSULTATIONS = 'medsupapp-consultations';
export const STORAGE_KEY_FINANCEIRO = 'medsupapp-financeiro';
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
  'medico-pix': {
    nome: 'Médico Solo',
    valor: 119,
    periodo: '/mês',
    medicos: '1 profissional',
    descricao: 'Consultório individual com Google integrado.',
    destaque: false,
  },
  'clinica-5-pix': {
    nome: 'Clínica 2 a 5',
    valor: 390,
    periodo: '/mês',
    medicos: '2 a 5 médicos',
    descricao: 'Equipe pequena, mesma privacidade e LGPD.',
    destaque: true,
  },
  'clinica-10-pix': {
    nome: 'Clínica 6 a 10',
    valor: 449,
    periodo: '/mês',
    medicos: '6 a 10 médicos',
    descricao: 'Crescimento com controle e dados na sua nuvem.',
    destaque: false,
  },
} as const;

export const LANDING_PLANOS = [
  PLANOS['medico-pix'],
  PLANOS['clinica-5-pix'],
  PLANOS['clinica-10-pix'],
] as const;

// === Cores do App ===
export const CORES = {
  primary: '#90EE90',
  primaryHover: '#7ad47a',
  primaryDark: '#2d652d',
  primaryBg: '#f4fff4',
  googleBlue: '#4285F4',
  googleBlueHover: '#3367d6',
  googleGreen: '#34A853',
  bgPage: '#f8f9fa',
  bgOnboarding: '#eafde7',
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
