import { ShopPayButton } from "@shopify/hydrogen/react";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { publishCartViewed } from "~/components/AnalyticsTrackers";
import { CartLineItem } from "~/components/CartDrawer";
import { cardFromProduct, ProductGrid } from "~/components/ProductCard";
import { useCart, useCartActions } from "~/lib/cart";
import { formatPrice } from "~/lib/money";
import { seoMeta } from "~/lib/seo";
import { shippingCharge, shippingLabel, shippingNote } from "~/lib/shipping";
import { useSiteContent, useText } from "~/lib/text";

import type { Route } from "./+types/cart";

export function meta({ matches }: Route.MetaArgs) {
  const content = (matches[0]?.data as { content?: { text: Record<string, string> } } | undefined)?.content;
  // Personal and changing: keep the bag out of search results.
  return seoMeta(matches[0], {
    title: content?.text["seo.bag_title"] ?? "",
    description: content?.text["seo.bag_description"] ?? null,
    path: "/cart",
    noindex: true,
  });
}

export default function CartRoute() {
  const t = useText();
  const content = useSiteContent();
  const cart = useCart((state) => state.data);
  const loading = useCart((state) => state.loading);
  const pending = useCart((state) => state.pending);
  const { refresh } = useCartActions();
  const location = useLocation();
  const navigate = useNavigate();
  const lines = cart.lines.nodes;
  const isPending = (pending.cost ?? pending.lines.size > 0) || pending.discountCodes.size > 0;
  const settings = content?.settings ?? { freeShippingThreshold: null, standardShippingRate: null };
  const oftenAdded = (content?.settings.oftenAdded ?? []).map(cardFromProduct);

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
  const charge = shippingCharge(settings, cart.cost.subtotalAmount);
  const shipsFree = charge ? Number(charge.amount) === 0 : false;
  const shipping = shippingLabel(t, settings, cart.cost.subtotalAmount);
  const note = shippingNote(t, settings, cart.cost.subtotalAmount);

  return (
    <main id="main-content" tabIndex={-1} className="flex-1">
      <section className="pw-gutter border-line flex flex-wrap items-end justify-between gap-6 border-b pt-14 pb-7 md:pt-[72px]">
        <h1 id="cart-page-title" tabIndex={-1} className="pw-h1">
          {t("bag.title")}
        </h1>
        <span className="text-muted text-[13px]" aria-live="polite">
          {t(count === 1 ? "bag.count_one" : "bag.count_other", { count })}
        </span>
      </section>

      <section className="pw-contain grid items-start lg:grid-cols-[minmax(0,1fr)_minmax(380px,560px)]">
        <div className="pw-gutter border-line min-w-0 lg:border-r">
          {loading ? <p className="text-muted py-24">{t("bag.loading")}</p> : null}
          {!loading && lines.length === 0 ? (
            <div className="flex flex-col items-start gap-5 py-24">
              <p className="pw-heading">{t("bag.empty")}</p>
              <Link to="/collections/all" className="pw-btn pw-btn--primary">
                {t("bag.empty_link")}
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
          <p className="text-muted max-w-[520px] pt-7 pb-14 text-[13px]">{t("bag.lines_note")}</p>
        </div>

        {lines.length > 0 ? (
          <aside className="pw-gutter flex flex-col pt-10 pb-14 lg:sticky lg:top-[var(--spacing-header)]" aria-label={t("bag.summary")} aria-busy={isPending}>
            <span className="pw-eyebrow pb-[18px]">{t("bag.summary")}</span>
            <div className="border-line flex justify-between border-t py-3.5">
              <span>{t("bag.subtotal")}</span>
              <span className={isPending ? "opacity-50" : ""}>{formatPrice(cart.cost.subtotalAmount)}</span>
            </div>
            {shipping ? (
              <div className="border-line flex justify-between border-t py-3.5">
                <span>{t("bag.shipping")}</span>
                <span className={isPending ? "opacity-50" : ""}>{shipping}</span>
              </div>
            ) : null}
            <div className="border-line text-muted flex justify-between border-t py-3.5">
              <span>{t("bag.taxes")}</span>
              <span>{t("bag.taxes_value")}</span>
            </div>
            <div className="border-ink flex items-baseline justify-between border-t pt-5 pb-6">
              <span>{shipsFree || !charge ? t("bag.total") : t("bag.total_before_shipping")}</span>
              <span className={`pw-title ${isPending ? "opacity-50" : ""}`}>{formatPrice(cart.cost.totalAmount)}</span>
            </div>
            {cart.checkoutUrl ? (
              <div className="flex flex-col gap-3">
                <a href={cart.checkoutUrl} className="pw-btn pw-btn--primary w-full">
                  {t("bag.checkout")}
                </a>
                <ShopPayButton width="100%" borderRadius="0px" />
              </div>
            ) : null}
            {note ? <span className={`text-muted pt-3.5 text-[13px] ${isPending ? "opacity-50" : ""}`}>{note}</span> : null}
          </aside>
        ) : null}
      </section>

      {oftenAdded.length ? (
        <section className="border-line border-t pt-28 pb-28" aria-labelledby="often-added-heading">
          <div className="pw-gutter flex items-baseline justify-between gap-4 pb-[22px]">
            <h2 id="often-added-heading" className="pw-section-label">
              {t("bag.often_added")}
            </h2>
            <Link to="/collections/all" className="pw-link">
              {t("bag.often_added_link")}
            </Link>
          </div>
          <ProductGrid items={oftenAdded} />
        </section>
      ) : null}
    </main>
  );
}
