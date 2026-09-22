'use client';

type AppBootSplashProps = {
  label?: string;
  className?: string;
};

/** Tela de abertura do app — marca + barra, sem ícone pixelado. */
export default function AppBootSplash({
  label = 'Abrindo o Turquesa…',
  className = '',
}: AppBootSplashProps) {
  return (
    <div
      className={`ta-boot-screen ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="ta-boot-mark" aria-hidden />
      <p className="ta-boot-label">{label}</p>
      <div className="ta-boot-bar" aria-hidden>
        <span />
      </div>
    </div>
  );
}
