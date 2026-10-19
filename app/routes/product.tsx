import {
  AnalyticsEvent,
  buildProductSelectionSearchParams,
  Cache,
  canAddToCart,
  getSelectedProductOptions,
  gql,
  type SelectedOption,
} from "@shopify/hydrogen";
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { Media, mediaPreload } from "~/components/Media";
import { ProductGrid, type CardItem } from "~/components/ProductCard";
import { openCartDrawer } from "~/lib/cart-drawer";
import { shopifyImageUrl, shopifySrcSet } from "~/lib/images";
import { formatPrice, salePercent, wholePrice } from "~/lib/money";
import {
  CATEGORY_LABEL,
  categoryOf,
  familyOf,
  findConcept,
  FREE_SHIPPING_THRESHOLD,
  ritualFor,
  SCENT_LABEL,
  SCENT_NOTE,
  SCENT_ORDER,
  scentOf,
  type ConceptProduct,
  type Scent,
} from "~/lib/plainwell";
import { loadCatalog } from "~/lib/plainwell-catalog";
import { ProductProvider, useProductForm } from "~/lib/product";
import { inventoryHintText, loadProductInventory } from "~/lib/product-inventory";
import { storefrontClientContext } from "~/lib/storefront";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/product";

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
      }
    }
  `,
  [PRODUCT_VARIANT_FRAGMENT],
);

export function meta({ matches, data }: Route.MetaArgs) {
  const shopName = getShopNameFromRootMatch(matches[0]);
  if (!data) return [{ title: formatPageTitle("Product", shopName) }];
  const { title, description, image } =
    data.kind === "live"
      ? {
          title: data.product.seo.title || data.product.title,
          description: data.product.seo.description || data.product.description,
          image: data.product.featuredImage?.url,
        }
      : { title: data.concept.title, description: `${data.concept.title} is coming soon to Plainwell.`, image: undefined };
  return [
    { title: formatPageTitle(title, shopName) },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: `${data.origin}/products/${data.handle}` },
    { property: "og:type", content: "product" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...(image
      ? [
          { property: "og:image", content: shopifyImageUrl(image, 1200) },
          // The packshot is the LCP image: start it with the document.
          {
            tagName: "link",
            rel: "preload",
            as: "image",
            href: shopifyImageUrl(image, 900),
            imageSrcSet: shopifySrcSet(image, GALLERY_WIDTHS),
            imageSizes: GALLERY_SIZES,
            fetchPriority: "high",
          },
        ]
      : [{ tagName: "link", ...mediaPreload(`pack-${data.handle}`, GALLERY_SIZES) }]),
  ];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const handle = params.handle;
  if (!handle) throw new Response("Not Found", { status: 404 });

  const storefrontClient = context.get(storefrontClientContext);
  const url = new URL(request.url);
  const selectedOptions = getSelectedProductOptions({ searchParams: url.searchParams });
  const [productResult, catalog, inventory] = await Promise.all([
    storefrontClient.graphql(PRODUCT_QUERY, {
      variables: { handle, selectedOptions },
      cache: Cache.short(),
    }),
    loadCatalog(storefrontClient),
    loadProductInventory(storefrontClient, handle, selectedOptions),
  ]);

  if (productResult.errors?.length) {
    console.error(`Product query failed for ${handle}: ${productResult.errors.map((e) => e.message).join("; ")}`);
    throw new Response("Product query failed", { status: 500 });
  }

  const product = productResult.data?.product;
  const concept = product ? null : findConcept(handle);
  if (!product && !concept) throw new Response("Not Found", { status: 404 });

  const scent = product ? scentOf(product.tags) : concept!.scent;
  const family = product ? familyOf(product.handle) : concept!.family;
  const all = [...catalog.live, ...catalog.concepts];

  // The scent switch: every product in the family, live or coming soon.
  const siblings = all
    .filter((item) => item.family === family)
    .sort((a, b) => SCENT_ORDER.indexOf(a.scent ?? "botanical") - SCENT_ORDER.indexOf(b.scent ?? "botanical"))
    .map((item) => ({ handle: item.handle, scent: item.scent, comingSoon: !item.live }));

  // Pairs well with: the same scent in other formats, live first, topped up from the range.
  let pairs = all.filter((item) => item.scent === scent && item.family !== family);
  pairs.sort((a, b) => Number(!a.live) - Number(!b.live));
  pairs = pairs.slice(0, 4);
  if (pairs.length < 4) {
    pairs = pairs.concat(
      catalog.live.filter((item) => item.family !== family && !pairs.includes(item)).slice(0, 4 - pairs.length),
    );
  }

  const common = { handle, scent, family, siblings, pairs, origin: url.origin };
  if (product) {
    return { kind: "live" as const, product, inventory, category: categoryOf(product.tags, product.productType), ...common };
  }
  return { kind: "concept" as const, concept: concept!, category: concept!.category, ...common };
}

const GALLERY_SIZES = "(min-width: 48rem) 50vw, 100vw";
const GALLERY_WIDTHS = [480, 720, 960, 1200, 1600];

type LiveData = Extract<Route.ComponentProps["loaderData"], { kind: "live" }>;
type PageData = Route.ComponentProps["loaderData"];
type ProductData = LiveData["product"];
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



function ProductImage({ data }: { data: PageData }) {
  if (data.kind === "concept") {
    return (
      <Media
        name={`pack-${data.handle}`}
        alt={data.concept.title}
        sizes={GALLERY_SIZES}
        width={1000}
        height={1250}
        priority
        className="h-full w-full object-cover"
      />
    );
  }
  const image = data.product.featuredImage;
  if (!image) return null;
  return (
    <img
      src={shopifyImageUrl(image.url, 900)}
      srcSet={shopifySrcSet(image.url, GALLERY_WIDTHS)}
      sizes={GALLERY_SIZES}
      alt={image.altText || data.product.title}
      width={1000}
      height={1250}
      fetchPriority="high"
      className="h-full w-full object-cover"
    />
  );
}

function ScentSwitch({ data }: { data: PageData }) {
  if (data.siblings.length < 2) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted text-[13px]">Scent</span>
      <nav aria-label="Scent" className="border-line flex flex-wrap gap-x-6 border-b">
        {data.siblings.map((sibling) => {
          const active = sibling.handle === data.handle;
          const label = SCENT_LABEL[sibling.scent ?? "botanical"] + (sibling.comingSoon ? " · soon" : "");
          return (
            <Link
              key={sibling.handle}
              to={`/products/${sibling.handle}`}
              prefetch="intent"
              preventScrollReset
              aria-current={active ? "page" : undefined}
              className={`relative inline-flex h-11 items-center text-sm ${active ? "text-ink after:bg-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px" : "text-muted hover:text-ink"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function PriceBlock({ product, selectedVariant }: { product: ProductData; selectedVariant: ProductVariant | null }) {
  const price = selectedVariant?.price ?? product.priceRange.minVariantPrice;
  const compareAt = selectedVariant?.compareAtPrice;
  const percent = salePercent(price, compareAt);

  return (
    <div className="border-line border-t pt-4 text-[22px] tracking-[-0.01em]" data-product-price>
      {compareAt && percent ? (
        <span className="inline-flex flex-wrap items-baseline gap-3">
          <span>
            <span className="sr-only">Sale price: </span>
            {wholePrice(price)}
          </span>
          <s className="text-muted text-base">
            <span className="sr-only">Regular price: </span>
            {formatPrice(compareAt)}
          </s>
        </span>
      ) : (
        <span>
          <span className="sr-only">Price: </span>
          {wholePrice(price)}
        </span>
      )}
    </div>
  );
}

function InventoryHint({
  selectedVariant,
  inventory,
}: {
  selectedVariant: ProductVariant | null;
  inventory: Record<string, number>;
}) {
  const text = inventoryHintText(selectedVariant, inventory);
  if (!text) return null;
  return (
    <p className="text-sm" data-product-inventory aria-live="polite">
      {text}
    </p>
  );
}

// Mirrors React Router's own Link guard: a modified or non-primary click belongs to
// the browser (new tab, new window), so the href must stay in charge of it.
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
              {selectedValue ? `: ${selectedValue}` : ""}
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
                      {soldOut ? " (Sold out)" : ""}
                    </span>
                  </>
                ) : (
                  `${valueName}${soldOut ? " (Sold out)" : ""}`
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
  const { register } = useProductForm();
  const clamp = (value: number) => Math.min(99, Math.max(1, value));

  return (
    <div className="border-line inline-flex h-12 shrink-0 items-center border" data-testid="quantity-stepper">
      <button
        type="button"
        className="inline-flex h-full w-11 items-center justify-center text-base disabled:opacity-30"
        aria-label="Decrease quantity"
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
        aria-label="Quantity"
        onChange={(event) => setQuantity(clamp(Number.parseInt(event.currentTarget.value, 10) || 1))}
      />
      <button
        type="button"
        className="inline-flex h-full w-11 items-center justify-center text-base disabled:opacity-30"
        aria-label="Increase quantity"
        onClick={() => setQuantity(clamp(quantity + 1))}
        disabled={quantity >= 99}
      >
        +
      </button>
    </div>
  );
}

