import {
  AnalyticsEvent,
  createPredictiveSearchFormRegister,
  getSortByValue,
} from "@shopify/hydrogen";
import { CollectionProvider } from "@shopify/hydrogen/react";
import { useEffect } from "react";
import { Link, useLocation, useNavigate, useNavigation, useSearchParams } from "react-router";

import {
  ActiveFilterChips,
  FacetForm,
  FilterDrawer,
  LoadMore,
  SEARCH_SORT_OPTIONS,
  Toolbar,
  useLoadMore,
} from "~/components/CollectionBrowse";
import { cardFromProduct, ProductGrid as CardGrid } from "~/components/ProductCard";
import { loadSearchPage, type SearchPageData } from "~/lib/search";
import { storefrontClientContext } from "~/lib/storefront";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/search";

export function meta({ matches }: Route.MetaArgs) {
  const shopName = getShopNameFromRootMatch(matches[0]);
  return [
    { title: formatPageTitle("Search", shopName) },
    {
      name: "description",
      content: `Search products at ${shopName}.`,
    },
  ];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const storefrontClient = context.get(storefrontClientContext);
  return loadSearchPage({ storefrontClient, request });
}

type PerformedSearchData = Extract<SearchPageData, { performed: true }>;
type ProductNode = PerformedSearchData["products"][number];

function SearchViewedTracker({
  searchTerm,
  totalCount,
}: {
  searchTerm: string;
  totalCount: number;
}) {
  useEffect(() => {
    if (!searchTerm) return;

    window.Shopify?.analytics?.publish(AnalyticsEvent.SEARCH_VIEWED, {
      searchTerm,
      searchResults: { totalCount },
    });
  }, [searchTerm, totalCount]);

  return null;
}

function BreadcrumbJsonLd({ origin }: { origin: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${origin}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Search",
        item: `${origin}/search`,
      },
    ],
  };

  return <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>;
}


const registerSearchForm = createPredictiveSearchFormRegister();

const SUGGESTIONS = ["Citrus", "Cedar", "Unscented", "Hand balm", "Travel"];

