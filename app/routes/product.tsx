import {
  AnalyticsEvent,
  buildProductSelectionSearchParams,
  Cache,
  canAddToCart,
  getSelectedProductOptions,
  gql,
  type SelectedOption,
} from "@shopify/hydrogen";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { ProductGrid, sizeOf } from "~/components/ProductCard";
import { parseRich, RichText } from "~/components/RichText";
import { ShopifyImage } from "~/components/ShopifyImage";
import { openCartDrawer } from "~/lib/cart-drawer";
import { loadCollection, shopAllHandle } from "~/lib/collections";
import { Entry, type Image, type RichNode } from "~/lib/content";
import { envContext } from "~/lib/env";
import { shopifyImageUrl, shopifySrcSet } from "~/lib/images";
import { formatPrice, salePercent, wholePrice } from "~/lib/money";
import { ProductProvider, useProductForm } from "~/lib/product";
import { inventoryHint, loadProductInventory } from "~/lib/product-inventory";
import { seoMeta } from "~/lib/seo";
import { freeShippingMessage } from "~/lib/shipping";
import { storefrontClientContext } from "~/lib/storefront";
import { useSiteContent, useText } from "~/lib/text";

import type { Route } from "./+types/product";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/ErrorPage";

const PRODUCT_VARIANT_FRAGMENT = gql(`
  fragment ProductVariantFields on ProductVariant {
    id
    title
    availableForSale
    selectedOptions {
      name
      value
    }
    price {
      amount
      currencyCode
    }
    compareAtPrice {
      amount
      currencyCode
    }
    image {
      id
      url
      altText
      width
      height
    }
    product {
      title
      handle
    }
    sku
  }
`);


const PRODUCT_QUERY = gql(
  `
    query ProductPage($handle: String!, $selectedOptions: [SelectedOptionInput!]!) {
      product(handle: $handle) {
        id
        handle
        title
        vendor
        description
        productType
        tags
        requiresSellingPlan
        encodedVariantExistence
        encodedVariantAvailability
        featuredImage {
          id
          url
          altText
          width
          height
        }
        seo {
          title
          description
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        options {
          name
          optionValues {
            name
            firstSelectableVariant {
              ...ProductVariantFields
            }
            swatch {
              color
              image {
                previewImage {
                  url
                }
              }
            }
          }
        }
        selectedOrFirstAvailableVariant(
          selectedOptions: $selectedOptions
          ignoreUnknownOptions: true
          caseInsensitiveMatch: true
        ) {
          ...ProductVariantFields
        }
        adjacentVariants(
          selectedOptions: $selectedOptions
          ignoreUnknownOptions: true
          caseInsensitiveMatch: true
        ) {
          ...ProductVariantFields
        }
        collections(first: 20) {
          nodes {
            handle
            title
          }
        }
        scent: metafield(namespace: "plainwell", key: "scent") {
          reference {
            ... on Metaobject {
              handle
              name: field(key: "name") {
                value
              }
              note: field(key: "note") {
                value
              }
              ritual: field(key: "ritual_image") {
                reference {
                  ... on MediaImage {
                    image {
                      url
                      altText
                      width
                      height
                    }
                  }
                }
              }
            }
          }
        }
        family: metafield(namespace: "plainwell", key: "family") {
          value
        }
        comingSoon: metafield(namespace: "plainwell", key: "coming_soon") {
          value
        }
        details: metafield(namespace: "plainwell", key: "details") {
          value
        }
        ingredients: metafield(namespace: "plainwell", key: "ingredients") {
          value
        }
        ritualImage: metafield(namespace: "plainwell", key: "ritual_image") {
          reference {
            ... on MediaImage {
              image {
                url
                altText
                width
                height
              }
            }
          }
        }
        rating: metafield(namespace: "reviews", key: "rating") {
          value
        }
        ratingCount: metafield(namespace: "reviews", key: "rating_count") {
          value
        }
      }
    }
  `,
  [PRODUCT_VARIANT_FRAGMENT],
);

const GALLERY_SIZES = "(min-width: 48rem) 50vw, 100vw";
const GALLERY_WIDTHS = [480, 720, 960, 1200, 1600];

