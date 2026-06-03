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
  /** Emojis, rótulos Lucide ou chaves SVG de preview */
  icones: string[];
  /** Uso recomendado para o cliente */
  uso: 'favicon + botões';
  /** Snippet SVG (favicon) ou emoji para favicon via PNG/gerador */
  faviconHint: string;
  faviconTipo: 'svg' | 'emoji';
};

export type LogoTratamento =
  | 'serif-elegante'
  | 'sans-moderno'
  | 'script-luxo'
  | 'stacked'
  | 'monograma'
  | 'display-luxo'
  | 'condensed-bold'
  | 'italic-glam'
  | 'underline-accent'
  | 'blush-gradient'
  | 'caps-lockup'
  | 'circle-badge'
  | 'split-color'
  | 'handwritten-duo'
  | 'diamond-wordmark';

export type LogoVarianteOpcao = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  vertical: string;
  tratamento: LogoTratamento;
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

const FAVICON_SVG_SPARKLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0D9488"/><path fill="#fff" d="M16 6l1.2 3.6L21 11l-3.6 1.2L16 16l-1.2-3.6L11 11l3.6-1.2L16 6z"/></svg>';

/** 15 packs de ícones — favicon + botões do app */
export const ICON_PACKS_OPCOES: IconPackOpcao[] = [
  {
    id: 'emoji-spa',
    codigo: 'ICON-A',
    nome: 'Spa Emoji',
    estilo: 'Emoji',
    vertical: 'Salão geral · acolhedor',
    descricao: 'Conjunto emoji quente e universal — rápido de reconhecer em mobile.',
    icones: ['💅', '✨', '🌸', '💆', '🦋'],
    uso: 'favicon + botões',
    faviconTipo: 'emoji',
    faviconHint: '💅',
  },
  {
    id: 'lucide-minimal',
    codigo: 'ICON-B',
    nome: 'Lucide Minimal',
    estilo: 'Lucide',
    vertical: 'Agenda profissional',
    descricao: 'Linhas finas: tesoura, calendário, sparkle, usuários, carteira.',
    icones: ['Scissors', 'Calendar', 'Sparkles', 'Users', 'Wallet'],
    uso: 'favicon + botões',
    faviconTipo: 'svg',
    faviconHint:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#0D9488" stroke-width="2"><path d="M10 20l4-8 4 8M8 12h16"/></svg>',
  },
  {
    id: 'lash-glam',
    codigo: 'ICON-C',
    nome: 'Lash Glam',
    estilo: 'SVG inline',
    vertical: 'Lash & brow',
    descricao: 'Olho estilizado, cílios, sparkle e coração — foco em extensão de cílios.',
    icones: ['lash', 'sparkle', 'heart', 'star', 'eye'],
    uso: 'favicon + botões',
    faviconTipo: 'svg',
    faviconHint:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#0D9488" stroke-width="1.5"><ellipse cx="16" cy="17" rx="9" ry="5"/><path d="M11 15V9M14 14V7M16 13V6M18 14V7M21 15V9"/></svg>',
  },
  {
    id: 'nail-studio',
    codigo: 'ICON-D',
    nome: 'Nail Studio',
    estilo: 'SVG inline',
    vertical: 'Manicure',
    descricao: 'Unha, pincel, flor e brilho — identidade nail art.',
    icones: ['nail', 'brush', 'flower', 'gem', 'hand'],
    uso: 'favicon + botões',
    faviconTipo: 'svg',
    faviconHint:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#B76E79" stroke-width="1.5"><path d="M12 26c0-6 2-12 4-14s4 2 4 14"/></svg>',
  },
  {
    id: 'floral-elegance',
    codigo: 'ICON-E',
    nome: 'Floral Elegance',
    estilo: 'SVG inline',
    vertical: 'Harmonização · spa',
    descricao: 'Flor, folha, gota e sol suave — organic beauty e bem-estar.',
    icones: ['flower', 'leaf', 'droplet', 'sun', 'feather'],
    uso: 'favicon + botões',
    faviconTipo: 'svg',
    faviconHint:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#5C4D6E" stroke-width="1.5"><circle cx="16" cy="16" r="3" fill="#C9A0A0"/><path d="M16 8v4M16 20v4M8 16h4M20 16h4"/></svg>',
  },
  {
    id: 'brow-lash-duo',
    codigo: 'ICON-F',
    nome: 'Brow & Lash',
    estilo: 'Emoji',
    vertical: 'Design de sobrancelha · lash',
    descricao: 'Sobrancelha, cílios e espelho — estúdio brow + lash.',
    icones: ['👁', '✏️', '💫', '🪞', '💖'],
    uso: 'favicon + botões',
    faviconTipo: 'emoji',
    faviconHint: '👁',
  },
  {
    id: 'harmonizacao-spa',
    codigo: 'ICON-G',
    nome: 'Harmonização Spa',
    estilo: 'Emoji',
    vertical: 'Harmonização facial',
    descricao: 'Rosto sereno, gotas e folhas — skincare e procedimentos faciais.',
    icones: ['🧖', '💧', '🌿', '✨', '😌'],
    uso: 'favicon + botões',
    faviconTipo: 'emoji',
    faviconHint: '🧖',
  },
  {
    id: 'diamond-luxury',
    codigo: 'ICON-H',
    nome: 'Diamond Luxury',
    estilo: 'SVG inline',
    vertical: 'Nail art premium · lash glam',
    descricao: 'Diamante, coroa e brilho — salão de alto padrão.',
    icones: ['gem', 'crown', 'sparkle', 'star', 'heart'],
    uso: 'favicon + botões',
    faviconTipo: 'svg',
    faviconHint:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#D4AF37"><path d="M16 4L6 14h20L16 4zm0 24L6 14h20L16 28z"/></svg>',
  },
  {
    id: 'butterfly-beauty',
    codigo: 'ICON-I',
    nome: 'Butterfly Beauty',
    estilo: 'Emoji',
    vertical: 'Feminino elegante',
    descricao: 'Borboleta, flor e brilho — leveza e transformação.',
    icones: ['🦋', '🌸', '✨', '💗', '🌺'],
    uso: 'favicon + botões',
    faviconTipo: 'emoji',
    faviconHint: '🦋',
  },
  {
    id: 'mirror-vanity',
    codigo: 'ICON-J',
    nome: 'Mirror Vanity',
    estilo: 'SVG inline',
    vertical: 'Salão clássico',
    descricao: 'Espelho, pincel e batom — cabine e maquiagem.',
    icones: ['mirror', 'brush', 'lipstick', 'sparkle', 'star'],
    uso: 'favicon + botões',
    faviconTipo: 'svg',
    faviconHint:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#1B3A4B" stroke-width="1.5"><ellipse cx="16" cy="14" rx="8" ry="10"/><path d="M12 26h8"/></svg>',
  },
  {
    id: 'scissors-chic',
    codigo: 'ICON-K',
    nome: 'Scissors Chic',
    estilo: 'SVG inline',
    vertical: 'Cabelo · unhas · combo',
    descricao: 'Tesoura estilizada, pente e sparkle — serviços combinados.',
    icones: ['scissors', 'comb', 'sparkle', 'heart', 'star'],
    uso: 'favicon + botões',
    faviconTipo: 'svg',
    faviconHint:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#0D9488" stroke-width="1.5"><circle cx="9" cy="9" r="3"/><circle cx="9" cy="23" r="3"/><path d="M12 11l14 10M12 21l14-10"/></svg>',
  },
  {
    id: 'heart-blush',
    codigo: 'ICON-L',
    nome: 'Heart Blush',
    estilo: 'Emoji',
    vertical: 'Blush · bridal · eventos',
    descricao: 'Corações blush, rosa e fita — romântico e feminino.',
    icones: ['💗', '🎀', '🌹', '✨', '💅'],
    uso: 'favicon + botões',
    faviconTipo: 'emoji',
    faviconHint: '💗',
  },
  {
    id: 'crown-queen',
    codigo: 'ICON-M',
    nome: 'Crown Queen',
    estilo: 'SVG inline',
    vertical: 'Salão VIP · lash noturno',
    descricao: 'Coroa, estrela e monograma — experiência premium.',
    icones: ['crown', 'star', 'gem', 'sparkle', 'heart'],
    uso: 'favicon + botões',
    faviconTipo: 'svg',
    faviconHint:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#D4AF37"><path d="M4 22h24L16 8 4 22zm4-4l8-6 8 6H8z"/></svg>',
  },
  {
    id: 'droplet-glow',
    codigo: 'ICON-N',
    nome: 'Droplet Glow',
    estilo: 'SVG inline',
    vertical: 'Skincare · harmonização',
    descricao: 'Gota, sol e folha — hidratação e glow facial.',
    icones: ['droplet', 'sun', 'leaf', 'sparkle', 'feather'],
    uso: 'favicon + botões',
    faviconTipo: 'svg',
    faviconHint:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#0D9488"><path d="M16 4c-6 8-10 12-10 17a10 10 0 1020 0c0-5-4-9-10-17z" opacity=".9"/></svg>',
  },
  {
    id: 'monogram-sparkle',
    codigo: 'ICON-O',
    nome: 'Monogram Sparkle',
    estilo: 'SVG inline',
    vertical: 'Favicon · PWA · notificações',
    descricao: 'TA em círculo com sparkle — compacto para aba do navegador.',
    icones: ['mono-ta', 'sparkle', 'star', 'heart', 'gem'],
    uso: 'favicon + botões',
    faviconTipo: 'svg',
    faviconHint: FAVICON_SVG_SPARKLE,
  },
];

