import { sitemapPaths } from "~/lib/sitemap";
import { storefrontClientContext } from "~/lib/storefront";

import type { Route } from "./+types/sitemap";

export async function loader({ context, request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const paths = await sitemapPaths(context.get(storefrontClientContext));
  const urls = paths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
