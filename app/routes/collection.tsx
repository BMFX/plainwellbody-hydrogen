import { AnalyticsEvent } from "@shopify/hydrogen";
import { useEffect } from "react";
import { Form, Link, NavLink, useNavigation, useSubmit } from "react-router";

import { Media, mediaPreload } from "~/components/Media";
import { ProductGrid } from "~/components/ProductCard";
import { RoutineBlock } from "~/components/RoutineBlock";
import { ShopifyCollection } from "~/components/ShopifyCollection";
import { loadCollectionPage } from "~/lib/collection";
import {
  CATEGORY_TABS,
  findCollectionPage,
  SCENT_FILTERS,
  type CollectionPage,
  type Scent,
} from "~/lib/plainwell";
import { browse, loadCatalog, parseSort, SORT_OPTIONS } from "~/lib/plainwell-catalog";
import { storefrontClientContext } from "~/lib/storefront";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/collection";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/ErrorPage";

const BANNER_SIZES = "100vw";

export function meta({ matches, data }: Route.MetaArgs) {
  const shopName = getShopNameFromRootMatch(matches[0]);
  if (data?.kind === "plainwell") {
    return [
      { title: formatPageTitle(data.page.title, shopName) },
      { name: "description", content: data.page.intro },
      { tagName: "link", rel: "canonical", href: `${data.origin}/collections/${data.page.handle === "plainwell" ? "all" : data.page.handle}` },
      // The banner is the LCP image on every Plainwell collection page.
      { tagName: "link", ...mediaPreload(data.page.banner.name, BANNER_SIZES) },
    ];
  }
  const title = data?.kind === "shopify" ? data.collection.title : "Collection";
  return [
    { title: formatPageTitle(title, shopName) },
    { name: "description", content: `Shop ${title} at ${shopName}.` },
  ];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const handle = params.handle;
  if (!handle) throw new Response("Not Found", { status: 404 });
  const storefrontClient = context.get(storefrontClientContext);
  const page = findCollectionPage(handle);

  if (!page) {
    return { kind: "shopify" as const, ...(await loadCollectionPage({ storefrontClient, handle, request })) };
  }

  const url = new URL(request.url);
  const scentParam = url.searchParams.get("scent");
  const scent = page.scent ?? SCENT_FILTERS.find((s) => s.value === scentParam)?.value;
  const sort = parseSort(url.searchParams.get("sort"));
  const catalog = await loadCatalog(storefrontClient);
  const result = browse(catalog, { category: page.category, family: page.family, scent }, sort);

  return {
    kind: "plainwell" as const,
    page,
    collection: catalog.collection,
    scent: scent ?? null,
    sort,
    ...result,
    origin: url.origin,
  };
}

export default function CollectionRoute({ loaderData }: Route.ComponentProps) {
  if (loaderData.kind === "shopify") return <ShopifyCollection loaderData={loaderData} />;
  return <PlainwellCollection data={loaderData} />;
}

type PlainwellData = Extract<Route.ComponentProps["loaderData"], { kind: "plainwell" }>;

