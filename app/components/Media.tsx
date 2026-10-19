import type { CSSProperties } from "react";

// Responsive local art built by `node scripts/media.mjs`. Vite fingerprints each file,
// so every variant is served from the CDN with an immutable cache lifetime.
const FILES = import.meta.glob<string>("../assets/media/*.{avif,webp,png}", {
  eager: true,
  query: "?url",
  import: "default",
});

type Variant = { width: number; avif: string; webp: string };

const VARIANTS = new Map<string, Variant[]>();
for (const [file, url] of Object.entries(FILES)) {
  const match = /\/([a-z0-9-]+)-(\d+)\.(avif|webp)$/.exec(file);
  if (!match) continue;
  const [, name, width, format] = match;
  const list = VARIANTS.get(name) ?? [];
  let entry = list.find((v) => v.width === Number(width));
  if (!entry) {
    entry = { width: Number(width), avif: "", webp: "" };
    list.push(entry);
  }
  entry[format as "avif" | "webp"] = url;
  VARIANTS.set(name, list);
}
for (const list of VARIANTS.values()) list.sort((a, b) => a.width - b.width);

export function mediaFile(name: string): string {
  const url = FILES[`../assets/media/${name}`];
  if (!url) throw new Error(`Unknown media file: ${name}`);
  return url;
}

export function hasMedia(name: string): boolean {
  return VARIANTS.has(name);
}

type MediaProps = {
  /** Base name in app/assets/media, e.g. `campaign-citrus-ritual`. */
  name: string;
  alt: string;
  /** The `sizes` attribute: how wide the image renders at each breakpoint. */
  sizes: string;
  /** Intrinsic aspect ratio (width / height) used to reserve space. */
  width: number;
  height: number;
  /** LCP image: load eagerly with high priority. Everything else is lazy. */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Media({ name, alt, sizes, width, height, priority, className, style }: MediaProps) {
  const variants = VARIANTS.get(name);
  if (!variants?.length) return null;
  const srcSet = (format: "avif" | "webp") =>
    variants.map((v) => `${v[format]} ${v.width}w`).join(", ");
  const fallback = variants[Math.min(1, variants.length - 1)];

  return (
    <picture>
      <source type="image/avif" srcSet={srcSet("avif")} sizes={sizes} />
      <img
        src={fallback.webp}
        srcSet={srcSet("webp")}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding={priority ? "sync" : "async"}
        className={className}
        style={style}
      />
    </picture>
  );
}

/** Preload descriptor for an LCP image, for a route's `links` export. */
export function mediaPreload(name: string, sizes: string) {
  const variants = VARIANTS.get(name) ?? [];
  return {
    rel: "preload",
    as: "image",
    type: "image/avif",
    imageSrcSet: variants.map((v) => `${v.avif} ${v.width}w`).join(", "),
    imageSizes: sizes,
    fetchPriority: "high",
  } as const;
}
