import { BRAND } from '@/lib/visual/brand';

const { productName: PRODUCT_NAME, colors: CORES, fonts } = BRAND;

type HeroWordmarkInlineProps = {
  className?: string;
};

/**
 * LOGO-CLIENTE-02 inline no hero — evita <img> com SVG+texto (parse/encoding) e garante pintura.
 * Linhas em <g> separados para animação escalonada via globals.css.
 */
export default function HeroWordmarkInline({ className = '' }: HeroWordmarkInlineProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 68"
      fill="none"
      role="img"
      aria-label={PRODUCT_NAME}
      className={`hero-wordmark-svg ${className}`.trim()}
    >
      <g className="hero-wordmark-turquesa">
        <text
          x="100"
          y="28"
          textAnchor="middle"
          fill={CORES.heroTextOnDark}
          fontFamily="Georgia, 'Times New Roman', Times, serif"
          fontSize="28"
          fontWeight="600"
        >
          Turquesa
        </text>
      </g>
      <g className="hero-wordmark-agenda">
        <text
          x="100"
          y="56"
          textAnchor="middle"
          fill={CORES.heroTextMutedOnDark}
          fontFamily={fonts.sans}
          fontSize="16"
          fontWeight="600"
          letterSpacing="0.38em"
        >
          AGENDA
        </text>
      </g>
    </svg>
  );
}
