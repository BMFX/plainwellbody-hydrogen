import { Cache, gql } from "@shopify/hydrogen";

import {
  cardFromConcept,
  cardFromProduct,
  PRODUCT_CARD_FRAGMENT,
  type CardItem,
} from "~/components/ProductCard";
import {
  CONCEPT_PRODUCTS,
  FAMILY_ORDER,
  FEATURED_FIRST,
  PLAINWELL_COLLECTION,
  SCENT_ORDER,
  type CategoryKey,
  type Scent,
} from "~/lib/plainwell";
import type { RequestStorefrontClient } from "~/lib/storefront";

// The whole range is 29 products, so collection pages, product-page scent switches and
// "Pairs well with" all read one cached query and filter on the server.
const CATALOG_QUERY = gql(
  `
    query PlainwellCatalog($handle: String!) {
      collection(handle: $handle) {
        id
        handle
        title
        products(first: 100) {
          nodes {
            ...ProductCard
          }
        }
      }
    }
  `,
  [PRODUCT_CARD_FRAGMENT],
);

export async function loadCatalog(storefrontClient: Pick<RequestStorefrontClient, "graphql">) {
  const { data, errors } = await storefrontClient.graphql(CATALOG_QUERY, {
    variables: { handle: PLAINWELL_COLLECTION },
    cache: Cache.short(),
  });
  if (errors?.length || !data?.collection) {
    console.error(`Plainwell catalog query failed: ${(errors ?? []).map((e) => e.message).join("; ") || "no collection"}`);
    throw new Response("Catalog unavailable", { status: 500 });
  }
  const { products, ...collection } = data.collection;
  return {
    collection,
    live: products.nodes.map(cardFromProduct),
    concepts: CONCEPT_PRODUCTS.map(cardFromConcept),
  };
}

export type CatalogFilter = {
  category?: CategoryKey;
  scent?: Scent;
  family?: string;
};

export type SortKey = "featured" | "price-asc" | "price-desc";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
];

export function parseSort(value: string | null): SortKey {
  return SORT_OPTIONS.some((o) => o.value === value) ? (value as SortKey) : "featured";
}

function matches(item: CardItem, filter: CatalogFilter) {
  return (
    (!filter.category || item.category === filter.category) &&
    (!filter.scent || item.scent === filter.scent) &&
    (!filter.family || item.family === filter.family) &&
    // Refills sit in their own collection, not under Body.
    !(filter.category === "body-care" && item.family === "body-wash-refill" && !filter.family)
  );
}

const cents = (item: CardItem) =>
  Math.round(Number(item.live?.selectedOrFirstAvailableVariant?.price.amount ?? item.live?.priceRange.minVariantPrice.amount ?? 0) * 100);

/** Live products first (featured or by price), then coming-soon products. */
export function browse(catalog: Awaited<ReturnType<typeof loadCatalog>>, filter: CatalogFilter, sort: SortKey) {
  const live = catalog.live.filter((item) => matches(item, filter));
  // Featured: the hero products, then scent by scent, each in range order.
  const rank = (item: CardItem) => {
    const featured = FEATURED_FIRST.indexOf(item.handle);
    if (featured >= 0) return featured;
    const scent = SCENT_ORDER.indexOf(item.scent ?? "botanical");
    return 100 + scent * 100 + Math.max(0, FAMILY_ORDER.indexOf(item.family));
  };
  if (sort === "featured") live.sort((a, b) => rank(a) - rank(b));
  if (sort === "price-asc") live.sort((a, b) => cents(a) - cents(b));
  if (sort === "price-desc") live.sort((a, b) => cents(b) - cents(a));
  const concepts = catalog.concepts.filter((item) => matches(item, filter));
  return { items: [...live, ...concepts], liveCount: live.length, comingSoonCount: concepts.length };
}
