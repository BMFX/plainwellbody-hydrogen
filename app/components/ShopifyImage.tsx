import type { Image } from "~/lib/content";
import { shopifyImageUrl, shopifySrcSet } from "~/lib/images";

const WIDTHS = [480, 800, 1200, 1600, 2000];

type Props = {
  image: Image | null | undefined;
  /** The `sizes` attribute: how wide the image renders at each breakpoint. */
  sizes: string;
  /** Overrides the image's own alt text from Shopify (use "" for decorative). */
  alt?: string;
  widths?: number[];
  /** LCP image: load eagerly with high priority. Everything else is lazy. */
  priority?: boolean;
  className?: string;
};

/**
 * An image from Shopify Files or a product, resized on Shopify's CDN (which also picks
 * WebP or AVIF per browser). Alt text comes from the file's alt text in Shopify.
 */
export function ShopifyImage({ image, sizes, alt, widths = WIDTHS, priority, className }: Props) {
  if (!image) return null;
  const usable = image.width ? widths.filter((w) => w <= image.width!) : widths;
  const list = usable.length ? usable : [image.width ?? widths[0]];
  return (
    <img
      src={shopifyImageUrl(image.url, list[Math.min(1, list.length - 1)])}
      srcSet={shopifySrcSet(image.url, list)}
      sizes={sizes}
      alt={alt ?? image.altText ?? ""}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? "sync" : "async"}
      className={className}
    />
  );
}

/** Preload descriptor for an LCP image, for a route's meta export. */
export function imagePreload(image: Image | null | undefined, sizes: string, widths = WIDTHS) {
  if (!image) return null;
  const usable = image.width ? widths.filter((w) => w <= image.width!) : widths;
  return {
    tagName: "link",
    rel: "preload",
    as: "image",
    href: shopifyImageUrl(image.url, usable[Math.min(1, usable.length - 1)] ?? 800),
    imageSrcSet: shopifySrcSet(image.url, usable),
    imageSizes: sizes,
    fetchPriority: "high",
  } as const;
}
