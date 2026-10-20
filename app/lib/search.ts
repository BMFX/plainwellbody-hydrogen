import { Cache, gql, type StorefrontApi } from "@shopify/hydrogen";

import { cardFromProduct, PRODUCT_CARD_FRAGMENT } from "~/components/ProductCard";
import type { RequestStorefrontClient } from "~/lib/storefront";

export const SEARCH_PAGE_SIZE = 24;
export type SearchSort = "relevance" | "price-asc" | "price-desc";
export const SEARCH_SORTS: SearchSort[] = ["relevance", "price-asc", "price-desc"];

export const SEARCH_QUERY = gql(
  `
    query PlainwellSearch($term: String!, $first: Int!, $after: String, $sortKey: SearchSortKeys!, $reverse: Boolean!) {
      search(query: $term, types: [PRODUCT], first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          __typename
          ... on Product {
            ...ProductCard
          }
        }
      }
    }
  `,
  [PRODUCT_CARD_FRAGMENT],
);

type Node = StorefrontApi.ResultOf<typeof SEARCH_QUERY>["search"]["nodes"][number];
type ProductNode = Extract<Node, { __typename: "Product" }>;

export async function loadSearch(client: Pick<RequestStorefrontClient, "graphql">, url: URL) {
  const term = (url.searchParams.get("q") ?? "").trim();
  const sortParam = url.searchParams.get("sort") as SearchSort | null;
  const sort: SearchSort = sortParam && SEARCH_SORTS.includes(sortParam) ? sortParam : "relevance";
  if (!term) return { term, sort, items: [], totalCount: 0, nextCursor: null as string | null };

  const { data, errors } = await client.graphql(SEARCH_QUERY, {
    variables: {
      term,
      first: SEARCH_PAGE_SIZE,
      after: url.searchParams.get("after") || null,
      sortKey: sort === "relevance" ? "RELEVANCE" : "PRICE",
      reverse: sort === "price-desc",
    },
    cache: Cache.short(),
  });
  if (errors?.length || !data) throw new Error(`Search failed: ${(errors ?? []).map((e) => e.message).join("; ")}`);
  const products = data.search.nodes.filter((n): n is ProductNode => n.__typename === "Product");
  const cards = products.map(cardFromProduct);
  return {
    term,
    sort,
    items: [...cards.filter((c) => !c.comingSoon), ...cards.filter((c) => c.comingSoon)],
    totalCount: data.search.totalCount,
    nextCursor: data.search.pageInfo.hasNextPage ? (data.search.pageInfo.endCursor ?? null) : null,
  };
}
