import HeroWordmarkInline from '@/components/HeroWordmarkInline';
import { BRAND } from '@/lib/visual/brand';

const { productName: PRODUCT_NAME, tagline: TAGLINE, colors: CORES } = BRAND;

const WORDMARK_CLASS =
  'h-[4.5rem] w-auto max-w-[min(100%,22rem)] drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)] sm:h-20 md:h-24 lg:h-28';

/**
 * Wordmark LOGO-CLIENTE-02 no hero (maior que o header, contraste em fundo teal).
 */
export default function LandingBrandAnimation() {
  return (
    <div
      className="landing-hero-wordmark mx-auto mb-10 flex flex-col items-center md:mb-12"
      aria-label={PRODUCT_NAME}
    >
      <HeroWordmarkInline className={WORDMARK_CLASS} />
      <p
        className="landing-hero-muted mt-4 text-sm font-medium tracking-wide sm:text-base"
        style={{ color: CORES.heroTextMutedOnDark }}
      >
        {TAGLINE}
      </p>
    </div>
  );
}
