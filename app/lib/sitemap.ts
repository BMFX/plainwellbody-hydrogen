import { Cache, gql } from "@shopify/hydrogen";

import { loadPolicyLinks } from "~/lib/policies";
import type { RequestStorefrontClient } from "~/lib/storefront";

// Hydrogen 2026.10 no longer ships sitemap helpers, so the storefront lists what Shopify
// publishes to it: every page, collection and product, and the shop's policies. The home
// page appears as /, and the Shop all collection as /collections/all.
const SITEMAP_QUERY = gql(`
  query PlainwellSitemap {
    pages(first: 250) {
      nodes {
        handle
      }
    }
    collections(first: 250) {
      nodes {
        handle
      }
    }
    products(first: 250) {
      nodes {
        handle
      }
    }
    settings: metaobject(handle: { type: "pw_settings", handle: "site" }) {
      home: field(key: "home_page") {
        reference {
          ... on Page {
            handle
          }
        }
      }
      shopAll: field(key: "shop_all") {
        reference {
          ... on Collection {
            handle
          }
        }
      }
    }
  }
`);

export async function sitemapPaths(client: Pick<RequestStorefrontClient, "graphql">) {
  const [{ data, errors }, policies] = await Promise.all([client.graphql(SITEMAP_QUERY, { cache: Cache.short() }), loadPolicyLinks(client)]);
  if (errors?.length || !data) throw new Error(`Sitemap query failed: ${(errors ?? []).map((e) => e.message).join("; ")}`);
  const home = (data.settings?.home?.reference as { handle?: string } | null | undefined)?.handle;
  const shopAll = (data.settings?.shopAll?.reference as { handle?: string } | null | undefined)?.handle;
  const paths = new Set<string>(["/"]);
  for (const c of data.collections.nodes) paths.add(c.handle === shopAll ? "/collections/all" : `/collections/${c.handle}`);
  for (const p of data.products.nodes) paths.add(`/products/${p.handle}`);
  for (const p of data.pages.nodes) if (p.handle !== home) paths.add(`/pages/${p.handle}`);
  for (const policy of Object.values(policies)) if (policy) paths.add(`/policies/${policy.handle}`);
  return [...paths];
}
