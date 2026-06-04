type BrandSvgImgProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  /** Só para decoração (hero com aria-label no wrapper) */
  decorative?: boolean;
};

/**
 * SVG estático em /public — <img> nativo evita quirks do next/image com .svg.
 */
export default function BrandSvgImg({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  decorative = false,
}: BrandSvgImgProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- wordmarks/monogramas SVG em /public
    <img
      src={src}
      alt={decorative ? '' : alt}
      width={width}
      height={height}
      className={className}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      draggable={false}
      aria-hidden={decorative || undefined}
    />
  );
}
