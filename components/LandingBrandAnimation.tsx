'use client';

import Image from 'next/image';
import { BRAND, LOGO_HERO_PATH } from '@/lib/visual/brand';

const { productName: PRODUCT_NAME } = BRAND;

/**
 * Wordmark LOGO-CLIENTE-02 no hero (maior que o header, contraste em fundo teal).
 */
export default function LandingBrandAnimation() {
  return (
    <div
      className="landing-hero-wordmark mx-auto mb-10 flex justify-center md:mb-12"
      aria-label={PRODUCT_NAME}
    >
      <Image
        src={LOGO_HERO_PATH}
        alt=""
        width={352}
        height={100}
        className="h-[4.5rem] w-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)] sm:h-20 md:h-24 lg:h-28"
        unoptimized
        priority
        aria-hidden
      />
    </div>
  );
}