export function meta({ matches, data }: Route.MetaArgs) {
  if (!data) return seoMeta(matches[0], { title: "", path: "/collections/all", noindex: true });
  const { product } = data;
  const image = product.featuredImage;
  return [
    ...seoMeta(matches[0], {
      title: product.seo.title || product.title,
      description: product.seo.description || product.description,
      path: `/products/${product.handle}`,
      type: "product",
      image: image ? { url: shopifyImageUrl(image.url, 1200), width: 1200, height: 1200, alt: image.altText || product.title } : null,
    }),
    ...(image
      ? [
          // The packshot is the LCP image: start it with the document.
          {
            tagName: "link",
            rel: "preload",
            as: "image",
            href: shopifyImageUrl(image.url, 900),
            imageSrcSet: shopifySrcSet(image.url, GALLERY_WIDTHS),
            imageSizes: GALLERY_SIZES,
            fetchPriority: "high",
          },
        ]
      : []),
  ];
}

type ScentRef = {
  handle?: string;
  name?: { value?: string | null } | null;
  note?: { value?: string | null } | null;
  ritual?: { reference?: { image?: Image } | null } | null;
};

/** Shopify's standard reviews.rating value: {"value": "4.7", "scale_max": "5", ...}. */
function parseRating(value: string | null | undefined) {
  if (!value) return null;
  try {
    const r = JSON.parse(value) as { value?: string; scale_max?: string };
    const rating = Number(r.value);
    return Number.isFinite(rating) ? { value: rating, max: Number(r.scale_max ?? 5) } : null;
  } catch {
    return null;
  }
}

function parseRichValue(value: string | null | undefined): RichNode | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as RichNode;
  } catch {
    return null;
  }
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const handle = params.handle;
  if (!handle) throw new Response("Not Found", { status: 404 });

  const env = context.get(envContext);
  const client = context.get(storefrontClientContext);
  const url = new URL(request.url);
  const selectedOptions = getSelectedProductOptions({ searchParams: url.searchParams });
  const [productResult, inventory, shopAll] = await Promise.all([
    client.graphql(PRODUCT_QUERY, { variables: { handle, selectedOptions }, cache: Cache.short() }),
    loadProductInventory(client, handle, selectedOptions),
    shopAllHandle(client),
  ]);
  if (productResult.errors?.length) {
    console.error(`Product query failed for ${handle}: ${productResult.errors.map((e) => e.message).join("; ")}`);
    throw new Response("Product query failed", { status: 500 });
  }
  const product = productResult.data?.product;
  if (!product) throw new Response("Not Found", { status: 404 });

  // The range, for the scent switch (same product family) and Pairs well with (same scent).
  const range = shopAll ? ((await loadCollection(client, shopAll, "featured", [env.PUBLIC_STORE_DOMAIN, url.hostname]))?.items ?? []) : [];
  const scent = product.scent?.reference as ScentRef | null | undefined;
  const family = product.family?.value ?? "";
  const siblings = family
    ? range
        .filter((item) => item.family === family)
        .sort((a, b) => (a.scent?.sort ?? 999) - (b.scent?.sort ?? 999))
        .map((item) => ({ handle: item.handle, name: item.scent?.name ?? item.title, comingSoon: item.comingSoon }))
    : [];
  let pairs = range.filter((item) => item.scent?.handle === scent?.handle && item.family !== family && item.handle !== product.handle);
  pairs = pairs.slice(0, 4);
  if (pairs.length < 4) pairs = pairs.concat(range.filter((item) => !item.comingSoon && item.family !== family && !pairs.includes(item)).slice(0, 4 - pairs.length));

  return {
    product,
    inventory,
    scent: scent?.handle ? { handle: scent.handle, name: scent.name?.value ?? "", note: scent.note?.value ?? "" } : null,
    ritual: (product.ritualImage?.reference as { image?: Image } | null | undefined)?.image ?? scent?.ritual?.reference?.image ?? null,
    comingSoon: product.comingSoon?.value === "true",
    details: parseRichValue(product.details?.value),
    ingredients: parseRichValue(product.ingredients?.value),
    rating: parseRating(product.rating?.value),
    ratingCount: product.ratingCount?.value ? Number(product.ratingCount.value) : 0,
    siblings,
    pairs,
    origin: url.origin,
  };
}

type PageData = Route.ComponentProps["loaderData"];
/** Loader data plus the breadcrumb category, resolved from the shop-categories menu. */
type View = PageData & { category: { title: string; url: string } | null };
type ProductData = PageData["product"];
type ProductVariant = NonNullable<ProductData["selectedOrFirstAvailableVariant"]>;

