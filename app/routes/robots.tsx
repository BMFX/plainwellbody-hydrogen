import type { Route } from "./+types/robots";

// robots.txt: everything public is crawlable; personal, transactional and endless
// parameter pages are not. Points crawlers at the sitemap on the primary domain.
export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const body = [
    "User-agent: *",
    "Disallow: /cart",
    "Disallow: /account",
    "Disallow: /checkout",
    "Disallow: /checkouts/",
    "Disallow: /api/",
    "Disallow: /newsletter",
    "Disallow: /search",
    "Disallow: /*?*sort=",
    "Disallow: /*?*qty.",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
