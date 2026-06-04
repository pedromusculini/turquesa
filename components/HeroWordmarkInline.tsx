import {
  BRAND,
  LOGO_CLIENTE_05_ASPECT,
  LOGO_HERO_PATH,
} from '@/lib/visual/brand';

/** Altura base do hero ×3 (antes ~112px → 336px) */
const HERO_WORDMARK_HEIGHT = 112 * 3;

/** Recorte do PNG 1168×784 — palavras empilhadas com leve sobreposição */
const TURQUESA_CLIP_PERCENT = 58;
const AGENDA_CLIP_PERCENT = 52;
/** Indentação original de "Agenda" sob "Turquesa" */
const AGENDA_INDENT_PERCENT = 14;

type HeroWordmarkInlineProps = {
  className?: string;
};

/**
 * LOGO-CLIENTE-05 no hero — duas camadas do mesmo PNG (Turquesa / Agenda),
 * 3× tamanho, animações independentes (LandingBrandAnimation + globals.css).
 */
export default function HeroWordmarkInline({ className = '' }: HeroWordmarkInlineProps) {
  const width = Math.round(HERO_WORDMARK_HEIGHT * LOGO_CLIENTE_05_ASPECT);
  const wordmarkStyle = {
    '--hero-wordmark-url': `url(${LOGO_HERO_PATH})`,
    '--hero-wordmark-w': `${width}px`,
    '--hero-wordmark-turquesa-h': `${TURQUESA_CLIP_PERCENT}%`,
    '--hero-wordmark-agenda-h': `${AGENDA_CLIP_PERCENT}%`,
    '--hero-wordmark-agenda-indent': `${AGENDA_INDENT_PERCENT}%`,
  } as React.CSSProperties;

  return (
    <div
      className={`hero-wordmark-split ${className}`.trim()}
      style={wordmarkStyle}
      role="img"
      aria-label={BRAND.productName}
    >
      <div className="hero-wordmark-split__turquesa" aria-hidden>
        <div className="hero-wordmark-split__bg" />
      </div>
      <div className="hero-wordmark-split__agenda" aria-hidden>
        <div className="hero-wordmark-split__bg hero-wordmark-split__bg--agenda" />
      </div>
    </div>
  );
}
