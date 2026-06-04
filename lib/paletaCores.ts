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

export type LogoClienteOpcao = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  vertical: string;
  /** Caminho em /public (ex.: /portfolio-logos/logo-cliente-01.png) */
  imagem: string;
  cores?: { hex: string; label: string }[];
  nota?: string;
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
    vertical: 'Monograma · favicon',
    descricao: 'Monograma TA em círculo turquesa — favicon e notificações.',
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

/** Asset estático do LOGO-E (monograma TA) — cabeçalho e ícones */
export const LOGO_E_IMAGEM = '/portfolio-logos/logo-e-monograma-ta.svg' as const;

/** Logomarcas enviadas pela cliente (PNG em public/portfolio-logos/) */
export const LOGO_CLIENTE_OPCOES: LogoClienteOpcao[] = [
  {
    id: 'app-calendario-tesoura-pente',
    codigo: 'LOGO-CLIENTE-01',
    nome: 'App icon — calendário, tesoura e pente',
    vertical: 'Ícone app · salão',
    descricao: 'Quadrado turquesa com calendário, tesoura e pente em ocre — estilo flat com sombra.',
    imagem: '/portfolio-logos/logo-cliente-01-app-calendario-tesoura-pente.png',
    cores: [
      { hex: '#0D9488', label: 'Turquesa (ícone)' },
      { hex: '#D4A574', label: 'Ocre / dourado' },
      { hex: '#1B3A4B', label: 'Fundo petróleo' },
    ],
  },
  {
    id: 'empilhado-serif-hex',
    codigo: 'LOGO-CLIENTE-02',
    nome: 'Empilhado serif + HEX',
    vertical: 'Wordmark · guia de cores',
    descricao: 'Turquesa em serif petróleo, Agenda em sans turquesa — com rótulos HEX visíveis.',
    imagem: '/portfolio-logos/logo-cliente-02-empilhado-serif-hex.png',
    cores: [
      { hex: '#1B3A4B', label: 'Turquesa (texto)' },
      { hex: '#0D9488', label: 'Agenda (texto)' },
    ],
  },
  {
    id: 'empilhado-sans-gradiente',
    codigo: 'LOGO-CLIENTE-03',
    nome: 'Empilhado sans gradiente',
    vertical: 'Wordmark · moderno',
    descricao: 'Sans empilhado com gradiente turquesa → teal em fundo claro.',
    imagem: '/portfolio-logos/logo-cliente-03-empilhado-sans-gradiente.png',
    cores: [
      { hex: '#0D9488', label: 'Turquesa' },
      { hex: '#06B6D4', label: 'Ciano (gradiente)' },
    ],
  },
  {
    id: 'app-icon-t-calendario',
    codigo: 'LOGO-CLIENTE-04',
    nome: 'App icon — T calendário',
    vertical: 'Ícone app · 3D layered',
    descricao: 'Quadrado turquesa com T, calendário, tesoura e pente — canto dobrado, fundo petróleo.',
    imagem: '/portfolio-logos/logo-cliente-04-app-icon-t-calendario.png',
    cores: [
      { hex: '#0D9488', label: 'Turquesa' },
      { hex: '#D4A574', label: 'Ocre / dourado' },
      { hex: '#1B3A4B', label: 'Fundo petróleo' },
    ],
  },
  {
    id: 'script-glam-brilho',
    codigo: 'LOGO-CLIENTE-05',
    nome: 'Script glam com brilho',
    vertical: 'Wordmark · luxo',
    descricao: 'Turquesa em script turquesa, Agenda em dourado — efeito 3D e estrelas.',
    imagem: '/portfolio-logos/logo-cliente-05-script-glam-brilho.png',
    cores: [
      { hex: '#0D9488', label: 'Turquesa (script)' },
      { hex: '#D4A574', label: 'Dourado (Agenda)' },
    ],
  },
  {
    id: 'dourado-turquesa-transparente',
    codigo: 'LOGO-CLIENTE-06',
    nome: 'Dourado + turquesa (transparente)',
    vertical: 'Wordmark · premium',
    descricao: 'Turquesa serif dourada com contorno, Agenda sans turquesa — fundo transparente.',
    imagem: '/portfolio-logos/logo-cliente-06-dourado-turquesa-transparente.png',
    cores: [
      { hex: '#D4A574', label: 'Dourado (Turquesa)' },
      { hex: '#0D9488', label: 'Turquesa (Agenda)' },
    ],
  },
  {
    id: 'serif-dourado-escuro',
    codigo: 'LOGO-CLIENTE-07',
    nome: 'Serif dourado + escuro',
    vertical: 'Wordmark · clássico',
    descricao: 'Turquesa em serif dourada, Agenda em sans petróleo — alto contraste.',
    imagem: '/portfolio-logos/logo-cliente-07-serif-dourado-escuro.png',
    cores: [
      { hex: '#D4A574', label: 'Dourado' },
      { hex: '#1B3A4B', label: 'Petróleo' },
    ],
  },
  {
    id: 'guia-estilo-swatches',
    codigo: 'LOGO-CLIENTE-08',
    nome: 'Guia de estilo + swatches',
    vertical: 'Moodboard · paleta',
    descricao: 'Wordmark dourado/turquesa com blocos de cor e HEX da marca.',
    imagem: '/portfolio-logos/logo-cliente-08-guia-estilo-swatches.png',
    cores: [
      { hex: '#1B3A4B', label: 'Petróleo' },
      { hex: '#0D9488', label: 'Turquesa' },
      { hex: '#06B6D4', label: 'Ciano' },
      { hex: '#D4A574', label: 'Ocre / dourado' },
    ],
  },
  {
    id: 'split-turq-agenda',
    codigo: 'LOGO-CLIENTE-09',
    nome: 'Split Turq/qesa + Agenda',
    vertical: 'Wordmark · editorial',
    descricao: 'Turquesa partido em duas linhas serif escuro, Agenda sans turquesa — fundo transparente.',
    imagem: '/portfolio-logos/logo-cliente-09-split-turq-agenda.png',
    cores: [
      { hex: '#1B3A4B', label: 'Serif escuro' },
      { hex: '#0D9488', label: 'Agenda turquesa' },
    ],
  },
  {
    id: 'steampunk-caps',
    codigo: 'LOGO-CLIENTE-10',
    nome: 'Steampunk caps',
    vertical: 'Wordmark · vintage',
    descricao: 'TURQUESA AGENDA em caps com engrenagens, bronze e turquesa envelhecido.',
    imagem: '/portfolio-logos/logo-cliente-10-steampunk-caps.png',
    cores: [
      { hex: '#0D9488', label: 'Turquesa' },
      { hex: '#D4A574', label: 'Bronze / ocre' },
      { hex: '#1B3A4B', label: 'Petróleo' },
    ],
  },
  {
    id: 'gemini-horizontal-sans',
    codigo: 'LOGO-CLIENTE-11',
    nome: 'Horizontal sans (Gemini A)',
    vertical: 'Wordmark · IA cliente',
    descricao: 'Turquesa turquesa + Agenda escuro, sans com detalhe no Q — recorte do composite Gemini.',
    imagem: '/portfolio-logos/logo-cliente-11-gemini-horizontal-sans.png',
    cores: [
      { hex: '#0D9488', label: 'Turquesa' },
      { hex: '#1B3A4B', label: 'Agenda' },
    ],
    nota: 'Recorte automático do arquivo composite Gemini (variação A).',
  },
  {
    id: 'gemini-empilhado-serif',
    codigo: 'LOGO-CLIENTE-12',
    nome: 'Empilhado serif caps (Gemini B)',
    vertical: 'Wordmark · IA cliente',
    descricao: 'TURQUESA petróleo + AGENDA dourado em serif caps — recorte do composite Gemini.',
    imagem: '/portfolio-logos/logo-cliente-12-gemini-empilhado-serif.png',
    cores: [
      { hex: '#1B3A4B', label: 'TURQUESA' },
      { hex: '#D4A574', label: 'AGENDA' },
    ],
    nota: 'Recorte automático do arquivo composite Gemini (variação B).',
  },
  {
    id: 'gemini-app-icon-olho',
    codigo: 'LOGO-CLIENTE-13',
    nome: 'App icon calendário + olho (Gemini C)',
    vertical: 'Ícone app · lash/beauty',
    descricao: 'Calendário com olho e cílios em gradiente turquesa — recorte do composite Gemini.',
    imagem: '/portfolio-logos/logo-cliente-13-gemini-app-icon-olho.png',
    cores: [
      { hex: '#1B3A4B', label: 'Fundo ícone' },
      { hex: '#0D9488', label: 'Turquesa' },
      { hex: '#06B6D4', label: 'Ciano (gradiente)' },
    ],
    nota: 'Recorte automático do arquivo composite Gemini (variação C).',
  },
];

/** Valores documentados em project_summary.txt (referência até o cliente escolher). */
export const PALETA_PROJETO_ATUAL = {
  titulo: 'Paleta atual do projeto (project_summary)',
  nota: 'Provisória — aguardando escolha do cliente via esta página (códigos PALETA-*, LOGO-*).',
  cores: {
    primaria: { hex: '#1B3A4B', label: 'Primária (petróleo)' },
    secundaria: { hex: '#0D9488', label: 'Secundária (turquesa)' },
    destaque: { hex: '#D4A574', label: 'Destaque (ocre)' },
    superficie: { hex: '#F8FAFC', label: 'Fundo / superfície' },
    auxiliar: { hex: '#06B6D4', label: 'Auxiliar (ciano — gráficos/hover)' },
  },
} as const;