function AddToCart({ product, selectedVariant }: { product: ProductData; selectedVariant: ProductVariant | null }) {
  const { options, register, formProps, errors, pending } = useProductForm();
  const [quantity, setQuantity] = useState(1);
  const addable = canAddToCart(product, options);
  const buttonText = addable ? "Add to bag" : selectedVariant ? "Sold out" : "Select options";

  return (
    <>
      <form {...formProps({ afterSubmit: openCartDrawer })} className="flex flex-wrap gap-3">
        <QuantitySelector quantity={quantity} setQuantity={setQuantity} />
        <input type="hidden" {...register("merchandiseId", {})} />
        <button
          {...register("addToCart", {})}
          className="pw-btn pw-btn--primary min-w-[200px] flex-1"
          disabled={!addable || pending}
          data-testid="add-to-cart"
        >
          {buttonText}
        </button>
      </form>
      <span className="text-muted text-[13px]">
        Complimentary US shipping on orders over ${FREE_SHIPPING_THRESHOLD}.
      </span>
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

function Details({ title, size, extra }: { title: string; size: string; extra?: string }) {
  const items = [
    {
      title: "Details",
      body: `${title} · ${size}. Plant-based personal care, as printed on the label.${extra ? ` ${extra}` : ""}`,
    },
    { title: "Ingredients", body: "[Ingredient list to confirm]" },
    {
      title: "Shipping & returns",
      body: `Complimentary US standard shipping on orders of $${FREE_SHIPPING_THRESHOLD} and above; $8 below. Other options and international rates are calculated at checkout. [Returns policy to confirm]`,
    },
  ];
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
          <p className="text-muted max-w-[620px] pb-[22px] text-sm leading-[1.65]">{item.body}</p>
        </details>
      ))}
    </div>
  );
}

