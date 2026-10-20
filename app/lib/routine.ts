import { sizeOf } from "~/components/ProductCard";
import type { Entry } from "~/lib/content";

// The routine finder's data, all from Shopify: the finder section lists one routine per
// scent family (Content › Metaobjects › Routine); each routine's lines name a product and
// the quantity for each household size (1, 2, 3, 4+), and whether it is a travel size.

export const HOUSEHOLDS = ["1", "2", "3", "4"] as const;
export type Household = (typeof HOUSEHOLDS)[number];
export const QTY_PREFIX = "qty.";

export type RoutineState = {
  step: 1 | 2 | 3;
  household: Household;
  /** The chosen routine's handle. */
  routine: string;
  travel: boolean;
  overrides: Record<string, number>;
};

export function parseRoutine(params: URLSearchParams | FormData, routineHandles: string[]): RoutineState {
  const get = (key: string) => {
    const all = params.getAll(key);
    return all.length ? String(all[all.length - 1]) : null;
  };
  const household = (HOUSEHOLDS.find((h) => h === get("household")) ?? "2") as Household;
  const routine = routineHandles.find((h) => h === get("scent")) ?? routineHandles[0] ?? "";
  const travelParam = get("travel");
  const travel = travelParam == null ? household !== "1" : travelParam === "1";
  const stepParam = Number(get("step"));
  const step = (stepParam === 2 || stepParam === 3 ? stepParam : 1) as 1 | 2 | 3;
  const overrides: Record<string, number> = {};
  const keys = new Set<string>();
  params.forEach((_, key) => {
    if (key.startsWith(QTY_PREFIX)) keys.add(key);
  });
  for (const key of keys) {
    const qty = Number.parseInt(get(key) ?? "", 10);
    if (Number.isInteger(qty) && qty >= 0 && qty <= 20) overrides[key.slice(QTY_PREFIX.length)] = qty;
  }
  return { step, household, routine, travel, overrides };
}

export type RoutineLine = {
  handle: string;
  title: string;
  size: string;
  image: string | null;
  variantId: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
};

/** The lines of the chosen routine for this household, with overrides applied. */
export function routineLines(state: RoutineState, routines: Entry[]): RoutineLine[] {
  const routine = routines.find((r) => r.handle === state.routine);
  if (!routine) return [];
  return routine.entries("lines").flatMap((line) => {
    const product = line.product("product");
    const variant = product?.selectedOrFirstAvailableVariant;
    if (!product || !variant?.availableForSale) return [];
    if (line.bool("travel") && !state.travel) return [];
    const quantity = state.overrides[product.handle] ?? line.number(`qty_${state.household}`) ?? 0;
    if (quantity <= 0) return [];
    return [
      {
        handle: product.handle,
        title: product.title,
        size: sizeOf(variant.selectedOptions),
        image: product.featuredImage?.url ?? null,
        variantId: variant.id,
        price: variant.price,
        quantity,
      },
    ];
  });
}

/** Search params for a finder URL. */
export function routineSearch(state: Pick<RoutineState, "household" | "routine" | "travel">, step: number, overrides?: Record<string, number>) {
  const params = new URLSearchParams();
  if (step > 1) params.set("step", String(step));
  params.set("household", state.household);
  params.set("scent", state.routine);
  params.set("travel", state.travel ? "1" : "0");
  for (const [handle, qty] of Object.entries(overrides ?? {})) params.set(`${QTY_PREFIX}${handle}`, String(qty));
  return `?${params.toString()}`;
}
