import type { MoneyV2 } from "@shopify/hydrogen";

import { formatPrice } from "~/lib/money";
import { FREE_SHIPPING_THRESHOLD } from "~/lib/plainwell";

export const STANDARD_SHIPPING = 8;

/**
 * The shipping line under a subtotal. A hint derived from Shopify's own subtotal in
 * whole cents; checkout calculates the real shipping charge.
 */
export function shippingNote(subtotal: MoneyV2 | null | undefined): string {
  const cents = subtotal ? Math.round(Number(subtotal.amount) * 100) : 0;
  if (cents <= 0) return `Complimentary US shipping on orders over $${FREE_SHIPPING_THRESHOLD}.`;
  if (cents >= FREE_SHIPPING_THRESHOLD * 100) return "Your order ships free.";
  const away = { amount: ((FREE_SHIPPING_THRESHOLD * 100 - cents) / 100).toFixed(2), currencyCode: subtotal!.currencyCode };
  return `${formatPrice(away)} away from complimentary shipping.`;
}

export function shippingLabel(subtotal: MoneyV2 | null | undefined): string {
  const cents = subtotal ? Math.round(Number(subtotal.amount) * 100) : 0;
  if (cents <= 0) return "—";
  return cents >= FREE_SHIPPING_THRESHOLD * 100 ? "Complimentary" : `$${STANDARD_SHIPPING}.00`;
}
