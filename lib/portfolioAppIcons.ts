/**
 * 15 ícones de app (favicon + botões) — SVG inline, estilos distintos.
 * Usado em lib/paletaCores.ts e espelhado em docs/paleta-cores.html
 */

export type PortfolioAppIconDef = {
  id: string;
  codigo: string;
  nome: string;
  estilo: string;
  vertical: string;
  descricao: string;
  tema: string;
  svg: string;
};

/** viewBox 0 0 32 32 — escalável para 32px e 64px */
export const PORTFOLIO_APP_ICONS: PortfolioAppIconDef[] = [
  {
    id: 'classic-calendar',
    codigo: 'ICON-A',
    nome: 'Clássico Calendário',
    estilo: 'Clássico',
    vertical: 'Salão completo · marca institucional',
    descricao: 'Moldura serif e calendário — elegância atemporal para favicon e botões.',
    tema: 'Calendário · moldura serif',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#F8FAFC" stroke="#1B3A4B" stroke-width="1.5"/><rect x="6" y="8" width="20" height="18" rx="2" fill="#fff" stroke="#1B3A4B" stroke-width="1.2"/><path d="M6 12h20" stroke="#1B3A4B" stroke-width="1.2"/><circle cx="11" cy="6" r="1.5" fill="#1B3A4B"/><circle cx="21" cy="6" r="1.5" fill="#1B3A4B"/><rect x="10" y="15" width="4" height="3" rx=".5" fill="#0D9488"/><rect x="15" y="15" width="4" height="3" rx=".5" fill="#D4A574"/><rect x="20" y="15" width="2" height="3" rx=".5" fill="#0D9488" opacity=".5"/></svg>',
  },
  {
    id: 'modern-flat',
    codigo: 'ICON-B',
    nome: 'Moderno Flat',
    estilo: 'Moderno',
    vertical: 'Agenda profissional · app mobile',
    descricao: 'Geometria plana, cantos arredondados — estilo app iOS/Android contemporâneo.',
    tema: 'Grid agenda · formas flat',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#0D9488"/><rect x="7" y="7" width="8" height="8" rx="2" fill="#fff" opacity=".95"/><rect x="17" y="7" width="8" height="8" rx="2" fill="#fff" opacity=".7"/><rect x="7" y="17" width="8" height="8" rx="2" fill="#fff" opacity=".7"/><rect x="17" y="17" width="8" height="8" rx="2" fill="#1B3A4B"/></svg>',
  },
  {
    id: 'aqua-gradient',
    codigo: 'ICON-C',
    nome: 'Aqua Turquesa',
    estilo: 'Aqua',
    vertical: 'Salão fresco · spa aquático',
    descricao: 'Gradiente ciano → turquesa com gota e brilho — identidade água e bem-estar.',
    tema: 'Gota · gradiente aqua',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="grad-icon-c" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#06B6D4"/><stop offset="100%" stop-color="#0D9488"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#grad-icon-c)"/><path fill="#fff" opacity=".95" d="M16 7c-5 6.5-8 10-8 14.5a8 8 0 1016 0C24 17 21 13.5 16 7z"/><path fill="#fff" opacity=".5" d="M13 22h6l-3-4z"/></svg>',
  },
  {
    id: 'steampunk-gears',
    codigo: 'ICON-D',
    nome: 'Steampunk Brass',
    estilo: 'Steampunk',
    vertical: 'Estúdio vintage · brow artesanal',
    descricao: 'Engrenagens latão e cobre sobre fundo escuro — charme mecânico-retro.',
    tema: 'Engrenagens · latão',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2C1810"/><circle cx="16" cy="16" r="7" fill="none" stroke="#B87333" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#D4AF37"/><path fill="#B87333" d="M16 5v3M16 24v3M5 16h3M24 16h3M8.5 8.5l2 2M21.5 21.5l2 2M23.5 8.5l-2 2M10.5 21.5l-2 2"/><circle cx="22" cy="10" r="4" fill="none" stroke="#CD7F32" stroke-width="1.5"/><circle cx="22" cy="10" r="1.5" fill="#D4AF37"/></svg>',
  },
  {
    id: 'minimal-line',
    codigo: 'ICON-E',
    nome: 'Minimal Line',
    estilo: 'Minimal',
    vertical: 'Manicure · lash clean',
    descricao: 'Traço fino, fundo branco — máxima legibilidade em tamanhos pequenos.',
    tema: 'Tesoura · linha única',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#fff" stroke="#E5E7EB" stroke-width="1"/><circle cx="10" cy="11" r="2.5" fill="none" stroke="#1B3A4B" stroke-width="1.5"/><circle cx="10" cy="21" r="2.5" fill="none" stroke="#1B3A4B" stroke-width="1.5"/><path fill="none" stroke="#0D9488" stroke-width="1.5" stroke-linecap="round" d="M12 12.5L24 19M12 19.5L24 13"/></svg>',
  },
  {
    id: 'glass-sparkle',
    codigo: 'ICON-F',
    nome: 'Glassmorphism',
    estilo: 'Glassmorphism',
    vertical: 'Salão premium · UI moderna',
    descricao: 'Vidro fosco, sparkle e reflexo — tendência interface 2025.',
    tema: 'Sparkle · vidro',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="grad-icon-f" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0D9488"/><stop offset="100%" stop-color="#1B3A4B"/></linearGradient></defs><rect width="32" height="32" rx="10" fill="url(#grad-icon-f)"/><rect x="5" y="5" width="22" height="22" rx="8" fill="#fff" opacity=".22"/><path fill="#fff" d="M16 8l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/><ellipse cx="16" cy="22" rx="6" ry="2" fill="#fff" opacity=".25"/></svg>',
  },
  {
    id: 'neon-lash',
    codigo: 'ICON-G',
    nome: 'Neon Lash',
    estilo: 'Neon Lash',
    vertical: 'Lash design · brow studio',
    descricao: 'Olho com cílios em neon rosa/ciano — estúdio noturno glam.',
    tema: 'Cílios · neon',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1a0a14"/><ellipse cx="16" cy="17" rx="10" ry="5" fill="none" stroke="#C48B9F" stroke-width="1.5"/><path stroke="#06B6D4" stroke-width="1.2" stroke-linecap="round" d="M9 15V8M12 14V6M16 13V5M20 14V6M23 15V8"/><circle cx="16" cy="17" r="2.5" fill="#F472B6"/><path fill="#06B6D4" opacity=".8" d="M16 3l.8 2.4 2.4.8-2.4.8L16 9l-.8-2.4-2.4-.8 2.4-.8L16 3z"/></svg>',
  },
  {
    id: 'luxury-salon',
    codigo: 'ICON-H',
    nome: 'Luxury Salon',
    estilo: 'Luxury Salon',
    vertical: 'Salão VIP · harmonização premium',
    descricao: 'Monograma T em medalhão dourado — joalheria e alto padrão.',
    tema: 'Monograma T · ouro',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#2C1810"/><circle cx="16" cy="16" r="11" fill="none" stroke="#D4AF37" stroke-width="1.5"/><path fill="#D4AF37" d="M10 10h12v3h-4v9h-4v-9h-4z"/><path fill="#F4C2C2" opacity=".6" d="M16 5l1 2 2 .6-2 .6L16 11l-1-2.8-2-.6 2-.6L16 5z"/></svg>',
  },
  {
    id: 'blush-rose',
    codigo: 'ICON-I',
    nome: 'Blush Rose',
    estilo: 'Blush Rose',
    vertical: 'Manicure · nail art feminino',
    descricao: 'Coração blush em tile rose gold — romântico e delicado.',
    tema: 'Coração · blush',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="10" fill="#FFF0F5"/><rect x="2" y="2" width="28" height="28" rx="9" fill="none" stroke="#B76E79" stroke-width="1"/><path fill="#B76E79" d="M16 24c-.5 0-10-6-10-12a5.5 5.5 0 019-3 5.5 5.5 0 019 3c0 6-9.5 12-10 12z"/><path fill="#F4C2C2" d="M16 8l.9 2.7 2.7.9-2.7.9L16 15l-.9-2.7-2.7-.9 2.7-.9L16 8z"/></svg>',
  },
  {
    id: 'calendar-agenda',
    codigo: 'ICON-J',
    nome: 'Agenda App',
    estilo: 'App Calendar',
    vertical: 'Turquesa Agenda · PWA',
    descricao: 'Ícone de calendário com check — núcleo do produto agenda.',
    tema: 'Calendário · check',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0D9488"/><rect x="6" y="9" width="20" height="17" rx="3" fill="#fff"/><path stroke="#0D9488" stroke-width="2" stroke-linecap="round" d="M11 18l3 3 7-7"/><path stroke="#1B3A4B" stroke-width="1.5" d="M6 13h20"/><rect x="10" y="5" width="2" height="5" rx="1" fill="#D4A574"/><rect x="20" y="5" width="2" height="5" rx="1" fill="#D4A574"/></svg>',
  },
  {
    id: 'sparkle-salon',
    codigo: 'ICON-K',
    nome: 'Sparkle Salon',
    estilo: 'Sparkle Chic',
    vertical: 'Salão colorido · combo serviços',
    descricao: 'Estrela central com raios — brilho pós-serviço e transformação.',
    tema: 'Sparkle · salão',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1B3A4B"/><path fill="#0D9488" d="M16 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/><path fill="#D4A574" d="M16 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/><circle cx="8" cy="8" r="1.5" fill="#fff" opacity=".6"/><circle cx="24" cy="24" r="1.5" fill="#fff" opacity=".6"/></svg>',
  },
  {
    id: 'floral-spa',
    codigo: 'ICON-L',
    nome: 'Floral Spa',
    estilo: 'Floral Spa',
    vertical: 'Harmonização · spa orgânico',
    descricao: 'Flor estilizada em lavanda — organic beauty e bem-estar.',
    tema: 'Flor · spa',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#FAF8FF"/><circle cx="16" cy="16" r="4" fill="#C9A0A0"/><ellipse cx="16" cy="9" rx="3" ry="5" fill="#5C4D6E" opacity=".35"/><ellipse cx="16" cy="23" rx="3" ry="5" fill="#5C4D6E" opacity=".35"/><ellipse cx="9" cy="16" rx="5" ry="3" fill="#5C4D6E" opacity=".35"/><ellipse cx="23" cy="16" rx="5" ry="3" fill="#5C4D6E" opacity=".35"/><path fill="none" stroke="#5C4D6E" stroke-width="1" d="M16 20v6"/></svg>',
  },
  {
    id: 'champagne-vip',
    codigo: 'ICON-M',
    nome: 'Champagne VIP',
    estilo: 'Champagne VIP',
    vertical: 'Lash noturno · eventos',
    descricao: 'Coroa champagne sobre fundo escuro — experiência exclusiva.',
    tema: 'Coroa · champagne',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#2C1810"/><path fill="#D4AF37" d="M4 20h24L16 6 4 20zm4-2h16l-8-6-8 6z"/><circle cx="16" cy="14" r="2" fill="#FDF6EC"/><path fill="#C48B9F" d="M16 4l.7 2 2 .7-2 .7L16 10l-.7-2-2-.7 2-.7L16 4z"/></svg>',
  },
  {
    id: 'skincare-glow',
    codigo: 'ICON-N',
    nome: 'Skincare Glow',
    estilo: 'Skincare Glow',
    vertical: 'Harmonização facial · skincare',
    descricao: 'Gota turquesa com halo — hidratação e glow facial.',
    tema: 'Gota · glow',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#F8FAFC"/><circle cx="16" cy="16" r="12" fill="#0D9488" opacity=".12"/><path fill="#0D9488" d="M16 5c-6 7.5-9 11.5-9 16a9 9 0 1018 0c0-4.5-3-8.5-9-16z"/><ellipse cx="13" cy="14" rx="2" ry="3" fill="#fff" opacity=".35"/></svg>',
  },
  {
    id: 'monogram-ta',
    codigo: 'ICON-O',
    nome: 'Monograma TA',
    estilo: 'Monogram PWA',
    vertical: 'Favicon · notificações · aba',
    descricao: 'TA em tile turquesa com sparkle — compacto para navegador e PWA.',
    tema: 'TA · sparkle',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0D9488"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="11" font-weight="700">TA</text><path fill="#fff" opacity=".9" d="M24 6l.6 1.8 1.8.6-1.8.6L24 11l-.6-1.8-1.8-.6 1.8-.6L24 6z"/></svg>',
  },
];
