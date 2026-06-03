/** Portfólio de marca — ver /paleta-cores e docs/paleta-cores.html */

/** Versão estática em docs/ — compartilhar com cliente (GitHub HTML Preview). */
export const PALETA_CORES_SHARE_URL =
  'https://htmlpreview.github.io/?https://github.com/pedromusculini/turquesa/blob/master/docs/paleta-cores.html';

export type CorPapel = 'primaria' | 'secundaria' | 'destaque' | 'superficie';

export type PaletaOpcao = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  vertical: string;
  cores: Record<CorPapel, { hex: string; label: string }>;
};

export type IconPackOpcao = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  vertical: string;
  estilo: string;
  /** Emojis ou rótulos dos ícones de preview */
  icones: string[];
};

export type LogoVarianteOpcao = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  vertical: string;
  tratamento: 'serif-elegante' | 'sans-moderno' | 'script-luxo' | 'stacked' | 'monograma';
};

/** 5 paletas curadas — salão, manicure, lash, harmonização facial */
export const PALETAS_OPCOES: PaletaOpcao[] = [
  {
    id: 'classica-turquesa',
    codigo: 'PALETA-A',
    nome: 'Clássica Turquesa',
    vertical: 'Salão completo · marca Turquesa Agenda',
    descricao:
      'Petróleo sóbrio com turquesa de marca e ocre nos destaques — equilíbrio profissional e acolhedor.',
    cores: {
      primaria: { hex: '#1B3A4B', label: 'Primária' },
      secundaria: { hex: '#0D9488', label: 'Secundária' },
      destaque: { hex: '#D4A574', label: 'Destaque' },
      superficie: { hex: '#F8FAFC', label: 'Fundo / superfície' },
    },
  },
  {
    id: 'blush-rose-gold',
    codigo: 'PALETA-B',
    nome: 'Blush & Rose Gold',
    vertical: 'Manicure · nail art · luxo suave',
    descricao:
      'Blush e rose gold com carvão para leitura — tendência beauty 2025–2026, feminino e premium.',
    cores: {
      primaria: { hex: '#2D2A32', label: 'Primária' },
      secundaria: { hex: '#B76E79', label: 'Secundária' },
      destaque: { hex: '#F4C2C2', label: 'Destaque' },
      superficie: { hex: '#FFF8F6', label: 'Fundo / superfície' },
    },
  },
  {
    id: 'turquesa-blush',
    codigo: 'PALETA-C',
    nome: 'Turquesa Blush',
    vertical: 'Salão colorido · manicure + cabelo',
    descricao: 'Duo turquesa + blush — fresco e moderno, ideal para CTAs e redes sociais.',
    cores: {
      primaria: { hex: '#0D9488', label: 'Primária' },
      secundaria: { hex: '#E8B4B8', label: 'Secundária' },
      destaque: { hex: '#1B3A4B', label: 'Destaque' },
      superficie: { hex: '#FFF0F5', label: 'Fundo / superfície' },
    },
  },
  {
    id: 'lavanda-spa',
    codigo: 'PALETA-D',
    nome: 'Lavanda Spa',
    vertical: 'Harmonização facial · spa · skincare',
    descricao: 'Lavanda e pêssego suaves — calma, confiança e sofisticação para tratamentos faciais.',
    cores: {
      primaria: { hex: '#5C4D6E', label: 'Primária' },
      secundaria: { hex: '#C9A0A0', label: 'Secundária' },
      destaque: { hex: '#E6E6FA', label: 'Destaque' },
      superficie: { hex: '#FAF8FF', label: 'Fundo / superfície' },
    },
  },
  {
    id: 'champagne-lash',
    codigo: 'PALETA-E',
    nome: 'Champagne Lash',
    vertical: 'Lash design · brow · estúdio noturno elegante',
    descricao: 'Champagne e mauve sobre base escura — glamour discreto para lash e brow studios.',
    cores: {
      primaria: { hex: '#2C1810', label: 'Primária' },
      secundaria: { hex: '#D4AF37', label: 'Secundária' },
      destaque: { hex: '#C48B9F', label: 'Destaque' },
      superficie: { hex: '#FDF6EC', label: 'Fundo / superfície' },
    },
  },
];

