import { AnalyticsEvent, createPredictiveSearchFormRegister } from "@shopify/hydrogen";
import { useEffect } from "react";
import { Form, Link, useNavigation, useSubmit } from "react-router";

import { ProductGrid } from "~/components/ProductCard";
import { loadSearch, SEARCH_SORTS, type SearchSort } from "~/lib/search";
import { seoMeta } from "~/lib/seo";
import { storefrontClientContext } from "~/lib/storefront";
import { useSiteContent, useText } from "~/lib/text";

import type { Route } from "./+types/search";

const SORT_KEYS: Record<SearchSort, string> = {
  relevance: "search.sort.relevance",
  "price-asc": "collection.sort.price_asc",
  "price-desc": "collection.sort.price_desc",
};

export function meta({ matches, location }: Route.MetaArgs) {
  const text = (matches[0]?.data as { content?: { text: Record<string, string> } } | undefined)?.content?.text ?? {};
  const term = new URLSearchParams(location.search).get("q")?.trim();
  // Results pages are endless near-duplicates; keep them out of the index, follow their links.
  return seoMeta(matches[0], {
    title: term ? (text["seo.search_title"] ?? "").replace("{term}", term) : (text["nav.search"] ?? ""),
    description: text["seo.search_description"] ?? null,
    path: "/search",
    noindex: true,
  });
}

export async function loader({ context, request }: Route.LoaderArgs) {
  return loadSearch(context.get(storefrontClientContext), new URL(request.url));
}

const registerSearchForm = createPredictiveSearchFormRegister();

export default function SearchRoute({ loaderData }: Route.ComponentProps) {
  const { term, sort, items, totalCount, nextCursor } = loaderData;
  const t = useText();
  const content = useSiteContent();
  const submit = useSubmit();
  const navigation = useNavigation();
  const updating = navigation.state === "loading" && navigation.location?.pathname === "/search";

  useEffect(() => {
    if (term) window.Shopify?.analytics?.publish(AnalyticsEvent.SEARCH_VIEWED, { searchTerm: term, searchResults: { totalCount } });
  }, [term, totalCount]);

  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <section className="pw-gutter flex flex-col gap-7 pt-14 pb-10 md:pt-[72px]">
        <span className="pw-eyebrow">{t("search.eyebrow")}</span>
        <h1 className="pw-h1">{t("search.heading")}</h1>
        <form action="/search" method="get" role="search" aria-label={t("nav.search")} className="border-ink flex max-w-[720px] items-center gap-4 border-b">
          <label htmlFor="search-q" className="sr-only">
            {t("search.input_label")}
          </label>
          <input
            key={term}
            {...registerSearchForm("query")}
            id="search-q"
            defaultValue={term}
            placeholder={t("search.input_label")}
            className="!h-16 min-w-0 flex-1 !border-0 !bg-transparent !px-0 text-[28px] tracking-[-0.015em] max-sm:text-[22px]"
          />
          {term ? (
            <Link to="/search" className="text-muted shrink-0 text-[13px] underline underline-offset-4">
              {t("search.clear")}
            </Link>
          ) : null}
        </form>
        {content?.menus.suggestions.length ? (
          <nav aria-label={t("search.suggestions_label")} className="flex flex-wrap gap-2">
            {content.menus.suggestions.map((item) => {
              const active = new URLSearchParams(item.url.split("?")[1] ?? "").get("q")?.toLowerCase() === term.toLowerCase();
              return (
                <Link
                  key={item.url + item.title}
                  to={item.url}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex h-10 items-center border px-4 text-[13px] ${active ? "border-ink" : "border-line hover:border-ink"}`}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </section>

      {term ? (
        <section className={`pb-28 motion-safe:transition-opacity ${updating ? "opacity-60" : ""}`} aria-busy={updating} aria-labelledby="results-heading">
          <h2 id="results-heading" className="sr-only">
            {t("search.results_heading")}
          </h2>
          {items.length ? (
            <>
              <div className="pw-gutter flex flex-wrap items-center justify-between gap-4 pb-6 text-[13px]">
                <span className="text-muted" aria-live="polite">
                  {t(totalCount === 1 ? "search.count_one" : "search.count_other", { count: totalCount, term })}
                </span>
                <Form method="get" preventScrollReset replace className="flex h-11 items-center gap-5" onChange={(e) => submit(e.currentTarget, { preventScrollReset: true, replace: true })}>
                  <input type="hidden" name="q" value={term} />
                  <label htmlFor="search-sort" className="text-muted">
                    {t("collection.sort")}
                  </label>
                  <select id="search-sort" name="sort" defaultValue={sort} key={sort} className="border-ink !w-auto border-0 border-b !bg-transparent !px-0 !py-1 text-[13px]">
                    {SEARCH_SORTS.map((value) => (
                      <option key={value} value={value}>
                        {t(SORT_KEYS[value])}
                      </option>
                    ))}
                  </select>
                  <noscript>
                    <button type="submit" className="pw-link">
                      {t("collection.apply")}
                    </button>
                  </noscript>
                </Form>
              </div>
              <ProductGrid items={items} priorityCount={2} />
              {nextCursor ? (
                <div className="flex justify-center pt-12">
                  <Link to={`/search?${new URLSearchParams({ q: term, sort, after: nextCursor })}`} className="pw-btn pw-btn--secondary">
                    {t("search.next_page")}
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div aria-live="polite" className="pw-gutter border-line flex flex-col items-center gap-3.5 border-y py-24 text-center">
              <p className="pw-title">{t("search.empty", { term })}</p>
              <p className="text-muted">{t("search.empty_hint")}</p>
              <Link to="/collections/all" className="pw-link">
                {t("search.empty_link")}
              </Link>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
