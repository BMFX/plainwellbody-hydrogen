import { createProductComponents } from "@shopify/hydrogen/react";

import type { Route } from "../routes/+types/product";

type ProductData = Extract<Route.ComponentProps["loaderData"], { kind: "live" }>["product"];
export type ProductVariantData = NonNullable<ProductData["selectedOrFirstAvailableVariant"]>;

export const { ProductProvider, useProductForm } = createProductComponents<ProductData>();
