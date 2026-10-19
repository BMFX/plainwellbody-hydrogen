import { Cache, gql } from "@shopify/hydrogen";
import { Link } from "react-router";

import { storefrontClientContext } from "~/lib/storefront";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/page";

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
    ...(page?.seo?.description ? [{ name: "description", content: page.seo.description }] : []),
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const storefrontClient = context.get(storefrontClientContext);
  const { data, errors } = await storefrontClient.graphql(PAGE_QUERY, {
    variables: { handle: params.handle },
    cache: Cache.short(),
  });
  if (errors?.length) {
    console.error(`Page query failed: ${errors.map((e) => e.message).join("; ")}`);
    throw new Response("Page query failed", { status: 500 });
  }
  if (!data?.page) throw new Response("Not Found", { status: 404 });
  return { page: data.page };
}

// Store pages render their Shopify body. Plainwell's editorial pages (story, ingredients,
// journal, FAQ, routine finder) have empty bodies: their designed layouts are still to be
// ported from the Claude Design canvas, so they show a visible placeholder until then.
export default function PageRoute({ loaderData }: Route.ComponentProps) {
  const { page } = loaderData;

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
