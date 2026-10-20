import type { Image } from "~/lib/content";
import { shopifyImageUrl } from "~/lib/images";

/** A logo image from Site settings, sized by height (px), sharp on high-density screens. */
export function Logo({ image, alt, height, className, lazy }: { image: Image | null; alt: string; height: number; className?: string; lazy?: boolean }) {
  if (!image) return null;
  const ratio = image.width && image.height ? image.width / image.height : 2;
  const width = Math.round(height * ratio);
  return (
    <img
      src={shopifyImageUrl(image.url, width * 2)}
      srcSet={`${shopifyImageUrl(image.url, width)} 1x, ${shopifyImageUrl(image.url, width * 2)} 2x, ${shopifyImageUrl(image.url, width * 3)} 3x`}
      alt={alt}
      width={width}
      height={height}
      loading={lazy ? "lazy" : undefined}
      fetchPriority={lazy ? undefined : "high"}
      className={className}
    />
  );
}
