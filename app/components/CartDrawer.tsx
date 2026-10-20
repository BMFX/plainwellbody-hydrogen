import { useEffect, useMemo, useState, type SubmitEvent } from "react";
import { Link } from "react-router";

import { useCart, useCartForm } from "~/lib/cart";
import { closeCartDrawer, configureOpenCartAction, CART_DRAWER_ID } from "~/lib/cart-drawer";
import { shopifyImageUrl, shopifySrcSet } from "~/lib/images";
import { formatPrice } from "~/lib/money";
import { shippingNote } from "~/lib/shipping";
import { useSiteContent, useText } from "~/lib/text";
import { sizeOf } from "./ProductCard";

import { publishCartViewed } from "./AnalyticsTrackers";

function CartErrorBanner() {
  const t = useText();
  const errors = useCart((state) => state.errors);
  const [dismissedAt, setDismissedAt] = useState(0);
  const messages = useMemo(() => {
    const lines = [...errors.lines.values()].flatMap((group) => group.userErrors);
    return [...errors.network, ...errors.cart.userErrors, ...lines].map((error) => error.message);
  }, [errors]);

  if (messages.length === 0 || errors.lastUpdatedAt <= dismissedAt) return null;

  return (
    <div className="border-line bg-shelf mx-5 mt-4 border p-3 text-sm sm:mx-8" role="alert">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          {messages.map((message) => (
            <p key={message} className="text-critical">
              {message}
            </p>
          ))}
        </div>
        <button
          type="button"
          className="button-ghost focus-visible:outline-accent rounded px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => setDismissedAt(errors.lastUpdatedAt)}
        >
          {t("bag.dismiss")}
        </button>
      </div>
    </div>
  );
}

function hasPendingCost(pending: {
  cost?: boolean;
  discountCodes: Set<string>;
  lines: Set<string>;
}): boolean {
  return pending.cost ?? (pending.lines.size > 0 || pending.discountCodes.size > 0);
}

function useCartStatusMessage(): string {
  const t = useText();
  const pending = useCart((state) => state.pending);
  const revalidating = useCart((state) => "revalidating" in state && state.revalidating === true);
  const networkErrors = useCart((state) => state.errors.network);
  const isPending = hasPendingCost(pending) || revalidating;
  const [sawPending, setSawPending] = useState(false);

  useEffect(() => {
    if (isPending) setSawPending(true);
  }, [isPending]);

  if (isPending) return t("bag.status_updating");
  if (sawPending && networkErrors.length === 0) return t("bag.status_updated");
  return "";
}

type CartLineView = {
  id: string;
  quantity: number;
  cost: { totalAmount: { amount: string; currencyCode: string } };
  attributes?: Array<{ key: string; value: string | null }>;
  merchandise?: {
    title?: string | null;
    selectedOptions?: Array<{ name: string; value: string }> | null;
    image?: { url: string; altText?: string | null } | null;
    product?: { title?: string | null; handle?: string | null } | null;
  } | null;
};

