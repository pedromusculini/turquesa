import Image from 'next/image';
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
    <Image
      src={LOGO_HEADER_ICON}
      alt={BRAND.productName}
      width={size}
      height={size}
      className={`shrink-0 ${className}`.trim()}
      unoptimized
      priority={priority}
    />
  );
}
