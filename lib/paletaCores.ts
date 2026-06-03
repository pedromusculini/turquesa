/** Paletas para escolha do cliente — ver /paleta-cores */

/** Versão estática em docs/ — compartilhar com cliente (GitHub HTML Preview). */
export const PALETA_CORES_SHARE_URL =
  'https://htmlpreview.github.io/?https://github.com/pedromusculini/turquesa/blob/master/docs/paleta-cores.html';

export type CorPapel = 'primaria' | 'secundaria' | 'destaque' | 'superficie';

export type PaletaOpcao = {
  id: string;
  nome: string;
  descricao: string;
  cores: Record<CorPapel, { hex: string; label: string }>;
};

export const PALETAS_OPCOES: PaletaOpcao[] = [
  {
    id: 'classica-turquesa',
    nome: 'Clássica Turquesa',
    descricao: 'Petróleo sóbrio com turquesa de marca e ocre nos destaques — alinhada ao project_summary.',
    cores: {
      primaria: { hex: '#1B3A4B', label: 'Primária' },
      secundaria: { hex: '#0D9488', label: 'Secundária' },
      destaque: { hex: '#D4A574', label: 'Destaque' },
      superficie: { hex: '#F8FAFC', label: 'Fundo / superfície' },
    },
  },
  {
    id: 'petroleo-ocre',
    nome: 'Petróleo & Ocre',
    descricao: 'Tons profundos de petróleo com acentos ocre quentes — elegante e acolhedor.',
    cores: {
      primaria: { hex: '#1B3A4B', label: 'Primária' },
      secundaria: { hex: '#2C3E50', label: 'Secundária' },
      destaque: { hex: '#CC7722', label: 'Destaque' },
      superficie: { hex: '#F5F0E8', label: 'Fundo / superfície' },
    },
  },
  {
    id: 'ciano-vibrante',
    nome: 'Ciano Vibrante',
    descricao: 'Energia e frescor com ciano em evidência — ideal para CTAs e estados ativos.',
    cores: {
      primaria: { hex: '#0891B2', label: 'Primária' },
      secundaria: { hex: '#06B6D4', label: 'Secundária' },
      destaque: { hex: '#0D9488', label: 'Destaque' },
      superficie: { hex: '#ECFEFF', label: 'Fundo / superfície' },
    },
  },
  {
    id: 'turquesa-aqua',
    nome: 'Turquesa Aqua',
    descricao: 'Marca turquesa luminosa com aqua claro — leve e moderno para salão.',
    cores: {
      primaria: { hex: '#0D9488', label: 'Primária' },
      secundaria: { hex: '#40E0D0', label: 'Secundária' },
      destaque: { hex: '#1B3A4B', label: 'Destaque' },
      superficie: { hex: '#F0FDFA', label: 'Fundo / superfície' },
    },
  },
  {
    id: 'ocre-elegante',
    nome: 'Ocre Elegante',
    descricao: 'Base neutra petróleo com ocre e turquesa pontuais — sofisticado e quente.',
    cores: {
      primaria: { hex: '#2C3E50', label: 'Primária' },
      secundaria: { hex: '#D4A574', label: 'Secundária' },
      destaque: { hex: '#0D9488', label: 'Destaque' },
      superficie: { hex: '#FFFBEB', label: 'Fundo / superfície' },
    },
  },
  {
    id: 'profundo-brilho',
    nome: 'Profundo & Brilho',
    descricao: 'Contraste entre petróleo profundo e cianos brilhantes — dinâmico e tech.',
    cores: {
      primaria: { hex: '#1B3A4B', label: 'Primária' },
      secundaria: { hex: '#06B6D4', label: 'Secundária' },
      destaque: { hex: '#40E0D0', label: 'Destaque' },
      superficie: { hex: '#F1F5F9', label: 'Fundo / superfície' },
    },
  },
];

/** Valores documentados em project_summary.txt (referência até o cliente escolher). */
export const PALETA_PROJETO_ATUAL = {
  titulo: 'Paleta atual do projeto (project_summary)',
  nota: 'Provisória — aguardando escolha do cliente via esta página.',
  cores: {
    primaria: { hex: '#1B3A4B', label: 'Primária (petróleo)' },
    secundaria: { hex: '#0D9488', label: 'Secundária (turquesa)' },
    destaque: { hex: '#D4A574', label: 'Destaque (ocre)' },
    superficie: { hex: '#F8FAFC', label: 'Fundo / superfície' },
    auxiliar: { hex: '#06B6D4', label: 'Auxiliar (ciano — gráficos/hover)' },
  },
} as const;
