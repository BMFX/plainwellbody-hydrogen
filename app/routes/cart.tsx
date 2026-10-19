import { ShopPayButton } from "@shopify/hydrogen/react";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { publishCartViewed } from "~/components/AnalyticsTrackers";
import { CartLineItem } from "~/components/CartDrawer";
import { ProductGrid } from "~/components/ProductCard";
import { useCart, useCartActions } from "~/lib/cart";
import { formatPrice } from "~/lib/money";
import { loadCatalog } from "~/lib/plainwell-catalog";
import { shippingLabel, shippingNote } from "~/lib/shipping";
import { storefrontClientContext } from "~/lib/storefront";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/cart";

const OFTEN_ADDED = ["citrus-body-wash", "unscented-hand-wash", "cedar-travel-body-wash", "oat-bar-soap"];

export function meta({ matches }: Route.MetaArgs) {
  return [
    { title: formatPageTitle("Your bag", getShopNameFromRootMatch(matches[0])) },
    { name: "description", content: "Your Plainwell bag. Change any quantity before you check out." },
    // Personal and changing: keep the bag out of search results.
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const catalog = await loadCatalog(context.get(storefrontClientContext));
  return { more: OFTEN_ADDED.flatMap((handle) => catalog.live.filter((item) => item.handle === handle)) };
}

export default function CartRoute({ loaderData }: Route.ComponentProps) {
  const cart = useCart((state) => state.data);
  const loading = useCart((state) => state.loading);
  const pending = useCart((state) => state.pending);
  const { refresh } = useCartActions();
  const location = useLocation();
  const navigate = useNavigate();
  const lines = cart.lines.nodes;
  const isPending = (pending.cost ?? pending.lines.size > 0) || pending.discountCodes.size > 0;

  // The routine finder adds its lines on the server; pick them up in the cart store.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("added")) return;
    void refresh();
    void navigate({ search: "" }, { replace: true, preventScrollReset: true });
  }, [location.search, navigate, refresh]);

  useEffect(() => {
    publishCartViewed(cart);
  }, [cart]);

  const count = cart.totalQuantity;
  const shipsFree = shippingLabel(cart.cost.subtotalAmount) === "Complimentary";

  return (
    <main id="main-content" tabIndex={-1} className="flex-1">
      <section className="pw-gutter border-line flex flex-wrap items-end justify-between gap-6 border-b pt-14 pb-7 md:pt-[72px]">
        <h1 id="cart-page-title" tabIndex={-1} className="pw-h1">
          Your bag
        </h1>
        <span className="text-muted text-[13px]" aria-live="polite">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </section>

      <section className="grid items-start lg:grid-cols-[minmax(0,1fr)_minmax(380px,560px)]">
        <div className="pw-gutter border-line min-w-0 lg:border-r">
          {loading ? <p className="text-muted py-24">Loading your bag…</p> : null}
          {!loading && lines.length === 0 ? (
            <div className="flex flex-col items-start gap-5 py-24">
              <p className="pw-heading">Your bag is empty.</p>
              <Link to="/collections/all" className="pw-btn pw-btn--primary">
                Shop all essentials
              </Link>
            </div>
          ) : null}
          {lines.length > 0 ? (
            <ul role="list">
              {lines.map((line) => (
                <CartLineItem key={line.id} line={line} emptyCartFocusId="cart-page-title" />
              ))}
            </ul>
          ) : null}
          <p className="text-muted max-w-[520px] pt-7 pb-14 text-[13px]">
            Every essential is its own line. Change any quantity here before you check out.
          </p>
        </div>

        {lines.length > 0 ? (
          <aside
            className="pw-gutter flex flex-col pt-10 pb-14 lg:sticky lg:top-[var(--spacing-header)]"
            aria-label="Order summary"
            aria-busy={isPending}
          >
            <span className="pw-eyebrow pb-[18px]">Order summary</span>
            <div className="border-line flex justify-between border-t py-3.5">
              <span>Subtotal</span>
              <span className={isPending ? "opacity-50" : ""}>{formatPrice(cart.cost.subtotalAmount)}</span>
            </div>
            <div className="border-line flex justify-between border-t py-3.5">
              <span>US standard shipping</span>
              <span className={isPending ? "opacity-50" : ""}>{shippingLabel(cart.cost.subtotalAmount)}</span>
            </div>
            <div className="border-line text-muted flex justify-between border-t py-3.5">
              <span>Taxes</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="border-ink flex items-baseline justify-between border-t pt-5 pb-6">
              <span>{shipsFree ? "Estimated total" : "Total before shipping"}</span>
              <span className={`pw-title ${isPending ? "opacity-50" : ""}`}>{formatPrice(cart.cost.totalAmount)}</span>
            </div>
            {cart.checkoutUrl ? (
              <div className="flex flex-col gap-3">
                <a href={cart.checkoutUrl} className="pw-btn pw-btn--primary w-full">
                  Check out
                </a>
                <ShopPayButton width="100%" borderRadius="0px" />
              </div>
            ) : null}
            <span className={`text-muted pt-3.5 text-[13px] ${isPending ? "opacity-50" : ""}`}>
              {shippingNote(cart.cost.subtotalAmount)}
            </span>
          </aside>
        ) : null}
      </section>

      {loaderData.more.length ? (
        <section className="border-line border-t pt-28 pb-28" aria-labelledby="often-added-heading">
          <div className="pw-gutter flex items-baseline justify-between gap-4 pb-[22px]">
            <h2 id="often-added-heading" className="pw-section-label">
              Often added
            </h2>
            <Link to="/collections/all" className="pw-link">
              Shop all
            </Link>
          </div>
          <ProductGrid items={loaderData.more} />
        </section>
      ) : null}
    </main>
  );
}