type SwatchValue = {
  color?: string | null;
  imageUrl?: string | null;
};

function toRouterLocation(url: string) {
  return url;
}

function variantUrl(
  product: { handle: string; options: Array<{ name: string }> },
  selectedOptions: SelectedOption[],
  handle = product.handle,
  base: URLSearchParams = new URLSearchParams(),
) {
  const params = buildProductSelectionSearchParams({
    selectedOptions,
    optionNames: product.options.map((option) => option.name),
    base,
  });
  const query = params.toString();
  return `/products/${handle}${query ? `?${query}` : ""}`;
}

function buildSwatchLookup(product: ProductData) {
  const lookup = new Map<string, SwatchValue>();
  for (const option of product.options) {
    for (const value of option.optionValues) {
      const swatch = value.swatch;
      lookup.set(`${option.name}:${value.name}`, {
        color: swatch?.color ?? null,
        imageUrl: swatch?.image?.previewImage?.url ?? null,
      });
    }
  }
  return lookup;
}

function hasSwatchData(product: ProductData, optionName: string) {
  const option = product.options.find((candidate) => candidate.name === optionName);
  return Boolean(
    option?.optionValues.some(
      (value) => value.swatch?.color || value.swatch?.image?.previewImage?.url,
    ),
  );
}


function ProductViewedTracker({ product }: { product: ProductData }) {
  useEffect(() => {
    const selectedVariant = product.selectedOrFirstAvailableVariant;
    window.Shopify?.analytics?.publish(AnalyticsEvent.PRODUCT_VIEWED, {
      products: [
        {
          id: product.id,
          title: product.title,
          price: selectedVariant?.price ?? product.priceRange.minVariantPrice,
          vendor: product.vendor ?? "",
          variantId: selectedVariant?.id ?? product.id,
          variantTitle: selectedVariant?.title ?? product.title,
          quantity: 1,
          sku: selectedVariant?.sku,
        },
      ],
    });
  }, [product]);

  return null;
}



