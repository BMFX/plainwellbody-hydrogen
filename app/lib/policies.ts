import { Cache, gql } from "@shopify/hydrogen";

import type { RequestStorefrontClient } from "~/lib/storefront";

// Shopify's legal policies (Settings › Policies). Generate them from Shopify's templates
// and they appear on the site at /policies/<handle> without code changes.
export const POLICIES_QUERY = gql(`
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

export type PolicyLink = { handle: string; title: string };

export async function loadPolicies(storefrontClient: Pick<RequestStorefrontClient, "graphql">) {
  const { data, errors } = await storefrontClient.graphql(POLICIES_QUERY, { cache: Cache.long() });
  if (errors?.length) throw new Error(`Policies query failed: ${errors.map((e) => e.message).join("; ")}`);
  return data?.shop ?? null;
}

/** Titles and handles only, for linking from pages. */
export async function loadPolicyLinks(storefrontClient: Pick<RequestStorefrontClient, "graphql">) {
  const shop = await loadPolicies(storefrontClient).catch((error: Error) => {
    console.error(error.message);
    return null;
  });
  const link = (p: { handle: string; title: string } | null | undefined): PolicyLink | null =>
    p ? { handle: p.handle, title: p.title } : null;
  return {
    privacy: link(shop?.privacyPolicy),
    refund: link(shop?.refundPolicy),
    shipping: link(shop?.shippingPolicy),
    terms: link(shop?.termsOfService),
  };
}
