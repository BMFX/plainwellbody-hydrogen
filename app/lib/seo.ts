import type { MetaDescriptor } from "react-router";

import { format, type SiteContent } from "~/lib/content";
import { shopifyImageUrl } from "~/lib/images";
import { FALLBACK_SHOP_NAME } from "~/lib/storefront-shop";

// One place for every page's search and sharing tags: title, description, canonical URL,
// robots, Open Graph and Twitter card. Titles, descriptions and images come from Shopify
// (product, collection and page SEO fields; Site settings for the default sharing image;
// Interface text for the "{title} · {shop}" format). Canonical and share URLs use the
// site's own origin.

type RootMatch = { data?: unknown } | undefined;
type RootData = { shopInfo?: { name?: string }; primaryOrigin?: string; content?: SiteContent };

export function rootSeo(rootMatch: RootMatch) {
  const data = (rootMatch?.data ?? {}) as RootData;
  return {
    shopName: data.shopInfo?.name || FALLBACK_SHOP_NAME,
    origin: data.primaryOrigin ?? "",
    content: data.content ?? null,
  };
}

/** Makes a site path or an asset URL absolute against the site origin. */
export function absoluteUrl(origin: string, pathOrUrl: string) {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${origin}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export type SeoInput = {
  /** Page title without the shop name; set `titleIsFull` to use it as the whole title. */
  title: string;
  titleIsFull?: boolean;
  description?: string | null;
  /** Canonical path, e.g. /collections/body. Query strings are left off on purpose. */
  path: string;
  image?: { url: string; width?: number; height?: number; alt?: string } | null;
  type?: "website" | "product" | "article";
  /** Keep out of search results (search results, account, bag). */
  noindex?: boolean;
};

export function seoMeta(rootMatch: RootMatch, input: SeoInput): MetaDescriptor[] {
  const { shopName, origin, content } = rootSeo(rootMatch);
  const text = content?.text ?? {};
  const title = input.titleIsFull || !input.title ? input.title || shopName : format(text, "seo.title_format", { title: input.title, shop: shopName });
  const url = absoluteUrl(origin, input.path);
  const share = content?.settings.shareImage;
  const image = input.image ?? (share ? { url: shopifyImageUrl(share.url, 1200, 630), width: 1200, height: 630, alt: share.altText ?? undefined } : null);
  const description = input.description?.trim() || null;

  return [
    { title },
    ...(description ? [{ name: "description", content: description }] : []),
    ...(input.noindex ? [{ name: "robots", content: "noindex, follow" }] : [{ tagName: "link", rel: "canonical", href: url }]),
    { property: "og:site_name", content: shopName },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:title", content: input.title || shopName },
    ...(description ? [{ property: "og:description", content: description }] : []),
    { property: "og:url", content: url },
    ...(image
      ? [
          { property: "og:image", content: absoluteUrl(origin, image.url) },
          ...(image.width ? [{ property: "og:image:width", content: String(image.width) }] : []),
          ...(image.height ? [{ property: "og:image:height", content: String(image.height) }] : []),
          ...(image.alt ? [{ property: "og:image:alt", content: image.alt }] : []),
          { name: "twitter:image", content: absoluteUrl(origin, image.url) },
        ]
      : []),
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: input.title || shopName },
    ...(description ? [{ name: "twitter:description", content: description }] : []),
  ];
}
