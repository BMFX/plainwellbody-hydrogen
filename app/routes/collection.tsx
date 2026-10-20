import { AnalyticsEvent } from "@shopify/hydrogen";
import { useEffect } from "react";
import { Form, Link, redirect, useLocation, useNavigation, useSubmit } from "react-router";

import { ProductGrid } from "~/components/ProductCard";
import { Sections } from "~/components/Sections";
import { imagePreload, ShopifyImage } from "~/components/ShopifyImage";
import { loadCollection, parseSort, scentsOf, shopAllHandle, SORTS, type SortKey } from "~/lib/collections";
import { envContext } from "~/lib/env";
import { seoMeta } from "~/lib/seo";
import { storefrontClientContext } from "~/lib/storefront";
import { useSiteContent, useText } from "~/lib/text";

import type { Route } from "./+types/collection";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/ErrorPage";

const BANNER_SIZES = "100vw";
const SORT_KEYS: Record<SortKey, string> = {
  featured: "collection.sort.featured",
  "price-asc": "collection.sort.price_asc",
  "price-desc": "collection.sort.price_desc",
};

export function meta({ matches, data }: Route.MetaArgs) {
  if (!data) return seoMeta(matches[0], { title: "", path: "/collections/all", noindex: true });
  const { collection, path } = data;
  const preload = imagePreload(collection.image, BANNER_SIZES);
  return [
    ...seoMeta(matches[0], {
      title: collection.seo.title || collection.title,
      description: collection.seo.description || collection.description || null,
      path,
      image: collection.image ? { url: collection.image.url, alt: collection.image.altText ?? undefined } : null,
    }),
    ...(preload ? [preload] : []),
  ];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const handle = params.handle;
  if (!handle) throw new Response("Not Found", { status: 404 });
  const env = context.get(envContext);
  const client = context.get(storefrontClientContext);
  const url = new URL(request.url);
  const shopAll = await shopAllHandle(client);

  // /collections/all is the Shop all collection from Site settings; its own URL redirects here.
  if (handle !== "all" && handle === shopAll) throw redirect(`/collections/all${url.search}`, 301);
  const realHandle = handle === "all" ? shopAll : handle;
  if (!realHandle) throw new Response("Not Found", { status: 404 });

  const sort = parseSort(url.searchParams.get("sort"));
  const loaded = await loadCollection(client, realHandle, sort, [env.PUBLIC_STORE_DOMAIN, url.hostname]);
  if (!loaded) throw new Response("Not Found", { status: 404 });

  const scents = scentsOf(loaded.items);
  const scent = scents.find((s) => s.handle === url.searchParams.get("scent"))?.handle ?? null;
  const items = scent ? loaded.items.filter((item) => item.scent?.handle === scent) : loaded.items;
  return {
    ...loaded,
    path: `/collections/${handle}`,
    items,
    scents,
    scent,
    sort,
    origin: url.origin,
  };
}

