import BrandSvgImg from '@/components/BrandSvgImg';
import { BRAND, LOGO_HERO_ASPECT, LOGO_HERO_PATH } from '@/lib/visual/brand';

/** Altura base do hero ×2.5 (336px ÷ 1.2 → 280px) */
const HERO_WORDMARK_HEIGHT = Math.round((112 * 3) / 1.2);

type HeroWordmarkInlineProps = {
  className?: string;
};

/**
 * Wordmark profissional no hero — SVG em /public (img nativo; evita quirks do next/image).
 */
export default function HeroWordmarkInline({ className = '' }: HeroWordmarkInlineProps) {
  const width = Math.round(HERO_WORDMARK_HEIGHT * LOGO_HERO_ASPECT);

  return (
    <BrandSvgImg
      src={LOGO_HERO_PATH}
      alt={BRAND.productName}
      width={width}
      height={HERO_WORDMARK_HEIGHT}
      priority
      decorative
      className={`hero-wordmark-img mx-auto h-auto max-h-[17.5rem] w-auto max-w-full object-contain ${className}`.trim()}
    />
  );
}
