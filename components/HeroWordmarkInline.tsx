import { BRAND } from '@/lib/visual/brand';

const { productName: PRODUCT_NAME, colors: CORES, fonts } = BRAND;

type HeroWordmarkInlineProps = {
  className?: string;
};

/**
 * LOGO-CLIENTE-02 inline no hero — evita <img> com SVG+texto (parse/encoding) e garante pintura.
 */
export default function HeroWordmarkInline({ className = '' }: HeroWordmarkInlineProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 176 50"
      fill="none"
      role="img"
      aria-label={PRODUCT_NAME}
      className={className}
    >
      <text
        x="88"
        y="26"
        textAnchor="middle"
        fill={CORES.heroTextOnDark}
        fontFamily="Georgia, 'Times New Roman', Times, serif"
        fontSize="26"
        fontWeight="600"
      >
        Turquesa
      </text>
      <text
        x="88"
        y="44"
        textAnchor="middle"
        fill={CORES.heroTextMutedOnDark}
        fontFamily={fonts.sans}
        fontSize="17"
        fontWeight="600"
        letterSpacing="0.32em"
      >
        AGENDA
      </text>
    </svg>
  );
}