function SearchHeader({ term }: { term: string }) {
  return (
    <section className="pw-gutter flex flex-col gap-7 pt-14 pb-10 md:pt-[72px]">
      <span className="pw-eyebrow">Search</span>
      <h1 className="pw-h1">Find your everyday.</h1>
      <form action="/search" method="get" role="search" aria-label="Search" className="border-ink flex max-w-[720px] items-center gap-4 border-b">
        <label htmlFor="search-q" className="sr-only">
          Search products
        </label>
          <input
            key={term}
            {...registerSearchForm("query")}
            id="search-q"
            defaultValue={term}
            placeholder="Search products"
            className="!h-16 min-w-0 flex-1 !border-0 !bg-transparent !px-0 text-[28px] tracking-[-0.015em] max-sm:text-[22px]"
          />
        {term ? (
          <Link to="/search" className="text-muted shrink-0 text-[13px] underline underline-offset-4">
            Clear
          </Link>
        ) : null}
      </form>
      <nav aria-label="Suggestions" className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((label) => {
          const active = label.toLowerCase() === term.trim().toLowerCase();
          return (
            <Link
              key={label}
              to={`/search?q=${encodeURIComponent(label.toLowerCase())}`}
              aria-current={active ? "true" : undefined}
              className={`inline-flex h-10 items-center border px-4 text-[13px] ${active ? "border-ink" : "border-line hover:border-ink"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

function searchTermHiddenInput(term: string) {
  return <input type="hidden" name="q" value={term} />;
}

function ProductGrid({ products }: { products: readonly ProductNode[] }) {
  return <CardGrid items={products.map(cardFromProduct)} priorityCount={2} columns={3} />;
}

function NoResults({ term }: { term: string }) {
  return (
    <div aria-live="polite" className="border-line flex flex-col items-center gap-3.5 border-y py-24 text-center">
      <h2 className="pw-title">No matches for “{term}”.</h2>
      <p className="text-muted">Try a product name or a scent family.</p>
      <Link to="/collections/all" className="pw-link">
        Explore your essentials
      </Link>
    </div>
  );
}

function SearchResults({ loaderData }: { loaderData: PerformedSearchData }) {
  const location = useLocation();
  const navigation = useNavigation();
  const isUpdating =
    navigation.state === "loading" &&
    navigation.location?.pathname === location.pathname &&
    navigation.location.search !== location.search;
  const { nodes, pageInfo, isLoading, loadMore } = useLoadMore(
    loaderData.products,
    loaderData.pageInfo,
    loaderData.dataSearch,
  );
  const defaultSortValue = getSortByValue("RELEVANCE", false);
  const countText = `${nodes.length} results found for “${loaderData.searchTerm}”`;
  const searchPath = `/search?q=${encodeURIComponent(loaderData.searchTerm)}`;
  const hiddenQuery = searchTermHiddenInput(loaderData.searchTerm);

  if (nodes.length === 0) return <NoResults term={loaderData.searchTerm} />;

  return (
    <>
      <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-8">
            <h2 className="type-heading-sm text-on-surface mb-2">Filters</h2>
            <FacetForm
              availableFilters={loaderData.availableFilters}
              currencyCode={loaderData.currencyCode}
              extraHiddenInputs={searchTermHiddenInput(loaderData.searchTerm)}
            />
          </div>
        </aside>
        <div>
          <Toolbar
            countText={countText}
            sortOptions={SEARCH_SORT_OPTIONS}
            defaultSortValue={defaultSortValue}
            extraHiddenInputs={hiddenQuery}
          />
          <ActiveFilterChips
            basePath={searchPath}
            clearAllTo={searchPath}
            currencyCode={loaderData.currencyCode}
          />
          <h2 className="sr-only">Search results</h2>
          <div
            aria-busy={isUpdating}
            className={`motion-safe:transition-opacity motion-safe:duration-150 ${isUpdating ? "opacity-60" : "opacity-100"}`}
          >
            <ProductGrid products={nodes} />
          </div>
          <LoadMore
            pageInfo={pageInfo}
            loadedCount={nodes.length}
            countLabel={`Showing ${nodes.length} of ${loaderData.totalCount} results`}
            isLoading={isLoading}
            onLoad={loadMore}
          />
        </div>
      </div>
      <FilterDrawer
        availableFilters={loaderData.availableFilters}
        currencyCode={loaderData.currencyCode}
        extraHiddenInputs={searchTermHiddenInput(loaderData.searchTerm)}
      />
    </>
  );
}

export default function SearchRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return (
    <CollectionProvider
      data={{ handle: `search:${loaderData.searchTerm}`, dataSearch: loaderData.dataSearch }}
      urlSearch={searchParams.toString()}
      onChange={(search) => {
        const nextParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        if (loaderData.searchTerm && !nextParams.has("q"))
          nextParams.set("q", loaderData.searchTerm);
        nextParams.delete("after");
        const nextSearch = nextParams.toString();
        void navigate(
          { search: nextSearch ? `?${nextSearch}` : "" },
          {
            replace: searchParams.size > 0,
            preventScrollReset: true,
          },
        );
      }}
    >
      {loaderData.performed ? (
        <SearchViewedTracker
          searchTerm={loaderData.searchTerm}
          totalCount={loaderData.totalCount}
        />
      ) : null}
      <main className="flex-1" id="main-content" tabIndex={-1}>
        <BreadcrumbJsonLd origin={loaderData.origin} />
        <SearchHeader term={loaderData.searchTerm} />
        {loaderData.performed ? (
          <div className="pw-gutter pb-28">
            <SearchResults loaderData={loaderData} />
          </div>
        ) : null}
      </main>
    </CollectionProvider>
  );
}