function ScentSwitch({ data }: { data: View }) {
  const t = useText();
  if (data.siblings.length < 2) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted text-[13px]">{t("product.scent")}</span>
      <nav aria-label={t("product.scent")} className="border-line flex flex-wrap gap-x-6 border-b">
        {data.siblings.map((sibling) => {
          const active = sibling.handle === data.product.handle;
          return (
            <Link
              key={sibling.handle}
              to={`/products/${sibling.handle}`}
              prefetch="intent"
              preventScrollReset
              aria-current={active ? "page" : undefined}
              className={`relative inline-flex h-11 items-center text-sm ${active ? "text-ink after:bg-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px" : "text-muted hover:text-ink"}`}
            >
              {sibling.comingSoon ? t("product.scent_soon", { scent: sibling.name }) : sibling.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function PriceBlock({ product, selectedVariant }: { product: ProductData; selectedVariant: ProductVariant | null }) {
  const t = useText();
  const price = selectedVariant?.price ?? product.priceRange.minVariantPrice;
  const compareAt = selectedVariant?.compareAtPrice;
  const percent = salePercent(price, compareAt);

  return (
    <div className="border-line border-t pt-4 text-[22px] tracking-[-0.01em]" data-product-price>
      {compareAt && percent ? (
        <span className="inline-flex flex-wrap items-baseline gap-3">
          <span>
            <span className="sr-only">{t("product.sale_price_sr")}</span>
            {wholePrice(price)}
          </span>
          <s className="text-muted text-base">
            <span className="sr-only">{t("product.regular_price_sr")}</span>
            {formatPrice(compareAt)}
          </s>
        </span>
      ) : (
        <span>
          <span className="sr-only">{t("product.price_sr")}</span>
          {wholePrice(price)}
        </span>
      )}
    </div>
  );
}

function InventoryHint({ selectedVariant, inventory }: { selectedVariant: ProductVariant | null; inventory: Record<string, number> }) {
  const t = useText();
  const hint = inventoryHint(selectedVariant, inventory);
  if (!hint) return null;
  return (
    <p className="text-sm" data-product-inventory aria-live="polite">
      {hint.kind === "sold_out" ? t("product.out_of_stock") : t("product.low_stock", { count: hint.quantity })}
    </p>
  );
}

function isPlainActivation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    (!event.currentTarget.target || event.currentTarget.target === "_self")
  );
}


function VariantOptions({ product }: { product: ProductData }) {
  const t = useText();
  const { options, register } = useProductForm();
  const swatches = useMemo(() => buildSwatchLookup(product), [product]);
  const location = useLocation();
  const baseParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  return (
    <div className="swatch-buttons space-y-4">
      {options.map((option) => {
        const selectedValue = option.values.find((value) => value.selected)?.name;
        const renderSwatches = hasSwatchData(product, option.name);
        const isColorOption = option.name.toLowerCase().includes("color");

        return (
          <fieldset key={option.name} className="space-y-2">
            <legend className="text-muted mb-2.5 text-[13px]">
              {option.name}
              {selectedValue ? t("product.option_selected", { value: selectedValue }) : ""}
            </legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label={option.name}>
              {option.values.map((variantOption) => {
                const valueName = variantOption.name;
                const registered = register("optionValue", {
                  optionName: option.name,
                  value: valueName,
                });
                const isCrossProduct = variantOption.handle !== product.handle;
                const linkTarget = variantUrl(
                  product,
                  variantOption.selectedOptions,
                  variantOption.handle,
                  baseParams,
                );
                const soldOut = !variantOption.available;
                const testId = isColorOption ? "color-swatch" : undefined;
                const swatch = renderSwatches ? swatches.get(`${option.name}:${valueName}`) : null;
                const swatchStyle = swatch?.imageUrl
                  ? { backgroundImage: `url("${swatch.imageUrl}")` }
                  : { backgroundColor: swatch?.color ?? undefined };

                const className = renderSwatches
                  ? `min-h-touch-target min-w-touch-target relative inline-flex cursor-pointer items-center justify-center motion-safe:transition-transform motion-safe:active:scale-[0.93] ${soldOut ? "opacity-50" : ""}`
                  : `option-pill focus-visible:outline-accent motion-safe:transition-[color,background-color,border-color,transform] motion-safe:active:scale-[0.97] ${variantOption.selected ? "is-selected" : ""} ${soldOut ? "opacity-50" : ""}`;
                const content = renderSwatches ? (
                  <>
                    <span
                      className={`swatch-md border-border relative inline-flex items-center justify-center overflow-hidden rounded-full border-2 ring-offset-2 ${variantOption.selected ? "border-interactive" : ""}`}
                      style={swatchStyle}
                    >
                      {variantOption.selected ? (
                        <span className="swatch-scrim absolute inset-0" />
                      ) : null}
                      {soldOut ? (
                        <svg
                          className="absolute inset-0 h-full w-full"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          aria-hidden="true"
                        >
                          <line x1="4" y1="4" x2="20" y2="20" />
                        </svg>
                      ) : null}
                    </span>
                    <span className="sr-only">
                      {valueName}
                      {soldOut ? t("product.option_sold_out") : ""}
                    </span>
                  </>
                ) : (
                  `${valueName}${soldOut ? t("product.option_sold_out") : ""}`
                );

                if (!isCrossProduct && !variantOption.exists) {
                  return (
                    <button
                      key={valueName}
                      type="button"
                      disabled
                      className={className}
                      aria-label={renderSwatches ? valueName : undefined}
                      aria-pressed={variantOption.selected}
                      data-testid={testId}
                    >
                      {content}
                    </button>
                  );
                }

                // Every selectable value is an <a> whichever product it belongs to. The
                // activated value flips from cross-product to same-product after the
                // navigation, and a change of element type there would remount the
                // focused control and drop focus to <body>.
                return (
                  <Link
                    key={valueName}
                    to={toRouterLocation(linkTarget)}
                    replace={!isCrossProduct}
                    preventScrollReset
                    className={className}
                    aria-label={renderSwatches ? valueName : undefined}
                    aria-current={variantOption.selected ? "true" : undefined}
                    data-testid={testId}
                    onClick={
                      isCrossProduct
                        ? undefined
                        : (event) => {
                            if (!isPlainActivation(event)) return;
                            registered.onClick();
                            // onSelect has already navigated with the provider's replace
                            // and revalidation settings. Letting Link navigate too would
                            // refetch the loader that a resolved selection just skipped.
                            event.preventDefault();
                          }
                    }
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}


function QuantitySelector({ quantity, setQuantity }: { quantity: number; setQuantity: (quantity: number) => void }) {
  const t = useText();
  const { register } = useProductForm();
  const clamp = (value: number) => Math.min(99, Math.max(1, value));

  return (
    <div className="border-line inline-flex h-12 shrink-0 items-center border" data-testid="quantity-stepper">
      <button
        type="button"
        className="inline-flex h-full w-11 items-center justify-center text-base disabled:opacity-30"
        aria-label={t("product.quantity_decrease")}
        onClick={() => setQuantity(clamp(quantity - 1))}
        disabled={quantity <= 1}
      >
        −
      </button>
      <input
        type="number"
        id="quantity"
        {...register("quantity", { value: quantity })}
        min={1}
        max={99}
        step={1}
        className="number-reset !h-full !w-10 !border-0 !bg-transparent !p-0 text-center !text-sm"
        aria-label={t("product.quantity")}
        onChange={(event) => setQuantity(clamp(Number.parseInt(event.currentTarget.value, 10) || 1))}
      />
      <button
        type="button"
        className="inline-flex h-full w-11 items-center justify-center text-base disabled:opacity-30"
        aria-label={t("product.quantity_increase")}
        onClick={() => setQuantity(clamp(quantity + 1))}
        disabled={quantity >= 99}
      >
        +
      </button>
    </div>
  );
}

function AddToCart({ product, selectedVariant }: { product: ProductData; selectedVariant: ProductVariant | null }) {
  const t = useText();
  const content = useSiteContent();
  const { options, register, formProps, errors, pending } = useProductForm();
  const [quantity, setQuantity] = useState(1);
  const addable = canAddToCart(product, options);
  const buttonText = addable ? t("product.add_to_bag") : selectedVariant ? t("product.sold_out") : t("product.select_options");
  const shipping = content ? freeShippingMessage(t, content.settings, selectedVariant?.price.currencyCode) : "";

  return (
    <>
      <form {...formProps({ afterSubmit: openCartDrawer })} className="flex flex-wrap gap-3">
        <QuantitySelector quantity={quantity} setQuantity={setQuantity} />
        <input type="hidden" {...register("merchandiseId", {})} />
        <button {...register("addToCart", {})} className="pw-btn pw-btn--primary min-w-[200px] flex-1" disabled={!addable || pending} data-testid="add-to-cart">
          {buttonText}
        </button>
      </form>
      {shipping ? <span className="text-muted text-[13px]">{shipping}</span> : null}
      {[...errors.userErrors, ...errors.warnings, ...errors.networkErrors].length ? (
        <div className="grid gap-1 text-sm" role="alert">
          {[...errors.userErrors, ...errors.warnings, ...errors.networkErrors].map((error) => (
            <p key={error.message}>{error.message}</p>
          ))}
        </div>
      ) : null}
    </>
  );
}

function Details({ data }: { data: View }) {
  const t = useText();
  const content = useSiteContent();
  const settings = content?.settings;
  const money = (n: number) => wholePrice({ amount: n.toFixed(2), currencyCode: data.product.priceRange.minVariantPrice.currencyCode });
  const shipping =
    settings?.freeShippingThreshold != null && settings.standardShippingRate != null
      ? parseRich(t("product.shipping_returns_body", { free: money(settings.freeShippingThreshold), rate: money(settings.standardShippingRate) }))
      : null;
  const items = [
    { title: t("product.details"), body: data.details },
    { title: t("product.ingredients"), body: data.ingredients },
    { title: t("product.shipping_returns"), body: shipping },
  ].filter((item): item is { title: string; body: RichNode } => Boolean(item.body));
  if (!items.length) return null;
  return (
    <div className="border-line border-b">
      {items.map((item, index) => (
        <details key={item.title} name="product-details" open={index === 0} className="group border-line border-t">
          <summary className="marker-hidden flex min-h-14 cursor-pointer items-center justify-between gap-4 text-sm">
            {item.title}
            <span aria-hidden="true" className="w-[18px] text-center text-lg group-open:hidden">
              +
            </span>
            <span aria-hidden="true" className="hidden w-[18px] text-center text-lg group-open:inline">
              −
            </span>
          </summary>
          <RichText node={item.body} className="text-muted flex max-w-[620px] flex-col gap-3 pb-[22px] text-sm leading-[1.65]" />
        </details>
      ))}
    </div>
  );
}

function Stars({ value, max, className }: { value: number; max: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span aria-hidden="true" className={`tracking-[2px] ${className ?? ""}`}>
      {"★".repeat(full)}
      <span className="text-line">{"★".repeat(Math.max(0, max - full))}</span>
    </span>
  );
}

function Info({ data }: { data: View }) {
  const t = useText();
  const { product } = data;
  const { selectedVariant } = useProductForm();
  const size = sizeOf(selectedVariant?.selectedOptions);
  const hasChoices = product.options.some((option) => option.optionValues.length > 1);
  const eyebrow = [data.category?.title, data.scent?.name].filter(Boolean).join(" · ");

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {eyebrow ? <span className="pw-eyebrow">{eyebrow}</span> : null}
        <h1 className="text-[clamp(34px,3.4vw,44px)] leading-[1.06] tracking-[-0.02em]">{product.title}</h1>
        {data.scent?.note ? (
          <span className="text-muted text-[15px]">{data.comingSoon ? t("card.coming_soon_note", { note: data.scent.note }) : data.scent.note}</span>
        ) : null}
        {data.rating && data.ratingCount > 0 ? (
          <a href="#reviews" className="inline-flex items-center gap-2.5 pt-1 text-[13px]">
            <Stars value={data.rating.value} max={data.rating.max} />
            <span className="pw-link">{t("product.reviews_link", { rating: data.rating.value.toFixed(1), count: data.ratingCount })}</span>
          </a>
        ) : null}
      </div>
      {product.description ? <p className="text-base leading-[1.65]">{product.description}</p> : null}
      <ScentSwitch data={data} />
      {hasChoices ? (
        <VariantOptions product={product} />
      ) : size ? (
        <div className="flex flex-col gap-2.5">
          <span className="text-muted text-[13px]">{product.options[0]?.name}</span>
          <span className="border-ink inline-flex h-10 items-center self-start border px-4 text-[13px]">{size}</span>
        </div>
      ) : null}
      {data.comingSoon ? (
        <>
          <div className="border-line border-t pt-4 text-[22px] tracking-[-0.01em]">{t("card.price_to_come")}</div>
          <div className="flex flex-col gap-3">
            <button type="button" disabled className="pw-btn pw-btn--secondary w-full">
              {t("card.coming_soon")}
            </button>
            <span className="text-muted text-[13px]">{t("product.coming_soon_note")}</span>
          </div>
        </>
      ) : (
        <>
          <PriceBlock product={product} selectedVariant={selectedVariant} />
          <InventoryHint selectedVariant={selectedVariant} inventory={data.inventory} />
          <div data-product-form className="flex flex-col gap-3">
            <span className="sr-only" aria-live="polite" data-add-to-cart-status />
            <AddToCart product={product} selectedVariant={selectedVariant} />
          </div>
        </>
      )}
      <Details data={data} />
    </>
  );
}

// Real ratings only: Shopify's standard reviews.rating and reviews.rating_count metafields,
// filled by a reviews app. Nothing renders until a product has reviews.
function Reviews({ data }: { data: View }) {
  const t = useText();
  if (!data.rating || data.ratingCount <= 0) return null;
  return (
    <section id="reviews" className="pw-gutter flex scroll-mt-24 flex-col gap-6 pt-28" aria-labelledby="reviews-heading">
      <div className="border-ink border-b pb-[22px]">
        <h2 id="reviews-heading" className="pw-h2">
          {t("product.reviews_heading")}
        </h2>
      </div>
      <div className="flex items-baseline gap-3.5">
        <span className="text-[64px] leading-none tracking-[-0.03em]">{data.rating.value.toFixed(1)}</span>
        <span className="text-muted text-[13px]">{t("product.rating_out_of", { max: data.rating.max })}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Stars value={data.rating.value} max={data.rating.max} className="text-lg" />
        <span className="text-muted text-[13px]">{t(data.ratingCount === 1 ? "product.rating_count_one" : "product.rating_count_other", { count: data.ratingCount })}</span>
      </div>
    </section>
  );
}

function ProductJsonLd({ data }: { data: View }) {
  const t = useText();
  const { product } = data;
  const variant = product.selectedOrFirstAvailableVariant;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.featuredImage?.url,
    sku: variant?.sku || undefined,
    brand: { "@type": "Brand", name: product.vendor },
    offers:
      variant && !data.comingSoon
        ? {
            "@type": "Offer",
            url: `${data.origin}/products/${product.handle}`,
            price: variant.price.amount,
            priceCurrency: variant.price.currencyCode,
            availability: variant.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          }
        : undefined,
    aggregateRating:
      data.rating && data.ratingCount > 0
        ? { "@type": "AggregateRating", ratingValue: data.rating.value, bestRating: data.rating.max, reviewCount: data.ratingCount }
        : undefined,
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("product.breadcrumb_all"), item: `${data.origin}/collections/all` },
      ...(data.category ? [{ "@type": "ListItem", position: 2, name: data.category.title, item: `${data.origin}${data.category.url}` }] : []),
      { "@type": "ListItem", position: data.category ? 3 : 2, name: product.title },
    ],
  };
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(crumbs)}</script>
    </>
  );
}

function ProductPage({ data }: { data: View }) {
  const t = useText();
  const { product } = data;
  const image = product.featuredImage;

  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <nav aria-label={t("product.breadcrumb_label")} className="pw-gutter text-muted flex flex-wrap gap-2 py-5 text-[13px]">
        <Link to="/collections/all" className="pw-hover">
          {t("product.breadcrumb_all")}
        </Link>
        {data.category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link to={data.category.url} className="pw-hover">
              {data.category.title}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="text-ink" aria-current="page">
          {product.title}
        </span>
      </nav>
      <section className="border-line pw-contain grid items-start border-t md:grid-cols-2">
        <div className="bg-shelf border-line aspect-[4/5] md:col-start-1 md:row-start-1 md:border-r">
          {image ? (
            <img
              src={shopifyImageUrl(image.url, 900)}
              srcSet={shopifySrcSet(image.url, GALLERY_WIDTHS)}
              sizes={GALLERY_SIZES}
              alt={image.altText || product.title}
              width={1000}
              height={1250}
              fetchPriority="high"
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="flex max-w-[620px] flex-col gap-7 px-5 pt-10 pb-14 md:sticky md:top-[var(--spacing-header)] md:col-start-2 md:row-span-2 md:row-start-1 md:px-[clamp(24px,5vw,88px)] md:pt-14 md:pb-[72px]">
          <Info data={data} />
        </div>
        {data.ritual ? (
          <div className="bg-olive border-line aspect-[4/5] border-t md:col-start-1 md:row-start-2 md:border-r">
            <ShopifyImage image={data.ritual} sizes={GALLERY_SIZES} className="h-full w-full object-cover" />
          </div>
        ) : null}
      </section>
      <Reviews data={data} />
      {data.pairs.length ? (
        <section className="pt-28 pb-28" aria-labelledby="pairs-heading">
          <div className="pw-gutter flex items-baseline justify-between gap-4 pb-[22px]">
            <h2 id="pairs-heading" className="pw-section-label">
              {t("product.pairs_heading")}
            </h2>
            <Link to="/collections/all" className="pw-link">
              {t("product.pairs_link")}
            </Link>
          </div>
          <ProductGrid items={data.pairs} />
        </section>
      ) : (
        <div className="h-28" />
      )}
    </main>
  );
}

export default function ProductRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const content = useSiteContent();
  const { product } = loaderData;
  // The breadcrumb category: the first of the product's collections in the shop-categories menu.
  const categories = content?.menus.categories ?? [];
  const category =
    product.collections.nodes
      .map((c) => ({ title: c.title, url: `/collections/${c.handle}` }))
      .find((c) => categories.some((m) => m.url.split("?")[0] === c.url)) ?? null;
  const data: View = {
    ...loaderData,
    category: category ? { ...category, title: categories.find((m) => m.url.split("?")[0] === category.url)?.title ?? category.title } : null,
  };

  return (
    <ProductProvider
      product={product}
      onSelect={(result) => {
        const url = toRouterLocation(variantUrl(product, result.selectedOptions, result.selectedVariant?.product?.handle, new URLSearchParams(location.search)));
        void navigate(url, {
          replace: true,
          preventScrollReset: true,
          ...(result.status === "resolved" ? { defaultShouldRevalidate: false } : {}),
        });
      }}
    >
      <ProductViewedTracker product={product} />
      <ProductJsonLd data={data} />
      <ProductPage data={data} />
    </ProductProvider>
  );
}
