import HeroWordmarkInline from '@/components/HeroWordmarkInline';
import { BRAND } from '@/lib/visual/brand';

const { productName: PRODUCT_NAME, tagline: TAGLINE, colors: CORES } = BRAND;

const WORDMARK_CLASS =
  'h-[5rem] w-auto max-w-[min(100%,24rem)] drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)] sm:h-[5.25rem] md:h-24 lg:h-28';

/**
 * LOGO-CLIENTE-05 no hero (script glam, drop-shadow em fundo teal).
 */
export default function LandingBrandAnimation() {
  return (
    <div
      className="landing-hero-wordmark mx-auto mb-10 flex flex-col items-center md:mb-12"
      aria-label={PRODUCT_NAME}
    >
      <div className="landing-hero-wordmark__mark">
        <HeroWordmarkInline className={WORDMARK_CLASS} />
      </div>
      <p
        className="landing-hero-wordmark__tagline landing-hero-muted mt-5 text-sm font-medium tracking-wide sm:text-base"
        style={{ color: CORES.heroTextMutedOnDark }}
      >
        {TAGLINE}
      </p>
    </div>
  );
}
