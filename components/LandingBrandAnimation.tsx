import BrandSvgImg from '@/components/BrandSvgImg';
import { BRAND, LOGO_HERO_PATH } from '@/lib/visual/brand';

const { productName: PRODUCT_NAME, tagline: TAGLINE, colors: CORES } = BRAND;

/**
 * Wordmark LOGO-CLIENTE-02 no hero (maior que o header, contraste em fundo teal).
 */
export default function LandingBrandAnimation() {
  return (
    <div className="landing-hero-wordmark mx-auto mb-10 flex flex-col items-center md:mb-12">
      <BrandSvgImg
        src={LOGO_HERO_PATH}
        alt={PRODUCT_NAME}
        width={352}
        height={100}
        className="h-[4.5rem] w-auto max-w-[min(100%,22rem)] drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)] sm:h-20 md:h-24 lg:h-28"
        priority
        decorative
      />
      <p
        className="landing-hero-muted mt-4 text-sm font-medium tracking-wide sm:text-base"
        style={{ color: CORES.heroTextMutedOnDark }}
      >
        {TAGLINE}
      </p>
    </div>
  );
}
