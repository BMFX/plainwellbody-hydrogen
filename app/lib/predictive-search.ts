import type { PredictiveSearchStatus } from "@shopify/hydrogen";

type SuggestionSummary = {
  status: PredictiveSearchStatus;
  result: { term: string; items: { products: readonly unknown[] } };
};

/**
 * Live-region text for the suggestion list. Only a settled result is
 * announced: the store flips to `loading` on every keystroke, and announcing
 * that would talk over the typist.
 */
export function describeSuggestions(
  { status, result }: SuggestionSummary,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (status !== "success") return "";
  const count = result.items.products.length;
  if (count === 0) return t("search.drawer.none", { term: result.term });
  return t(count === 1 ? "search.drawer.count_one" : "search.drawer.count_other", { count, term: result.term });
}