// Shopify descriptions open with "Title · size." which the page already shows.
function introFor(product: ProductData) {
  const text = product.description.replace(/^[^.]*·[^.]*\.\s*/, "").trim();
  return text || "A Plainwell everyday essential for your body, your bathroom, and the people you share it with.";
}

function eyebrowFor(data: PageData) {
  const category = data.category ? CATEGORY_LABEL[data.category].label : "Plainwell";
  return [category, data.scent ? SCENT_LABEL[data.scent] : null].filter(Boolean).join(" · ");
}

function LiveInfo({ data }: { data: LiveData }) {
  const { product } = data;
  const { selectedVariant } = useProductForm();
  const size = selectedVariant?.selectedOptions.find((o) => o.name === "Size")?.value ?? "";
  const hasChoices = product.options.some((option) => option.optionValues.length > 1);

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <span className="pw-eyebrow">{eyebrowFor(data)}</span>
        <h1 className="text-[clamp(34px,3.4vw,44px)] leading-[1.06] tracking-[-0.02em]">{product.title}</h1>
        {data.scent ? <span className="text-muted text-[15px]">{SCENT_NOTE[data.scent]}</span> : null}
        <a href="#reviews" className="inline-flex items-center gap-2.5 pt-1 text-[13px]">
          <span aria-hidden="true" className="tracking-[2px]">
            ★★★★★
          </span>
          <span className="pw-link">Sample reviews</span>
        </a>
      </div>
      <p className="text-base leading-[1.65]">{introFor(product)}</p>
      <ScentSwitch data={data} />
      {hasChoices ? (
        <VariantOptions product={product} />
      ) : (
        <div className="flex flex-col gap-2.5">
          <span className="text-muted text-[13px]">Size</span>
          <span className="border-ink inline-flex h-10 items-center self-start border px-4 text-[13px]">{size}</span>
        </div>
      )}
      <PriceBlock product={product} selectedVariant={selectedVariant} />
      <InventoryHint selectedVariant={selectedVariant} inventory={data.inventory} />
      <div data-product-form className="flex flex-col gap-3">
        <span className="sr-only" aria-live="polite" data-add-to-cart-status />
        <AddToCart product={product} selectedVariant={selectedVariant} />
      </div>
      <Details title={product.title} size={size} />
    </>
  );
}

