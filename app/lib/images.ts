// Shopify CDN image transforms. The CDN resizes on request and negotiates WebP/AVIF
// from the browser's Accept header, so one URL pattern covers every format.
export function shopifyImageUrl(url: string, width: number, height?: number): string {
  const next = new URL(url);
  next.searchParams.set("width", String(width));
  if (height) {
    next.searchParams.set("height", String(height));
    next.searchParams.set("crop", "center");
  }
  return next.toString();
}

export function shopifySrcSet(url: string, widths: number[], aspect?: number): string {
  return widths
    .map((w) => `${shopifyImageUrl(url, w, aspect ? Math.round(w / aspect) : undefined)} ${w}w`)
    .join(", ");
}
