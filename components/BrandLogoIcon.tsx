import BrandSvgImg from '@/components/BrandSvgImg';
import { BRAND, LOGO_HEADER_ICON } from '@/lib/visual/brand';

type BrandLogoIconProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Monograma LOGO-E (TA) — cabeçalho, sidebar, botões */
export default function BrandLogoIcon({
  size = 24,
  className = '',
  priority = false,
}: BrandLogoIconProps) {
  return (
    <BrandSvgImg
      src={LOGO_HEADER_ICON}
      alt={BRAND.productName}
      width={size}
      height={size}
      className={`shrink-0 ${className}`.trim()}
      priority={priority}
    />
  );
}
