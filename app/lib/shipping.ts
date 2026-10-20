import type { MoneyV2 } from "@shopify/hydrogen";

import type { SiteSettings } from "~/lib/content";
import { formatPrice } from "~/lib/money";

// Shipping hints from Site settings (free shipping threshold and standard rate). With
// either figure missing in Shopify, nothing is shown. Checkout calculates the real charge.

type Text = (key: string, vars?: Record<string, string | number>) => string;
type Shipping = Pick<SiteSettings, "freeShippingThreshold" | "standardShippingRate">;

const cents = (money: MoneyV2 | null | undefined) => (money ? Math.round(Number(money.amount) * 100) : 0);
const money = (c: number, currencyCode: string) => ({ amount: (c / 100).toFixed(2), currencyCode }) as MoneyV2;

export function freeShippingMessage(t: Text, settings: Shipping, currencyCode = "USD") {
  if (settings.freeShippingThreshold == null) return "";
  return t("shipping.free_over", { amount: formatPrice(money(settings.freeShippingThreshold * 100, currencyCode)).replace(/\.00$/, "") });
}

/** The line under a subtotal: how far from free shipping, or that it ships free. */
export function shippingNote(t: Text, settings: Shipping, subtotal: MoneyV2 | null | undefined): string {
  if (settings.freeShippingThreshold == null) return "";
  const c = cents(subtotal);
  const threshold = Math.round(settings.freeShippingThreshold * 100);
  if (c <= 0) return freeShippingMessage(t, settings, subtotal?.currencyCode);
  if (c >= threshold) return t("shipping.ships_free");
  return t("shipping.away", { amount: formatPrice(money(threshold - c, subtotal!.currencyCode)) });
}

/** The standard shipping charge for this subtotal, or null when Shopify has no figures. */
export function shippingCharge(settings: Shipping, subtotal: MoneyV2 | null | undefined): MoneyV2 | null {
  if (settings.freeShippingThreshold == null || settings.standardShippingRate == null || !subtotal) return null;
  const c = cents(subtotal);
  if (c <= 0) return null;
  return money(c >= Math.round(settings.freeShippingThreshold * 100) ? 0 : Math.round(settings.standardShippingRate * 100), subtotal.currencyCode);
}

export function shippingLabel(t: Text, settings: Shipping, subtotal: MoneyV2 | null | undefined): string {
  const charge = shippingCharge(settings, subtotal);
  if (!charge) return "";
  return Number(charge.amount) === 0 ? t("shipping.complimentary") : formatPrice(charge);
}