function PlainwellCollection({ data }: { data: PlainwellData }) {
  const { page, items, liveCount, comingSoonCount, collection } = data;
  const navigation = useNavigation();
  const updating = navigation.state === "loading" && navigation.location?.pathname.startsWith("/collections/");

  useEffect(() => {
    window.Shopify?.analytics?.publish(AnalyticsEvent.COLLECTION_VIEWED, {
      collection: { id: collection.id, handle: collection.handle },
    });
  }, [collection.id, collection.handle, page.handle]);

  const total = items.length;
  const countLabel =
    `${total} ${total === 1 ? "product" : "products"}` + (comingSoonCount && liveCount ? ` · ${comingSoonCount} coming soon` : "");

  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <BreadcrumbJsonLd page={page} origin={data.origin} />
      <section className="pw-gutter grid items-end gap-x-16 gap-y-6 pt-14 pb-10 md:grid-cols-2 md:pt-[72px]">
        <div className="flex flex-col gap-4">
          <span className="pw-eyebrow">{page.eyebrow}</span>
          <h1 className="pw-h1">{page.title}</h1>
        </div>
        <p className="pw-lead">{page.intro}</p>
      </section>

      <Media
        name={page.banner.name}
        alt={page.banner.alt}
        sizes={BANNER_SIZES}
        width={1600}
        height={900}
        priority
        className="block h-[260px] w-full object-cover md:h-[440px]"
      />

      <section className="pw-gutter flex flex-col gap-1 pt-8" aria-label="Filter and sort">
        {page.scent || page.family ? null : (
          <nav aria-label="Category" className="border-line scrollbar-none -mx-[var(--spacing-gutter)] flex gap-x-7 overflow-x-auto border-b px-[var(--spacing-gutter)] whitespace-nowrap md:mx-0 md:px-0">
            {CATEGORY_TABS.map((tab) => (
              <NavLink
                key={tab.href}
                to={{ pathname: tab.href, search: data.scent ? `?scent=${data.scent}` : "" }}
                preventScrollReset
                end
                className={({ isActive }) =>
                  `relative inline-flex h-11 shrink-0 items-center text-sm ${isActive || (tab.href === "/collections/all" && page.handle === "plainwell") ? "text-ink after:bg-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px" : "text-muted hover:text-ink"}`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          {page.scent ? (
            <span />
          ) : (
            <ScentTabs pathname={`/collections/${page.handle}`} scent={data.scent} sort={data.sort} />
          )}
          <SortForm countLabel={countLabel} scent={page.scent ? null : data.scent} sort={data.sort} />
        </div>
      </section>

      <section
        className={`pt-7 motion-safe:transition-opacity ${updating ? "opacity-60" : ""}`}
        aria-busy={updating}
        aria-labelledby="products-heading"
      >
        <h2 id="products-heading" className="sr-only">
          Products
        </h2>
        {items.length ? (
          <ProductGrid items={items} priorityCount={0} />
        ) : (
          <div className="pw-gutter border-line flex flex-col items-center gap-4 border-y py-24 text-center">
            <p className="pw-heading">Nothing in that combination yet.</p>
            <Link to={`/collections/${page.handle}`} preventScrollReset className="pw-link">
              Show everything
            </Link>
          </div>
        )}
      </section>

      <RoutineBlock />
    </main>
  );
}

function ScentTabs({ pathname, scent, sort }: { pathname: string; scent: Scent | null; sort: string }) {
  const options = [{ value: null, label: "All scents" }, ...SCENT_FILTERS];
  return (
    <nav aria-label="Scent" className="scrollbar-none -mx-[var(--spacing-gutter)] flex max-w-[100vw] gap-x-7 overflow-x-auto px-[var(--spacing-gutter)] whitespace-nowrap md:mx-0 md:px-0">
      {options.map((option) => {
        const params = new URLSearchParams();
        if (option.value) params.set("scent", option.value);
        if (sort !== "featured") params.set("sort", sort);
        const active = option.value === scent;
        const search = params.toString();
        return (
          <Link
            key={option.label}
            to={{ pathname, search: search ? `?${search}` : "" }}
            preventScrollReset
            replace
            aria-current={active ? "true" : undefined}
            className={`relative inline-flex h-11 shrink-0 items-center text-sm ${active ? "text-ink after:bg-ink after:absolute after:inset-x-0 after:bottom-2 after:h-px" : "text-muted hover:text-ink"}`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SortForm({ countLabel, scent, sort }: { countLabel: string; scent: Scent | null; sort: string }) {
  const submit = useSubmit();
  return (
    <Form
      method="get"
      preventScrollReset
      replace
      className="flex h-11 items-center gap-5 text-[13px]"
      onChange={(event) => submit(event.currentTarget, { preventScrollReset: true, replace: true })}
    >
      <span className="text-muted" aria-live="polite">
        {countLabel}
      </span>
      {scent ? <input type="hidden" name="scent" value={scent} /> : null}
      <label htmlFor="pw-sort" className="text-muted">
        Sort
      </label>
      <select
        id="pw-sort"
        name="sort"
        defaultValue={sort}
        key={sort}
        className="border-ink !w-auto border-0 border-b !bg-transparent !px-0 !py-1 text-[13px]"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="pw-link">
          Apply
        </button>
      </noscript>
    </Form>
  );
}

function BreadcrumbJsonLd({ page, origin }: { page: CollectionPage; origin: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: page.title, item: `${origin}/collections/${page.handle}` },
    ],
  };
  return <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>;
}
