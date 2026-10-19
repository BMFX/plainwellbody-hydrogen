import { gql, type StorefrontApi } from "@shopify/hydrogen";
import { useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router";

import { Media } from "~/components/Media";
import { useCartForm } from "~/lib/cart";
import { openCartDrawer } from "~/lib/cart-drawer";
import { shopifyImageUrl, shopifySrcSet } from "~/lib/images";
import { wholePrice } from "~/lib/money";
import {
  type ConceptProduct,
  categoryOf,
  familyOf,
  SCENT_NOTE,
  scentOf,
  type CategoryKey,
  type Scent,
} from "~/lib/plainwell";

export const PRODUCT_CARD_FRAGMENT = gql(`
  fragment ProductCard on Product {
    id
    handle
    title
    productType
    tags
    availableForSale
    featuredImage {
      url
      altText
      width
      height
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    selectedOrFirstAvailableVariant {
      id
      title
      availableForSale
      price {
        amount
        currencyCode
      }
      selectedOptions {
        name
        value
      }
      image {
        url
        altText
      }
    }
  }
`);

const PRODUCT_CARD_SHAPE_QUERY = gql(
  `query ProductCardShape { products(first: 1) { nodes { ...ProductCard } } }`,
  [PRODUCT_CARD_FRAGMENT],
);

export type ProductCardData = StorefrontApi.ResultOf<
  typeof PRODUCT_CARD_SHAPE_QUERY
>["products"]["nodes"][number];

/** One card in a grid: a live Shopify product, or a coming-soon product with no price. */
export type CardItem = {
  handle: string;
  title: string;
  note: string;
  size: string;
  scent: Scent | null;
  family: string;
  category: CategoryKey | null;
  live: ProductCardData | null;
};

export function cardFromProduct(product: ProductCardData): CardItem {
  const scent = scentOf(product.tags);
  const variant = product.selectedOrFirstAvailableVariant;
  return {
    handle: product.handle,
    title: product.title,
    note: scent ? SCENT_NOTE[scent] : "",
    size: variant?.selectedOptions.find((o) => o.name === "Size")?.value ?? "",
    scent,
    family: familyOf(product.handle),
    category: categoryOf(product.tags, product.productType),
    live: product,
  };
}

export function cardFromConcept(product: ConceptProduct): CardItem {
  return {
    handle: product.handle,
    title: product.title,
    note: `Coming soon · ${SCENT_NOTE[product.scent]}`,
    size: product.size,
    scent: product.scent,
    family: product.family,
    category: product.category,
    live: null,
  };
}

const CARD_SIZES = "(min-width: 64rem) 25vw, 50vw";

export function ProductCard({ item, priority = false }: { item: CardItem; priority?: boolean }) {
  const product = item.live;
  const image = product?.featuredImage;
  const price = product?.selectedOrFirstAvailableVariant?.price ?? product?.priceRange.minVariantPrice;

  return (
    <article className="pw-card" data-testid="product-card" aria-label={item.title}>
      <Link to={`/products/${item.handle}`} className="pw-card__media" tabIndex={-1} aria-hidden="true">
        {image ? (
          <img
            src={shopifyImageUrl(image.url, 600)}
            srcSet={shopifySrcSet(image.url, [360, 540, 720, 900, 1200])}
            sizes={CARD_SIZES}
            alt=""
            width={1000}
            height={1250}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
          />
        ) : (
          <Media name={`pack-${item.handle}`} alt="" sizes={CARD_SIZES} width={1000} height={1250} />
        )}
      </Link>
      <div className="pw-card__body">
        <h3 className="font-medium">
          <Link to={`/products/${item.handle}`} className="pw-hover">
            {item.title}
          </Link>
        </h3>
        {item.note ? <p className="text-muted">{item.note}</p> : null}
        <div className="pw-card__meta">
          <span className="text-muted">{item.size}</span>
          <span>{price ? wholePrice(price) : "Price to come"}</span>
        </div>
        {product ? (
          <AddToBag product={product} />
        ) : (
          <span className="pw-card__cta pw-card__cta--soon">Coming soon</span>
        )}
      </div>
    </article>
  );
}

// Adds sent before the first one settles would each create a cart; chain them.
let pendingAdd: Promise<unknown> = Promise.resolve();

function AddToBag({ product }: { product: ProductCardData }) {
  const variant = product.selectedOrFirstAvailableVariant;
  const { formProps } = useCartForm();
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  if (!variant) return null;

  const available = variant.availableForSale;
  const settle = (promise: Promise<unknown>) =>
    promise.then(
      () => {
        setState("added");
        window.setTimeout(() => setState("idle"), 2000);
      },
      () => setState("idle"),
    );

  // Without JavaScript the form posts to /api/cart. Hydrated, it goes through the
  // cart store: directly via Standard Actions (with a preview line, so the drawer
  // shows the product at once) when the store has configured updateCart, or as a
  // cart form, which configures it on demand.
  const props = formProps({
    beforeSubmit(event: FormEvent<HTMLFormElement>) {
      setState("adding");
      openCartDrawer();
      const updateCart = window.Shopify?.actions?.updateCart;
      if (!updateCart || updateCart.isDefault()) {
        // The store tracks this add; the drawer shows it as pending until it lands.
        setState("idle");
        return;
      }
      event.preventDefault();
      const preview = {
        id: variant.id,
        price: variant.price,
        title: variant.title,
        selectedOptions: variant.selectedOptions,
        image: variant.image ?? product.featuredImage,
        product: { title: product.title, handle: product.handle },
      };
      pendingAdd = pendingAdd
        .catch(() => undefined)
        .then(() =>
          updateCart(
            { lines: [{ merchandiseId: variant.id, quantity: 1 }] },
            { event: { detail: { products: [preview] } } },
          ),
        );
      settle(pendingAdd);
    },
  });

  return (
    <form {...props} className="mt-auto">
      <input type="hidden" name="merchandiseId" value={variant.id} />
      <input type="hidden" name="quantity" value="1" />
      <button
        type="submit"
        name="add-to-cart"
        className="pw-card__cta"
        disabled={!available}
        data-pending={state === "adding" ? "" : undefined}
      >
        {!available ? "Sold out" : state === "added" ? "Added ✓" : "Add to bag"}
        <span className="sr-only">: {product.title}</span>
      </button>
    </form>
  );
}

export function ProductGrid({
  items,
  priorityCount = 0,
  columns = 4,
}: {
  items: CardItem[];
  priorityCount?: number;
  columns?: 3 | 4;
}) {
  return (
    <ul
      role="list"
      className="pw-grid"
      data-testid="product-grid"
      style={{ "--pw-cols": columns } as CSSProperties}
    >
      {items.map((item, index) => (
        <li key={item.handle}>
          <ProductCard item={item} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
