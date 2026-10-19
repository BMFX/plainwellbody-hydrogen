import { Cache, gql } from "@shopify/hydrogen";
import { Link, redirect } from "react-router";

import { CONTENT_PAGES } from "~/components/ContentPages";
import { loadCatalog } from "~/lib/plainwell-catalog";

import { storefrontClientContext } from "~/lib/storefront";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/page";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/ErrorPage";

const PAGE_QUERY = gql(`
  query PlainwellPage($handle: String!) {
    page(handle: $handle) {
      id
      handle
      title
      body
      seo {
        title
        description
      }
    }
  }
`);

export function meta({ matches, data }: Route.MetaArgs) {
  const shopName = getShopNameFromRootMatch(matches[0]);
  const page = data?.page;
  return [
    { title: formatPageTitle(page?.seo?.title || page?.title || "Page", shopName) },
    ...((page?.seo?.description || (page && CONTENT_PAGES[page.handle]?.description))
      ? [{ name: "description", content: page?.seo?.description || CONTENT_PAGES[page!.handle].description }]
      : []),
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  // The store's privacy policy is a Shopify policy, not a page.
  if (params.handle === "privacy") throw redirect("/policies/privacy-policy", 301);
  const storefrontClient = context.get(storefrontClientContext);
  const content = CONTENT_PAGES[params.handle];
  const { data, errors } = await storefrontClient.graphql(PAGE_QUERY, {
    variables: { handle: params.handle },
    cache: Cache.short(),
  });
  if (errors?.length) {
    console.error(`Page query failed: ${errors.map((e) => e.message).join("; ")}`);
    throw new Response("Page query failed", { status: 500 });
  }
  if (!data?.page) throw new Response("Not Found", { status: 404 });
  let products: Awaited<ReturnType<typeof loadCatalog>>["live"] = [];
  if (content?.products) {
    const catalog = await loadCatalog(storefrontClient);
    products = content.products.flatMap((handle) => catalog.live.filter((item) => item.handle === handle));
  }
  return { page: data.page, products };
}

// Plainwell's editorial pages render their designed layouts (ContentPages.tsx); the
// Shopify page supplies the handle, title and SEO fields. Any other page renders its
// Shopify body, or a visible placeholder when the body is empty.
export default function PageRoute({ loaderData }: Route.ComponentProps) {
  const { page } = loaderData;
  const Content = CONTENT_PAGES[page.handle]?.component;
  if (Content) {
    return (
      <main className="flex-1" id="main-content" tabIndex={-1}>
        <Content data={{ products: loaderData.products }} />
      </main>
    );
  }

  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <section className="pw-gutter flex flex-col gap-4 pt-[72px] pb-10">
        <span className="pw-eyebrow">Plainwell Body Co.</span>
        <h1 className="pw-h1">{page.title}</h1>
      </section>
      <section className="pw-gutter border-line border-t pt-10 pb-28">
        {page.body.trim() ? (
          <div className="richtext max-w-[680px] text-base" dangerouslySetInnerHTML={{ __html: page.body }} />
        ) : (
          <div className="flex max-w-[620px] flex-col items-start gap-5">
            <p className="text-muted text-base">[Page content in progress]</p>
            <Link to="/collections/all" className="pw-link">
              Shop all essentials
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
