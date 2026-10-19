import type { CardItem } from "~/components/ProductCard";

// The routine finder's rules, carried over from the live theme (theme/assets/plainwell.js):
// the same four essentials per scent, with quantities set by household size.
export const ROUTINE_SCENTS = ["citrus", "cedar", "unscented"] as const;
export type RoutineScent = (typeof ROUTINE_SCENTS)[number];

export const HOUSEHOLDS = [
  { value: "1", num: "1", label: "Just me" },
  { value: "2", num: "2", label: "Two of us" },
  { value: "3", num: "3", label: "Three" },
  { value: "4", num: "4+", label: "Four or more" },
] as const;
export type Household = (typeof HOUSEHOLDS)[number]["value"];

const ROUTINES: Record<RoutineScent, string[]> = {
  citrus: ["citrus-body-wash", "fresh-deodorant", "cedar-shave-gel", "travel-body-wash"],
  cedar: ["cedar-body-wash", "cedar-deodorant", "cedar-shave-gel", "cedar-travel-body-wash"],
  unscented: ["unscented-body-wash", "unscented-deodorant", "unscented-shave-gel", "unscented-travel-body-wash"],
};

export const ROUTINE_TITLE: Record<Household, string> = {
  "1": "Your routine",
  "2": "For the two of you",
  "3": "For the three of you",
  "4": "For the whole household",
};

export type RoutineState = {
  step: 1 | 2 | 3;
  household: Household;
  scent: RoutineScent;
  travel: boolean;
  overrides: Record<string, number>;
};

export const QTY_PREFIX = "qty.";

/** Reads the finder's state from URL search params or a submitted form. */
export function parseRoutine(params: URLSearchParams | FormData): RoutineState {
  const get = (key: string) => {
    const all = params.getAll(key);
    return all.length ? String(all[all.length - 1]) : null;
  };
  const household = (HOUSEHOLDS.find((h) => h.value === get("household"))?.value ?? "2") as Household;
  const scent = (ROUTINE_SCENTS.find((s) => s === get("scent")) ?? "citrus") as RoutineScent;
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
  return { step, household, scent, travel, overrides };
}

export function routineLines(state: RoutineState, catalog: CardItem[]) {
  const n = Number(state.household);
  const wash = n >= 3 ? 2 : 1;
  const deodorant = n === 4 ? 2 : 1;
  const mini = n === 4 ? 2 : 1;
  // Fresh Deodorant is a three-pack; the other scents sell single sticks.
  const base = [wash, deodorant * (state.scent === "citrus" ? 1 : 3), 1, state.travel ? mini : 0];

  return ROUTINES[state.scent].flatMap((handle, i) => {
    const item = catalog.find((c) => c.handle === handle);
    const variant = item?.live?.selectedOrFirstAvailableVariant;
    if (!item || !variant) return [];
    const quantity = state.overrides[handle] ?? base[i];
    if ((i === 3 && !state.travel) || quantity <= 0) return [];
    return [{ item, variant, quantity }];
  });
}

/** Search params for a finder URL, dropping defaults. */
export function routineSearch(state: Partial<RoutineState> & Pick<RoutineState, "household" | "scent" | "travel">, step: number, overrides?: Record<string, number>) {
  const params = new URLSearchParams();
  if (step > 1) params.set("step", String(step));
  params.set("household", state.household);
  params.set("scent", state.scent);
  params.set("travel", state.travel ? "1" : "0");
  for (const [handle, qty] of Object.entries(overrides ?? {})) params.set(`${QTY_PREFIX}${handle}`, String(qty));
  return `?${params.toString()}`;
}