function ConceptInfo({ data, concept }: { data: PageData; concept: ConceptProduct }) {
  return (
    <>
      <div className="flex flex-col gap-2.5">
        <span className="pw-eyebrow">{eyebrowFor(data)}</span>
        <h1 className="text-[clamp(34px,3.4vw,44px)] leading-[1.06] tracking-[-0.02em]">{concept.title}</h1>
        <span className="text-muted text-[15px]">Coming soon · {SCENT_NOTE[concept.scent]}</span>
      </div>
      <p className="text-base leading-[1.65]">Coming soon to the Plainwell shelf.</p>
      <ScentSwitch data={data} />
      <div className="flex flex-col gap-2.5">
        <span className="text-muted text-[13px]">Size</span>
        <span className="border-ink inline-flex h-10 items-center self-start border px-4 text-[13px]">
          {concept.size}
          {concept.bottleRefills ? " · draft size" : ""}
        </span>
      </div>
      <div className="border-line border-t pt-4 text-[22px] tracking-[-0.01em]">Price to come</div>
      <div className="flex flex-col gap-3">
        <button type="button" disabled className="pw-btn pw-btn--secondary w-full">
          Coming soon
        </button>
        <span className="text-muted text-[13px]">
          A new product on its way. Price, formula and availability are still to come.
        </span>
      </div>
      <Details
        title={concept.title}
        size={concept.size}
        extra={
          concept.bottleRefills
            ? `Refills a 16 fl oz bottle ${concept.bottleRefills === 2 ? "twice" : `${concept.bottleRefills} times`}. The 32 fl oz size is a draft.`
            : undefined
        }
      />
    </>
  );
}

const SAMPLE_REVIEWS = [
  { name: "Sample reviewer A.", household: "Household of 2", rating: 5, date: "Oct 9, 2026", body: "Sample review text. Two or three plain sentences in the customer’s own words, once real reviews are connected." },
  { name: "Sample reviewer B.", household: "Household of 4+", rating: 5, date: "Oct 2, 2026", body: "Sample review text. A short note on texture and scent." },
  { name: "Sample reviewer C.", household: "Just me", rating: 4, date: "Sep 27, 2026", body: "Sample review text. A four-star review with one small reservation, to show how mixed feedback reads." },
];
const SAMPLE_BARS: [number, number][] = [[5, 98], [4, 19], [3, 6], [2, 2], [1, 1]];

