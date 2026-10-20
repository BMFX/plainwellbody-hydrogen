import { gql, type StorefrontApi } from "@shopify/hydrogen";
import { useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router";

import { useCartForm } from "~/lib/cart";
import { openCartDrawer } from "~/lib/cart-drawer";
import { shopifyImageUrl, shopifySrcSet } from "~/lib/images";
import { wholePrice } from "~/lib/money";
import { useText } from "~/lib/text";

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
          sort: field(key: "sort") {
            value
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
  }
`);

const PRODUCT_CARD_SHAPE_QUERY = gql(
  `query ProductCardShape { products(first: 1) { nodes { ...ProductCard } } }`,
  [PRODUCT_CARD_FRAGMENT],
);

export type ProductCardData = StorefrontApi.ResultOf<
  typeof PRODUCT_CARD_SHAPE_QUERY
>["products"]["nodes"][number];

/** One card in a grid, from Shopify product data and its Plainwell metafields. */
export type CardItem = {
  handle: string;
  title: string;
  /** The scent family's note, e.g. "Bright, clean, morning". */
  note: string;
  size: string;
  scent: { handle: string; name: string; sort: number } | null;
  family: string;
  comingSoon: boolean;
  live: ProductCardData;
};

type ScentRef = { handle?: string; name?: { value?: string | null } | null; note?: { value?: string | null } | null; sort?: { value?: string | null } | null };

/** The first real option value (e.g. "16 fl oz"); Shopify's placeholder "Default Title" is skipped. */
export function sizeOf(options: readonly { name: string; value: string }[] | undefined) {
  return options?.find((o) => o.value !== "Default Title")?.value ?? "";
}

export function cardFromProduct(product: ProductCardData): CardItem {
  const ref = product.scent?.reference as ScentRef | null | undefined;
  const scent = ref?.handle ? { handle: ref.handle, name: ref.name?.value ?? "", sort: Number(ref.sort?.value ?? 999) } : null;
  return {
    handle: product.handle,
    title: product.title,
    note: ref?.note?.value ?? "",
    size: sizeOf(product.selectedOrFirstAvailableVariant?.selectedOptions),
    scent,
    family: product.family?.value ?? "",
    comingSoon: product.comingSoon?.value === "true",
    live: product,
  };
}

const CARD_SIZES = "(min-width: 64rem) 25vw, 50vw";

export function ProductCard({ item, priority = false }: { item: CardItem; priority?: boolean }) {
  const t = useText();
  const product = item.live;
  const image = product.featuredImage;
  const price = product.selectedOrFirstAvailableVariant?.price ?? product.priceRange.minVariantPrice;
  const note = item.comingSoon && item.note ? t("card.coming_soon_note", { note: item.note }) : item.note;

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
        ) : null}
      </Link>
      <div className="pw-card__body">
        <h3 className="font-medium">
          <Link to={`/products/${item.handle}`} className="pw-hover">
            {item.title}
          </Link>
        </h3>
        {note ? <p className="text-muted">{note}</p> : null}
        <div className="pw-card__meta">
          <span className="text-muted">{item.size}</span>
          <span>{item.comingSoon ? t("card.price_to_come") : wholePrice(price)}</span>
        </div>
        {item.comingSoon ? (
          <span className="pw-card__cta pw-card__cta--soon">{t("card.coming_soon")}</span>
        ) : (
          <AddToBag product={product} />
        )}
      </div>
    </article>
  );
}

// Adds sent before the first one settles would each create a cart; chain them.
let pendingAdd: Promise<unknown> = Promise.resolve();

function AddToBag({ product }: { product: ProductCardData }) {
  const t = useText();
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
        {!available ? t("card.sold_out") : state === "added" ? t("card.added") : t("card.add_to_bag")}
        <span className="sr-only">{t("card.add_to_bag_sr", { title: product.title })}</span>
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
