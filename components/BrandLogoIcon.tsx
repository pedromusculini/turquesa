import BrandSvgImg from '@/components/BrandSvgImg';
import {
  BRAND,
  LOGO_CLIENTE_05_ASPECT,
  LOGO_HEADER_ICON,
} from '@/lib/visual/brand';

type BrandLogoIconProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/** LOGO-CLIENTE-05 — cabeçalho, sidebar, botões (altura fixa, largura proporcional) */
export default function BrandLogoIcon({
  size = 24,
  className = '',
  priority = false,
}: BrandLogoIconProps) {
  const width = Math.round(size * LOGO_CLIENTE_05_ASPECT);

  return (
    <BrandSvgImg
      src={LOGO_HEADER_ICON}
      alt={BRAND.productName}
      width={width}
      height={size}
      className={`shrink-0 w-auto max-w-none ${className}`.trim()}
      priority={priority}
    />
  );
}