/** 15 wordmarks — tipografia Turquesa Agenda */
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
    vertical: 'Avatar · redes',
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
  {
    id: 'display-luxo',
    codigo: 'LOGO-F',
    nome: 'Display Luxo',
    tratamento: 'display-luxo',
    vertical: 'Salão flagship',
    descricao: 'Display serif amplo — vitrine e fachada.',
  },
  {
    id: 'condensed-bold',
    codigo: 'LOGO-G',
    nome: 'Condensed Bold',
    tratamento: 'condensed-bold',
    vertical: 'Manicure express',
    descricao: 'Sans condensada e bold — legível em mobile e etiquetas.',
  },
  {
    id: 'italic-glam',
    codigo: 'LOGO-H',
    nome: 'Italic Glam',
    tratamento: 'italic-glam',
    vertical: 'Lash · brow glam',
    descricao: 'Itálico elegante com “Agenda” em champagne.',
  },
  {
    id: 'underline-accent',
    codigo: 'LOGO-I',
    nome: 'Underline Accent',
    tratamento: 'underline-accent',
    vertical: 'Landing · site',
    descricao: 'Turquesa com sublinhado turquesa — destaque em hero.',
  },
  {
    id: 'blush-gradient',
    codigo: 'LOGO-J',
    nome: 'Blush Gradient',
    tratamento: 'blush-gradient',
    vertical: 'Luxo blush · nail art',
    descricao: 'Gradiente rose gold → blush — tendência beauty feminina.',
  },
  {
    id: 'caps-lockup',
    codigo: 'LOGO-K',
    nome: 'Caps Lockup',
    tratamento: 'caps-lockup',
    vertical: 'Uniformes · impressos',
    descricao: 'TURQUESA AGENDA em uma linha — forte e institucional.',
  },
  {
    id: 'circle-badge',
    codigo: 'LOGO-L',
    nome: 'Circle Badge',
    tratamento: 'circle-badge',
    vertical: 'Selo · adesivos',
    descricao: 'Wordmark dentro de selo circular — kits e embalagens.',
  },
  {
    id: 'split-color',
    codigo: 'LOGO-M',
    nome: 'Split Color',
    tratamento: 'split-color',
    vertical: 'Salão colorido',
    descricao: 'Turquesa em petróleo, Agenda em turquesa — duo de marca.',
  },
  {
    id: 'handwritten-duo',
    codigo: 'LOGO-N',
    nome: 'Handwritten Duo',
    tratamento: 'handwritten-duo',
    vertical: 'Estúdio artesanal',
    descricao: 'Script casual nas duas palavras — acolhedor e pessoal.',
  },
  {
    id: 'diamond-wordmark',
    codigo: 'LOGO-O',
    nome: 'Diamond Wordmark',
    tratamento: 'diamond-wordmark',
    vertical: 'VIP · harmonização premium',
    descricao: 'Diamante + wordmark — joia e sofisticação.',
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