/** 5 packs de ícones — estilos distintos para o app */
export const ICON_PACKS_OPCOES: IconPackOpcao[] = [
  {
    id: 'emoji-spa',
    codigo: 'ICON-A',
    nome: 'Spa Emoji',
    estilo: 'Emoji',
    vertical: 'Salão geral · acolhedor',
    descricao: 'Conjunto emoji quente e universal — rápido de reconhecer em mobile.',
    icones: ['💅', '✨', '🌸', '💆', '🦋'],
  },
  {
    id: 'lucide-minimal',
    codigo: 'ICON-B',
    nome: 'Lucide Minimal',
    estilo: 'Lucide',
    vertical: 'Agenda profissional',
    descricao: 'Linhas finas: tesoura, calendário, sparkle, usuários, carteira.',
    icones: ['Scissors', 'Calendar', 'Sparkles', 'Users', 'Wallet'],
  },
  {
    id: 'lash-glam',
    codigo: 'ICON-C',
    nome: 'Lash Glam',
    estilo: 'SVG inline',
    vertical: 'Lash & brow',
    descricao: 'Olho estilizado, cílios, sparkle e coração — foco em extensão de cílios.',
    icones: ['lash', 'sparkle', 'heart', 'star', 'eye'],
  },
  {
    id: 'nail-studio',
    codigo: 'ICON-D',
    nome: 'Nail Studio',
    estilo: 'SVG inline',
    vertical: 'Manicure',
    descricao: 'Unha, pincel, flor e brilho — identidade nail art.',
    icones: ['nail', 'brush', 'flower', 'gem', 'hand'],
  },
  {
    id: 'floral-elegance',
    codigo: 'ICON-E',
    nome: 'Floral Elegance',
    estilo: 'SVG inline',
    vertical: 'Harmonização · spa',
    descricao: 'Flor, folha, gota e sol suave — organic beauty e bem-estar.',
    icones: ['flower', 'leaf', 'droplet', 'sun', 'feather'],
  },
];

/** 5 wordmarks — tipografia Turquesa Agenda */
export const LOGO_VARIANTES_OPCOES: LogoVarianteOpcao[] = [
  {
    id: 'serif-elegante',
    codigo: 'LOGO-A',
    nome: 'Serif Elegante',
    tratamento: 'serif-elegante',
    vertical: 'Salão clássico',
    descricao: 'Serifas delicadas, “Agenda” em turquesa — salão de alto padrão.',
  },
  {
    id: 'sans-moderno',
    codigo: 'LOGO-B',
    nome: 'Sans Moderno',
    tratamento: 'sans-moderno',
    vertical: 'Estúdio contemporâneo',
    descricao: 'Geometric sans, tracking amplo — clean para manicure e lash.',
  },
  {
    id: 'script-luxo',
    codigo: 'LOGO-C',
    nome: 'Script Luxo',
    tratamento: 'script-luxo',
    vertical: 'Harmonização · bridal',
    descricao: '“Turquesa” em script rose gold, “Agenda” discreta — luxo feminino.',
  },
  {
    id: 'stacked',
    codigo: 'LOGO-D',
    nome: 'Empilhado',
    tratamento: 'stacked',
    vertical: 'Avatar · favicon · redes',
    descricao: 'Duas linhas centradas — forte em quadrado e stories.',
  },
  {
    id: 'monograma-ta',
    codigo: 'LOGO-E',
    nome: 'Monograma TA',
    tratamento: 'monograma',
    vertical: 'Ícone de app',
    descricao: 'Monograma TA em círculo turquesa — app e notificações.',
  },
];

/** Valores documentados em project_summary.txt (referência até o cliente escolher). */
export const PALETA_PROJETO_ATUAL = {
  titulo: 'Paleta atual do projeto (project_summary)',
  nota: 'Provisória — aguardando escolha do cliente via esta página (códigos PALETA-*, LOGO-*, ICON-*).',
  cores: {
    primaria: { hex: '#1B3A4B', label: 'Primária (petróleo)' },
    secundaria: { hex: '#0D9488', label: 'Secundária (turquesa)' },
    destaque: { hex: '#D4A574', label: 'Destaque (ocre)' },
    superficie: { hex: '#F8FAFC', label: 'Fundo / superfície' },
    auxiliar: { hex: '#06B6D4', label: 'Auxiliar (ciano — gráficos/hover)' },
  },
} as const;
