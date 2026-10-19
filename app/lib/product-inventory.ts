import { Cache, gql, type SelectedOption } from "@shopify/hydrogen";

import type { RequestStorefrontClient } from "./storefront";

// Keep the permission-gated field out of the essential product query.
export const PRODUCT_INVENTORY_QUERY = gql(`
  query ProductInventory($handle: String!, $selectedOptions: [SelectedOptionInput!]!) {
    product(handle: $handle) {
      selectedOrFirstAvailableVariant(
        selectedOptions: $selectedOptions
        ignoreUnknownOptions: true
        caseInsensitiveMatch: true
      ) {
        id
        quantityAvailable
      }
      adjacentVariants(
        selectedOptions: $selectedOptions
        ignoreUnknownOptions: true
        caseInsensitiveMatch: true
      ) {
        id
        quantityAvailable
      }
      options {
        optionValues {
          firstSelectableVariant {
            id
            quantityAvailable
          }
        }
      }
    }
  }
`);

export async function loadProductInventory(
  client: RequestStorefrontClient,
  handle: string,
  selectedOptions: SelectedOption[],
): Promise<Record<string, number>> {
  try {
    const result = await client.graphql(PRODUCT_INVENTORY_QUERY, {
      variables: { handle, selectedOptions },
      // Counts should reflect the current sellable stock, without stale cache data.
      cache: Cache.none(),
    });
    if (result.errors?.length || !result.data?.product) return {};
    const product = result.data.product;
    const variants = [
      product.selectedOrFirstAvailableVariant,
      ...product.adjacentVariants,
      ...product.options.flatMap((option) => option.optionValues.map((value) => value.firstSelectableVariant)),
    ];
    const inventory: Record<string, number> = {};
    for (const variant of variants) {
      if (variant && Number.isInteger(variant.quantityAvailable)) {
        inventory[variant.id] = variant.quantityAvailable!;
      }
    }
    return inventory;
  } catch {
    // Missing scope, API errors, or network failures must only hide the count.
    return {};
  }
}

export function inventoryHintText(
  variant: { id: string; availableForSale: boolean } | null,
  inventory: Record<string, number>,
): string | null {
  if (!variant) return null;
  if (!variant.availableForSale) return "Out of stock";
  const quantity = inventory[variant.id];
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 5 ? `Only ${quantity} left` : null;
}
