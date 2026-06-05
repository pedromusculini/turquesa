import HeroWordmarkInline from '@/components/HeroWordmarkInline';
import { BRAND } from '@/lib/visual/brand';

const { productName: PRODUCT_NAME, tagline: TAGLINE, colors: CORES } = BRAND;

const WORDMARK_CLASS =
  'drop-shadow-[0_2px_16px_rgba(0,0,0,0.28)]';

/**
 * Wordmark profissional no hero (drop-shadow em fundo teal; altura ~280px via max-h no img).
 */
export default function LandingBrandAnimation() {
  return (
    <div
      className="landing-hero-wordmark mx-auto mb-10 flex w-full flex-col items-center justify-center text-center md:mb-12"
      aria-label={PRODUCT_NAME}
    >
      <div className="landing-hero-wordmark__mark flex w-full items-center justify-center">
        <HeroWordmarkInline className={WORDMARK_CLASS} />
      </div>
      <p
        className="landing-hero-wordmark__tagline landing-hero-muted mt-5 text-base font-medium tracking-wide sm:text-lg md:text-xl"
        style={{ color: CORES.heroTextMutedOnDark }}
      >
        {TAGLINE}
      </p>
    </div>
  );
}