// Layout for reviews, filled with clearly labelled sample content until a reviews app is connected.
function Reviews({ title, live }: { title: string; live: boolean }) {
  return (
    <section id="reviews" className="pw-gutter flex scroll-mt-24 flex-col gap-10 pt-28" aria-labelledby="reviews-heading">
      <div className="border-ink flex flex-wrap items-end justify-between gap-6 border-b pb-[22px]">
        <div className="flex flex-col gap-2.5">
          <span className="pw-eyebrow">Reviews · Sample content</span>
          <h2 id="reviews-heading" className="pw-h2">
            From the shared shelf
          </h2>
        </div>
      </div>
      {!live ? (
        <p className="text-muted pb-6 text-base">Reviews open once {title} is available.</p>
      ) : (
        <div className="grid items-start gap-x-16 gap-y-10 lg:grid-cols-3">
          <div className="flex max-w-[360px] flex-col gap-[22px]">
            <div className="flex items-baseline gap-3.5">
              <span className="text-[64px] leading-none tracking-[-0.03em]">4.7</span>
              <span className="text-muted text-[13px]">out of 5 · sample</span>
            </div>
            <div className="flex flex-col gap-2 pt-1.5">
              {SAMPLE_BARS.map(([stars, count]) => (
                <div key={stars} className="grid grid-cols-[16px_1fr_36px] items-center gap-3 text-[13px]">
                  <span>{stars}</span>
                  <div className="bg-line relative h-0.5">
                    <div className="bg-ink absolute inset-y-0 left-0" style={{ width: `${Math.round((count / 98) * 100)}%` }} />
                  </div>
                  <span className="text-muted text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col lg:col-span-2">
            {SAMPLE_REVIEWS.map((review) => (
              <article key={review.name} className="border-line grid gap-x-8 gap-y-3 border-b py-7 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{review.name}</span>
                  <span className="text-muted pt-1.5 text-[13px]">{review.household}</span>
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
                  <div className="flex justify-between gap-4">
                    <span role="img" aria-label={`${review.rating} out of 5 stars`} className="tracking-[2px]">
                      {"★".repeat(review.rating)}
                      <span className="text-line">{"★".repeat(5 - review.rating)}</span>
                    </span>
                    <span className="text-muted text-[13px]">{review.date}</span>
                  </div>
                  <span className="font-medium">Sample review headline</span>
                  <p className="max-w-[620px] leading-[1.65]">{review.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ProductJsonLd({ data }: { data: LiveData }) {
  const { product } = data;
  const variant = product.selectedOrFirstAvailableVariant;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.featuredImage?.url,
    sku: variant?.sku || undefined,
    brand: { "@type": "Brand", name: product.vendor || "Plainwell Body Co." },
    offers: variant
      ? {
          "@type": "Offer",
          url: `${data.origin}/products/${product.handle}`,
          price: variant.price.amount,
          priceCurrency: variant.price.currencyCode,
          availability: variant.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        }
      : undefined,
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop all", item: `${data.origin}/collections/all` },
      ...(data.category
        ? [{ "@type": "ListItem", position: 2, name: CATEGORY_LABEL[data.category].label, item: `${data.origin}${CATEGORY_LABEL[data.category].href}` }]
        : []),
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

function ProductPage({ data, info }: { data: PageData; info: ReactNode }) {
  const title = data.kind === "live" ? data.product.title : data.concept.title;
  const ritual = ritualFor(data.scent as Scent | null, data.family);

  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <nav aria-label="Breadcrumb" className="pw-gutter text-muted flex flex-wrap gap-2 py-5 text-[13px]">
        <Link to="/collections/all" className="pw-hover">
          Shop all
        </Link>
        {data.category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link to={CATEGORY_LABEL[data.category].href} className="pw-hover">
              {CATEGORY_LABEL[data.category].label}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="text-ink" aria-current="page">
          {title}
        </span>
      </nav>
      <section className="border-line grid items-start border-t md:grid-cols-2">
        <div className="bg-shelf border-line aspect-[4/5] md:col-start-1 md:row-start-1 md:border-r">
          <ProductImage data={data} />
        </div>
        <div className="flex max-w-[620px] flex-col gap-7 px-5 pt-10 pb-14 md:sticky md:top-[var(--spacing-header)] md:col-start-2 md:row-span-2 md:row-start-1 md:px-[clamp(24px,5vw,88px)] md:pt-14 md:pb-[72px]">
          {info}
        </div>
        <div className="bg-olive border-line aspect-[4/5] border-t md:col-start-1 md:row-start-2 md:border-r">
          <Media
            name={ritual.name}
            alt={ritual.alt}
            sizes={GALLERY_SIZES}
            width={1254}
            height={1254}
            className="h-full w-full object-cover"
          />
        </div>
      </section>
      <Reviews title={title} live={data.kind === "live"} />
      <section className="pt-28 pb-28" aria-labelledby="pairs-heading">
        <div className="pw-gutter flex items-baseline justify-between gap-4 pb-[22px]">
          <h2 id="pairs-heading" className="pw-section-label">
            Pairs well with
          </h2>
          <Link to="/collections/all" className="pw-link">
            Shop all
          </Link>
        </div>
        <ProductGrid items={data.pairs as CardItem[]} />
      </section>
    </main>
  );
}

export default function ProductRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const location = useLocation();

  if (loaderData.kind === "concept") {
    return <ProductPage data={loaderData} info={<ConceptInfo data={loaderData} concept={loaderData.concept} />} />;
  }

  const { product } = loaderData;
  return (
    <ProductProvider
      product={product}
      onSelect={(result) => {
        const url = toRouterLocation(
          variantUrl(
            product,
            result.selectedOptions,
            result.selectedVariant?.product?.handle,
            new URLSearchParams(location.search),
          ),
        );
        void navigate(url, {
          replace: true,
          preventScrollReset: true,
          ...(result.status === "resolved" ? { defaultShouldRevalidate: false } : {}),
        });
      }}
    >
      <ProductViewedTracker product={product} />
      <ProductJsonLd data={loaderData} />
      <ProductPage data={loaderData} info={<LiveInfo data={loaderData} />} />
    </ProductProvider>
  );
}