export function CartLineItem({
  line,
  emptyCartFocusId,
}: {
  line: CartLineView;
  emptyCartFocusId: string;
}) {
  const t = useText();
  const { formProps, register } = useCartForm();
  const pendingLines = useCart((state) => state.pending.lines);
  const lineError = useCart((state) => state.errors.lines.get(line.id));
  const merchandise = line.merchandise;
  const product = merchandise?.product;
  const pending = pendingLines.has(line.id);
  const optionText = merchandise?.selectedOptions
    ?.map((option: { name: string; value: string }) => option.value)
    .join(" / ");
  const errorId = `cart-line-error-${line.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  // Removing a line unmounts the control that holds focus. Move focus to the same
  // control on a neighbouring line (or `emptyCartFocusId`) while the line still exists.
  const moveFocusBeforeRemoval = (event: SubmitEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    if (!form.contains(document.activeElement)) return;
    const intent = event.nativeEvent.submitter?.getAttribute("value");
    const quantity = new FormData(form).get("quantity");
    const removesLine =
      intent === "remove" ||
      (intent === "decrease" && line.quantity <= 1) ||
      (intent === "set" && Number(quantity) <= 0);
    if (!removesLine) return;

    const item = form.closest("li");
    const neighbour = item?.nextElementSibling ?? item?.previousElementSibling;
    const selector = intent === "set" ? 'input[name="quantity"]' : `button[value="${intent}"]`;
    const target =
      neighbour?.querySelector<HTMLElement>(selector) ?? document.getElementById(emptyCartFocusId);
    target?.focus();
  };

  const title = product?.title ?? merchandise?.title ?? "";
  const size = merchandise?.selectedOptions ? sizeOf(merchandise.selectedOptions) || optionText : optionText;

  return (
    <li
      className={`border-line grid grid-cols-[80px_1fr_auto] items-start gap-x-4 gap-y-3 border-b py-6 transition-opacity sm:grid-cols-[96px_1fr_auto] sm:gap-x-5 ${pending ? "opacity-60" : ""}`}
      data-testid="cart-line"
      {...(pending ? { "aria-busy": "true" } : {})}
    >
      <div className="bg-shelf aspect-[4/5] overflow-hidden">
        {merchandise?.image ? (
          <img
            src={shopifyImageUrl(merchandise.image.url, 200)}
            srcSet={shopifySrcSet(merchandise.image.url, [200, 300])}
            sizes="96px"
            alt=""
            width={96}
            height={120}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-medium">
          {product?.handle ? (
            <Link to={`/products/${product.handle}`} className="pw-hover">
              {title}
            </Link>
          ) : (
            title
          )}
        </p>
        {size ? <p className="text-muted">{size}</p> : null}
        {line.attributes
          ?.filter((attr) => !attr.key.startsWith("_") && attr.value != null)
          .map((attr) => (
            <p key={attr.key} className="text-muted text-xs">
              {attr.key}: {attr.value}
            </p>
          ))}
        <form
          {...formProps({ beforeSubmit: moveFocusBeforeRemoval })}
          className="mt-3.5 flex items-center gap-5"
        >
          <button {...register("set")} />
          <input type="hidden" {...register("lineId", { value: line.id })} />
          <div className="border-line inline-flex h-11 items-center border">
            <button
              type="submit"
              {...register("decrease")}
              className="inline-flex h-full w-10 items-center justify-center text-base"
              aria-label={t("bag.line.decrease", { title })}
            >
              −
            </button>
            <input
              {...register("quantity", { value: line.quantity, interactive: true })}
              className={`number-reset !h-full !w-9 !border-0 !bg-transparent !p-0 text-center !text-sm ${pending ? "opacity-50" : ""}`}
              aria-label={t("bag.line.quantity", { title })}
              aria-describedby={lineError?.userErrors.length ? errorId : undefined}
              aria-invalid={lineError?.userErrors.length ? true : undefined}
            />
            <button
              type="submit"
              {...register("increase")}
              className="inline-flex h-full w-10 items-center justify-center text-base"
              aria-label={t("bag.line.increase", { title })}
            >
              +
            </button>
          </div>
          <button
            type="submit"
            {...register("remove")}
            className="text-muted hover:text-ink inline-flex h-11 items-center text-[13px] underline underline-offset-[3px]"
            aria-label={t("bag.line.remove_sr", { title })}
          >
            {t("bag.line.remove")}
          </button>
        </form>
        {lineError?.userErrors.length ? (
          <p id={errorId} className="mt-2 text-sm" role="alert">
            {lineError.userErrors[0]?.message}
          </p>
        ) : null}
      </div>
      <p className={`text-right ${pending ? "opacity-50" : ""}`}>{formatPrice(line.cost.totalAmount)}</p>
    </li>
  );
}

function CartLines() {
  const t = useText();
  const loading = useCart((state) => state.loading);
  const lines = useCart((state) => state.data.lines.nodes);

  if (loading) {
    return <p className="text-muted">{t("bag.loading")}</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="flex h-full flex-col items-start justify-center gap-5">
        <p className="pw-heading">{t("bag.empty")}</p>
        <Link to="/collections/all" className="pw-btn pw-btn--primary" onClick={() => closeCartDrawer()}>
          {t("bag.empty_link")}
        </Link>
      </div>
    );
  }

  return (
    <ul role="list" className="border-line border-t">
      {lines.map((line) => (
        <CartLineItem key={line.id} line={line} emptyCartFocusId="cart-drawer-title" />
      ))}
    </ul>
  );
}

function CartFooter() {
  const t = useText();
  const content = useSiteContent();
  const cart = useCart((state) => state.data);
  const pending = useCart((state) => state.pending);
  const revalidating = useCart((state) => "revalidating" in state && state.revalidating === true);
  const hasLines = cart.lines.nodes.length > 0;
  const isPending = hasPendingCost(pending) || revalidating;

  if (!hasLines) return null;

  return (
    <div className="border-line shrink-0 border-t px-5 pt-4 pb-6 sm:px-8">
      <div className="flex flex-col">
        <div className="flex items-baseline justify-between py-3" aria-busy={isPending}>
          <span>
            {t("bag.subtotal")}
            {isPending ? <span className="text-muted"> {t("bag.updating")}</span> : null}
          </span>
          <span className={`text-xl tracking-[-0.01em] ${isPending ? "opacity-50" : ""}`}>
            {formatPrice(cart.cost.subtotalAmount)}
          </span>
        </div>
        <p className={`text-muted pb-4 text-[13px] ${isPending ? "opacity-50" : ""}`}>
          {[content ? shippingNote(t, content.settings, cart.cost.subtotalAmount) : "", t("bag.taxes_note")].filter(Boolean).join(" ")}
        </p>
        {cart.checkoutUrl ? (
          <a href={cart.checkoutUrl} className="pw-btn pw-btn--primary w-full">
            {t("bag.checkout")}
          </a>
        ) : null}
        <Link to="/cart" className="pw-link mt-4 self-center" onClick={() => closeCartDrawer()}>
          {t("bag.view")}
        </Link>
      </div>
    </div>
  );
}

export function CartDrawer() {
  const t = useText();
  const totalQuantity = useCart((state) => state.data.totalQuantity);
  const cart = useCart((state) => state.data);
  const statusMessage = useCartStatusMessage();

  useEffect(() => {
    configureOpenCartAction();
    const dialog = document.getElementById(CART_DRAWER_ID);
    if (!(dialog instanceof HTMLDialogElement)) return;
    const handleToggle = () => {
      if (dialog.open) publishCartViewed(cart);
    };
    dialog.addEventListener("toggle", handleToggle);
    return () => dialog.removeEventListener("toggle", handleToggle);
  }, [cart]);

  return (
    <>
      <span
        role="status"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-cart-status
      >
        {statusMessage}
      </span>
      <dialog
        id={CART_DRAWER_ID}
        className="drawer-right bg-paper text-ink"
        aria-labelledby="cart-drawer-title"
        data-testid="cart-drawer"
        closedby="any"
      >
        <div className="flex h-full flex-col">
          <div className="border-line flex h-16 shrink-0 items-center border-b ps-5 pe-2 sm:ps-8">
            <div className="flex flex-1 items-baseline gap-3">
              <h2 id="cart-drawer-title" tabIndex={-1} className="pw-section-label">
                {t("bag.title")}
              </h2>
              <span className="text-muted text-[13px]">
                {t(totalQuantity === 1 ? "bag.count_one" : "bag.count_other", { count: totalQuantity })}
              </span>
            </div>
            <button
              type="button"
              commandfor={CART_DRAWER_ID}
              command="close"
              className="button-icon"
              aria-label={t("nav.close")}
              onClick={() => closeCartDrawer()}
            >
              <img src="/icons/icon-x.svg" alt="" className="size-5" aria-hidden="true" loading="lazy" />
            </button>
          </div>
          <CartErrorBanner />
          <div className="flex-1 overflow-y-auto px-5 sm:px-8">
            <CartLines />
          </div>
          <CartFooter />
        </div>
      </dialog>
    </>
  );
}
