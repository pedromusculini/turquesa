'use client';

/**
 * Marca Turquesa Agenda na landing.
 */
export default function LandingBrandAnimation() {
  return (
    <div
      className="brand-title-animation mx-auto mb-10 md:mb-12"
      aria-label="Turquesa Agenda"
    >
      <span className="brand-full" aria-hidden="true">
        Gestão para salões
      </span>
      <span className="brand-short" aria-hidden="true">
        <span className="brand-main">Turquesa</span>
        <span className="brand-accent">Agenda</span>
      </span>
    </div>
  );
}
