// Builds the responsive image set in app/assets/media from the repo's source art:
// campaign photography, packshots for the coming-soon products (not in Shopify yet)
// and the wordmark. Run after adding or replacing source images:
//
//   node scripts/media.mjs
//
// Live products are not processed here: their images come from Shopify's CDN.
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const out = path.resolve(here, "../app/assets/media");

const CAMPAIGN_WIDTHS = [480, 800, 1200, 1600];
const PACKSHOT_WIDTHS = [360, 600, 900];

async function variants(src, name, widths) {
  const meta = await sharp(src).metadata();
  const sizes = [...new Set(widths.map((w) => Math.min(w, meta.width)))];
  for (const width of sizes) {
    const base = sharp(src).resize({ width, withoutEnlargement: true });
    await base.clone().avif({ quality: 52, effort: 6 }).toFile(path.join(out, `${name}-${width}.avif`));
    await base.clone().webp({ quality: 74, effort: 6 }).toFile(path.join(out, `${name}-${width}.webp`));
  }
  return sizes;
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const campaign = path.join(repo, "assets/campaign");
for (const file of (await readdir(campaign)).filter((f) => f.endsWith(".webp"))) {
  const sizes = await variants(path.join(campaign, file), `campaign-${path.parse(file).name}`, CAMPAIGN_WIDTHS);
  console.log(`campaign ${file} → ${sizes.join(", ")}`);
}

const catalog = JSON.parse(await readFile(path.join(repo, "content/products.json"), "utf8"));
for (const product of catalog.products.filter((p) => p.status === "concept")) {
  await variants(path.join(repo, product.image.local), `pack-${product.handle}`, PACKSHOT_WIDTHS);
  console.log(`packshot ${product.handle}`);
}

// Wordmarks at 2x their largest display height (46px header, 64px footer), trimmed.
const logos = path.join(repo, "design/design-system/assets/Logos");
const wordmarks = [
  ["plainwell-wordmark-black.png", "wordmark-black", 92],
  ["plainwell-wordmark-white.png", "wordmark-white", 128],
];
for (const [file, name, height] of wordmarks) {
  const src = (await readdir(logos).catch(() => [])).includes(file)
    ? path.join(logos, file)
    : path.join(repo, "assets/brand", file);
  const trimmed = await sharp(src).trim().toBuffer();
  const img = sharp(trimmed).resize({ height });
  const { width } = await img.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  await img.clone().webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(out, `${name}.webp`));
  await img.clone().png({ compressionLevel: 9, palette: true }).toFile(path.join(out, `${name}.png`));
  console.log(`wordmark ${name} ${width}x${height}`);
}
