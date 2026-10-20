import { useRouteLoaderData } from "react-router";

import { leadImage, Sections } from "~/components/Sections";
import { imagePreload } from "~/components/ShopifyImage";
import { envContext } from "~/lib/env";
import { shopifyImageUrl } from "~/lib/images";
import { loadHomePage } from "~/lib/pages";
import { seoMeta } from "~/lib/seo";
import { storefrontClientContext } from "~/lib/storefront";
import type { loader as rootLoader } from "~/root";

import type { Route } from "./+types/home";

// The home page is the Shopify page chosen in Site settings › Home page; its sections and SEO
// fields are edited there.

export function meta({ matches, data }: Route.MetaArgs) {
  if (!data) return seoMeta(matches[0], { title: "", path: "/" });
  const { page, sections } = data;
  const image = leadImage(sections);
  const preload = imagePreload(image, "100vw");
  return [
    ...seoMeta(matches[0], {
      // The page's SEO title is the whole title on the home page, without the shop suffix.
      title: page.seoTitle || page.title,
      titleIsFull: Boolean(page.seoTitle),
      description: page.seoDescription || null,
      path: "/",
    }),
    ...(preload ? [preload] : []),
  ];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const loaded = await loadHomePage(context.get(storefrontClientContext), [env.PUBLIC_STORE_DOMAIN, new URL(request.url).hostname]);
  if (!loaded) throw new Response("Not Found", { status: 404 });
  return loaded;
}

// Who the site belongs to, and its search, for search engines' brand panel and sitelinks.
function SiteJsonLd() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const origin = root?.primaryOrigin;
  if (!origin) return null;
  const logo = root.content.settings.icon ?? root.content.settings.logo;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: root.shopInfo.name,
        url: `${origin}/`,
        ...(logo ? { logo: { "@type": "ImageObject", url: shopifyImageUrl(logo.url, 512) } } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: root.shopInfo.name,
        url: `${origin}/`,
        publisher: { "@id": `${origin}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${origin}/search?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <SiteJsonLd />
      <Sections sections={loaderData.sections} />
    </main>
  );
}