export default function CollectionRoute({ loaderData }: Route.ComponentProps) {
  const { collection, items, scents, path, sections } = loaderData;
  const t = useText();
  const content = useSiteContent();
  const navigation = useNavigation();
  const updating = navigation.state === "loading" && navigation.location?.pathname.startsWith("/collections/");

  useEffect(() => {
    window.Shopify?.analytics?.publish(AnalyticsEvent.COLLECTION_VIEWED, {
      collection: { id: collection.id, handle: collection.handle },
    });
  }, [collection.id, collection.handle]);

  const categories = content?.menus.categories ?? [];
  const inCategories = categories.some((c) => c.url.split("?")[0] === path);
  const soon = items.filter((i) => i.comingSoon).length;
  const countBase = t(items.length === 1 ? "collection.count_one" : "collection.count_other", { count: items.length });
  const countLabel = soon && soon < items.length ? t("collection.count_soon", { count: countBase, soon }) : countBase;

  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <BreadcrumbJsonLd title={collection.title} path={path} origin={loaderData.origin} />
      <section className="pw-gutter grid items-end gap-x-16 gap-y-6 pt-14 pb-10 md:grid-cols-2 md:pt-[72px]">
        <div className="flex flex-col gap-4">
          {collection.eyebrow ? <span className="pw-eyebrow">{collection.eyebrow}</span> : null}
          <h1 className="pw-h1">{collection.title}</h1>
        </div>
        {collection.description ? <p className="pw-lead">{collection.description}</p> : null}
      </section>

      <ShopifyImage image={collection.image} sizes={BANNER_SIZES} priority className="block h-[260px] w-full object-cover md:h-[440px]" />

      <section className="pw-gutter flex flex-col gap-1 pt-8" aria-label={t("collection.filter_label")}>
        {inCategories ? (
          <nav
            aria-label={t("collection.categories_label")}
            className="border-line scrollbar-none -mx-[var(--spacing-gutter)] flex gap-x-7 overflow-x-auto border-b px-[var(--spacing-gutter)] whitespace-nowrap md:mx-0 md:px-0"
          >
            {categories.map((tab) => {
              const tabPath = tab.url.split("?")[0];
              const active = tabPath === path;
              return (
                <Link
                  key={tab.url + tab.title}
                  to={{ pathname: tabPath, search: loaderData.scent ? `?scent=${loaderData.scent}` : "" }}
                  preventScrollReset
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex h-11 shrink-0 items-center text-sm ${active ? "text-ink after:bg-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px" : "text-muted hover:text-ink"}`}
                >
                  {tab.title}
                </Link>
              );
            })}
          </nav>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          {scents.length > 1 ? <ScentTabs pathname={path} scents={scents} scent={loaderData.scent} sort={loaderData.sort} /> : <span />}
          <SortForm countLabel={countLabel} scent={loaderData.scent} sort={loaderData.sort} />
        </div>
      </section>

      <section className={`pt-7 motion-safe:transition-opacity ${updating ? "opacity-60" : ""}`} aria-busy={updating} aria-labelledby="products-heading">
        <h2 id="products-heading" className="sr-only">
          {t("collection.products_heading")}
        </h2>
        {items.length ? (
          <ProductGrid items={items} />
        ) : (
          <div className="pw-gutter border-line flex flex-col items-center gap-4 border-y py-24 text-center">
            <p className="pw-heading">{t("collection.empty")}</p>
            <Link to={path} preventScrollReset className="pw-link">
              {t("collection.empty_link")}
            </Link>
          </div>
        )}
      </section>

      {sections.length ? (
        <div className="mt-28">
          <Sections sections={sections} firstIsTitle={false} />
        </div>
      ) : null}
    </main>
  );
}

function ScentTabs({ pathname, scents, scent, sort }: { pathname: string; scents: { handle: string; name: string }[]; scent: string | null; sort: string }) {
  const t = useText();
  const options = [{ handle: null as string | null, name: t("collection.all_scents") }, ...scents];
  return (
    <nav
      aria-label={t("collection.scents_label")}
      className="scrollbar-none -mx-[var(--spacing-gutter)] flex max-w-[100vw] gap-x-7 overflow-x-auto px-[var(--spacing-gutter)] whitespace-nowrap md:mx-0 md:px-0"
    >
      {options.map((option) => {
        const params = new URLSearchParams();
        if (option.handle) params.set("scent", option.handle);
        if (sort !== "featured") params.set("sort", sort);
        const active = option.handle === scent;
        const search = params.toString();
        return (
          <Link
            key={option.handle ?? "all"}
            to={{ pathname, search: search ? `?${search}` : "" }}
            preventScrollReset
            replace
            aria-current={active ? "true" : undefined}
            className={`relative inline-flex h-11 shrink-0 items-center text-sm ${active ? "text-ink after:bg-ink after:absolute after:inset-x-0 after:bottom-2 after:h-px" : "text-muted hover:text-ink"}`}
          >
            {option.name}
          </Link>
        );
      })}
    </nav>
  );
}

function SortForm({ countLabel, scent, sort }: { countLabel: string; scent: string | null; sort: SortKey }) {
  const t = useText();
  const submit = useSubmit();
  const location = useLocation();
  return (
    <Form
      method="get"
      action={location.pathname}
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
        {t("collection.sort")}
      </label>
      <select id="pw-sort" name="sort" defaultValue={sort} key={sort} className="border-ink !w-auto border-0 border-b !bg-transparent !px-0 !py-1 text-[13px]">
        {SORTS.map((value) => (
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
  );
}

function BreadcrumbJsonLd({ title, path, origin }: { title: string; path: string; origin: string }) {
  const t = useText();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("breadcrumb.home"), item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: title, item: `${origin}${path}` },
    ],
  };
  return <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>;
}
