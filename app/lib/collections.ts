import { Cache, gql } from "@shopify/hydrogen";

import { cardFromProduct, PRODUCT_CARD_FRAGMENT, type CardItem } from "~/components/ProductCard";
import { hydrateProducts, normalizeLinks, SECTION_FRAGMENTS, storeHosts, untypedQuery } from "~/lib/content";
import type { RequestStorefrontClient } from "~/lib/storefront";

// Collections, all from Shopify. /collections/all shows the collection chosen in Site
// settings › Shop all collection.

export const COLLECTION_QUERY = gql(
  `
    query PlainwellCollection($handle: String!, $sortKey: ProductCollectionSortKeys!, $reverse: Boolean!) {
      shop {
        primaryDomain {
          host
        }
      }
      collection(handle: $handle) {
        id
        handle
        title
        description
        image {
          url
          altText
          width
          height
        }
        seo {
          title
          description
        }
        eyebrow: metafield(namespace: "plainwell", key: "eyebrow") {
          value
        }
        products(first: 250, sortKey: $sortKey, reverse: $reverse) {
          nodes {
            ...ProductCard
          }
        }
      }
    }
  `,
  [PRODUCT_CARD_FRAGMENT],
);

// The collection's sections (below the products), as a plain-string query; see content.ts.
const COLLECTION_SECTIONS_QUERY: string = `
  query PlainwellCollectionSections($handle: String!) {
    collection(handle: $handle) {
      sections: metafield(namespace: "plainwell", key: "sections") {
        references(first: 10) {
          nodes {
            __typename
            ... on Metaobject {
              ...PwSection
            }
          }
        }
      }
    }
  }
  ${SECTION_FRAGMENTS}
`;

export const SHOP_ALL_QUERY = gql(`
  query PlainwellShopAll {
    settings: metaobject(handle: { type: "pw_settings", handle: "site" }) {
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

type Client = Pick<RequestStorefrontClient, "graphql">;

export type SortKey = "featured" | "price-asc" | "price-desc";
export const SORTS: SortKey[] = ["featured", "price-asc", "price-desc"];
export function parseSort(value: string | null): SortKey {
  return SORTS.includes(value as SortKey) ? (value as SortKey) : "featured";
}

export async function shopAllHandle(client: Client): Promise<string | null> {
  const { data } = await client.graphql(SHOP_ALL_QUERY, { cache: Cache.short() });
  const ref = data?.settings?.shopAll?.reference as { handle?: string } | null | undefined;
  return ref?.handle ?? null;
}

export async function loadCollection(client: Client, handle: string, sort: SortKey, extraHosts: (string | null | undefined)[]) {
  const variables = {
    handle,
    sortKey: (sort === "featured" ? "COLLECTION_DEFAULT" : "PRICE") as "COLLECTION_DEFAULT" | "PRICE",
    reverse: sort === "price-desc",
  };
  const [{ data, errors }, extra] = await Promise.all([
    client.graphql(COLLECTION_QUERY, { variables, cache: Cache.short() }),
    untypedQuery<{ collection: { sections?: { references?: { nodes: unknown[] } | null } | null } | null }>(client, COLLECTION_SECTIONS_QUERY, { handle }),
  ]);
  if (errors?.length) throw new Error(`Collection query failed: ${errors.map((e) => e.message).join("; ")}`);
  if (!data?.collection) return null;
  const { products, eyebrow, ...collection } = data.collection;
  const sections = extra.collection?.sections;
  const hosts = storeHosts(data.shop.primaryDomain.host, ...extraHosts);
  const cards = products.nodes.map(cardFromProduct);
  // Coming-soon products have no price yet; they always follow what is on sale.
  const items = [...cards.filter((c) => !c.comingSoon), ...cards.filter((c) => c.comingSoon)];
  return {
    collection: { ...collection, eyebrow: eyebrow?.value ?? "" },
    sections: await hydrateProducts(client, normalizeLinks(sections?.references?.nodes ?? [], hosts)),
    items,
  };
}

/** The scent families present in a list of products, in their Shopify sort order. */
export function scentsOf(items: CardItem[]) {
  const map = new Map<string, { handle: string; name: string; sort: number }>();
  for (const item of items) if (item.scent && !map.has(item.scent.handle)) map.set(item.scent.handle, item.scent);
  return [...map.values()].sort((a, b) => a.sort - b.sort);
}
