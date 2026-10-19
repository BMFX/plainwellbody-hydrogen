import { Cache, gql } from "@shopify/hydrogen";

import { storefrontClientContext } from "~/lib/storefront";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/policy";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/ErrorPage";

const POLICIES_QUERY = gql(`
  query PlainwellPolicies {
    shop {
      privacyPolicy { ...Policy }
      refundPolicy { ...Policy }
      shippingPolicy { ...Policy }
      termsOfService { ...Policy }
      subscriptionPolicy { handle title body }
    }
  }
  fragment Policy on ShopPolicy {
    handle
    title
    body
  }
`);

export function meta({ matches, data }: Route.MetaArgs) {
  return [{ title: formatPageTitle(data?.policy.title ?? "Policy", getShopNameFromRootMatch(matches[0])) }];
}

// Shopify's legal policies (Settings › Policies), at their standard /policies/:handle URLs.
export async function loader({ context, params }: Route.LoaderArgs) {
  const { data, errors } = await context.get(storefrontClientContext).graphql(POLICIES_QUERY, { cache: Cache.long() });
  if (errors?.length) {
    console.error(`Policies query failed: ${errors.map((e) => e.message).join("; ")}`);
    throw new Response("Policies unavailable", { status: 500 });
  }
  const policy = Object.values(data?.shop ?? {}).find((p) => p && typeof p === "object" && "handle" in p && p.handle === params.handle);
  if (!policy || typeof policy !== "object" || !("body" in policy)) throw new Response("Not Found", { status: 404 });
  return { policy };
}

export default function PolicyRoute({ loaderData }: Route.ComponentProps) {
  const { policy } = loaderData;
  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <section className="pw-gutter flex flex-col gap-4 pt-14 pb-10 md:pt-[72px]">
        <span className="pw-eyebrow">Customer care</span>
        <h1 className="pw-h1">{policy.title}</h1>
      </section>
      <section className="pw-gutter border-line border-t pt-12 pb-28">
        <div className="richtext max-w-[720px] text-[15px]" dangerouslySetInnerHTML={{ __html: policy.body }} />
      </section>
    </main>
  );
}
