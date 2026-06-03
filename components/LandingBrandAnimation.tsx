'use client';

/**
 * Loop: "Medical Super Application" → shrink/crossfade → "MedSupAPP"
 */
export default function LandingBrandAnimation() {
  return (
    <div
      className="brand-title-animation mx-auto mb-10 md:mb-12"
      aria-label="MedSupAPP, Medical Super Application"
    >
      <span className="brand-full" aria-hidden="true">
        Medical Super Application
      </span>
      <span className="brand-short" aria-hidden="true">
        MedSup<span className="text-[#90EE90]">APP</span>
      </span>
    </div>
  );
}
