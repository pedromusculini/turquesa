import BrandSvgImg from '@/components/BrandSvgImg';
import { BRAND, LOGO_CLIENTE_05_ASPECT, LOGO_HERO_PATH } from '@/lib/visual/brand';

const HERO_WORDMARK_HEIGHT = 112;

type HeroWordmarkInlineProps = {
  className?: string;
};

/**
 * LOGO-CLIENTE-05 no hero — PNG script glam com tagline abaixo (LandingBrandAnimation).
 */
export default function HeroWordmarkInline({ className = '' }: HeroWordmarkInlineProps) {
  const width = Math.round(HERO_WORDMARK_HEIGHT * LOGO_CLIENTE_05_ASPECT);

  return (
    <BrandSvgImg
      src={LOGO_HERO_PATH}
      alt={BRAND.productName}
      width={width}
      height={HERO_WORDMARK_HEIGHT}
      decorative
      className={`hero-wordmark-img object-contain ${className}`.trim()}
    />
  );
}
