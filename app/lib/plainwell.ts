// Plainwell's catalogue model. Shopify holds the live products (one product per scent,
// tagged with its category and scent); this module derives the family, scent note,
// category and ritual photograph from that data, and lists the coming-soon products
// that are not in Shopify yet (lavender and the body wash refills).

export const PLAINWELL_COLLECTION = "plainwell";
export const FREE_SHIPPING_THRESHOLD = 50;

export type Scent = "citrus" | "cedar" | "unscented" | "lavender" | "fresh" | "oat" | "botanical";

export const SCENT_ORDER: Scent[] = ["citrus", "cedar", "unscented", "lavender", "fresh", "oat", "botanical"];

export const SCENT_LABEL: Record<Scent, string> = {
  citrus: "Citrus",
  cedar: "Cedar",
  unscented: "Unscented",
  lavender: "Lavender",
  fresh: "Fresh · 3 pack",
  oat: "Oat",
  botanical: "Everyday",
};

export const SCENT_NOTE: Record<Scent, string> = {
  citrus: "Bright, clean, morning",
  cedar: "Warm, woody, evening",
  unscented: "Nothing extra",
  lavender: "New scent family",
  fresh: "Fresh, the original three-pack",
  oat: "Oat",
  botanical: "Everyday",
};

/** The scent filters shown on collection pages. */
export const SCENT_FILTERS: { value: Scent; label: string }[] = [
  { value: "citrus", label: "Citrus" },
  { value: "cedar", label: "Cedar" },
  { value: "unscented", label: "Unscented" },
  { value: "lavender", label: "Lavender" },
];

export type CategoryKey = "body-care" | "hand-care" | "deodorant-shave" | "travel";

export type CollectionPage = {
  /** URL handle under /collections. */
  handle: string;
  eyebrow: string;
  title: string;
  intro: string;
  banner: { name: string; alt: string };
  category?: CategoryKey;
  scent?: Scent;
  family?: string;
};

const SHOP_ALL: CollectionPage = {
  handle: "all",
  eyebrow: "Shop",
  title: "Everyday essentials",
  intro:
    "Body, hands, deodorant and shave, and travel sizes, in citrus, cedar and unscented. Every item is sold on its own, in the quantity you choose. Lavender and body wash refills are coming soon.",
  banner: { name: "campaign-botanical-bathhouse", alt: "Cedar Body Wash on a wet stone ledge in green morning light" },
};

/** Collection pages built from the single `plainwell` Shopify collection. */
export const COLLECTION_PAGES: CollectionPage[] = [
  SHOP_ALL,
  { ...SHOP_ALL, handle: PLAINWELL_COLLECTION },
  {
    handle: "body",
    eyebrow: "Shop · Body",
    title: "Body",
    intro: "Body wash, lotion, bar soap and oil.",
    banner: { name: "campaign-cedar-ritual", alt: "Cedar Body Wash lathered on an arm over wet stone" },
    category: "body-care",
  },
  {
    handle: "hands",
    eyebrow: "Shop · Hands",
    title: "Hands",
    intro: "Hand wash and hand balm.",
    banner: { name: "campaign-citrus-ritual", alt: "Hands under a pump of Citrus Hand Wash beside halved oranges" },
    category: "hand-care",
  },
  {
    handle: "deodorant-shave",
    eyebrow: "Shop · Deodorant & shave",
    title: "Deodorant & shave",
    intro: "Single sticks in every scent, the original Fresh three-pack, and shave gels.",
    banner: { name: "campaign-fresh-ritual", alt: "Opening a stick of Fresh Deodorant beside a stone ledge" },
    category: "deodorant-shave",
  },
  {
    handle: "travel",
    eyebrow: "Shop · Travel",
    title: "Travel",
    intro: "Body wash and body lotion in 3 fl oz sizes.",
    banner: { name: "campaign-product-family", alt: "Citrus Body Wash, Fresh Deodorant, Cedar Shave Gel and Travel Body Wash on a stone shelf" },
    category: "travel",
  },
  {
    handle: "refills",
    eyebrow: "Coming soon",
    title: "Body wash refills",
    intro:
      "A 32 fl oz pouch that refills a 16 fl oz body wash bottle twice, in every scent. The size is a draft, and prices are still to come.",
    banner: { name: "campaign-citrus-refill-ritual", alt: "Pouring a Citrus Body Wash refill into its bottle" },
    family: "body-wash-refill",
  },
  {
    handle: "lavender",
    eyebrow: "Coming soon",
    title: "Lavender",
    intro:
      "A fourth scent family across the range, from body wash to travel sizes. Prices and availability are still to come.",
    banner: { name: "campaign-lavender-ritual", alt: "Lavender Body Lotion smoothed onto an arm beside sprigs of lavender" },
    scent: "lavender",
  },
];

export function findCollectionPage(handle: string) {
  return COLLECTION_PAGES.find((page) => page.handle === handle) ?? null;
}

export const CATEGORY_TABS: { label: string; href: string; category?: CategoryKey; family?: string }[] = [
  { label: "All", href: "/collections/all" },
  { label: "Body", href: "/collections/body", category: "body-care" },
  { label: "Hands", href: "/collections/hands", category: "hand-care" },
  { label: "Deodorant & shave", href: "/collections/deodorant-shave", category: "deodorant-shave" },
  { label: "Travel", href: "/collections/travel", category: "travel" },
  { label: "Refills", href: "/collections/refills", family: "body-wash-refill" },
];

export const CATEGORY_LABEL: Record<CategoryKey, { label: string; href: string }> = {
  "body-care": { label: "Body", href: "/collections/body" },
  "hand-care": { label: "Hands", href: "/collections/hands" },
  "deodorant-shave": { label: "Deodorant & shave", href: "/collections/deodorant-shave" },
  travel: { label: "Travel", href: "/collections/travel" },
};

export const NAV_LINKS = [
  { label: "Shop all", href: "/collections/all" },
  { label: "Body", href: "/collections/body" },
  { label: "Hands", href: "/collections/hands" },
  { label: "Deodorant & shave", href: "/collections/deodorant-shave" },
  { label: "Travel", href: "/collections/travel" },
  { label: "Routine", href: "/pages/routine" },
];

export const FOOTER_COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "All essentials", href: "/collections/all" },
      { label: "Body", href: "/collections/body" },
      { label: "Hands", href: "/collections/hands" },
      { label: "Deodorant & shave", href: "/collections/deodorant-shave" },
      { label: "Travel", href: "/collections/travel" },
      { label: "Refills · coming soon", href: "/collections/refills" },
      { label: "Lavender · coming soon", href: "/collections/lavender" },
    ],
  },
  {
    title: "Plainwell",
    links: [
      { label: "Our story", href: "/pages/our-story" },
      { label: "Ingredients", href: "/pages/ingredients" },
      { label: "Journal", href: "/pages/journal" },
      { label: "Find your routine", href: "/pages/routine" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Contact", href: "/pages/contact" },
      { label: "FAQ", href: "/pages/faq" },
      { label: "Shipping & returns", href: "/pages/shipping-returns" },
      { label: "Account", href: "/account" },
    ],
  },
];

const FAMILY_TITLE: Record<string, string> = {
  "body-wash": "Body Wash",
  "body-lotion": "Body Lotion",
  "bar-soap": "Bar Soap",
  "body-oil": "Body Oil",
  "body-wash-refill": "Body Wash Refill",
  "hand-wash": "Hand Wash",
  "hand-balm": "Hand Balm",
  deodorant: "Deodorant",
  "shave-gel": "Shave Gel",
  "travel-body-wash": "Travel Body Wash",
  "travel-body-lotion": "Travel Body Lotion",
};

/** Range order within a scent: body, hands, deodorant and shave, travel. */
export const FAMILY_ORDER = Object.keys(FAMILY_TITLE);

export function familyTitle(family: string) {
  return FAMILY_TITLE[family] ?? family;
}

const SCENT_PREFIX = /^(citrus|cedar|unscented|lavender|fresh|oat|everyday)-/;

/** `cedar-body-wash` → `body-wash`; `travel-body-wash` (citrus) stays as is. */
export function familyOf(handle: string) {
  return handle.replace(SCENT_PREFIX, "");
}

export function scentOf(tags: readonly string[]): Scent | null {
  return SCENT_ORDER.find((scent) => tags.includes(scent)) ?? null;
}

export function categoryOf(tags: readonly string[], productType?: string | null): CategoryKey | null {
  const keys = Object.keys(CATEGORY_LABEL) as CategoryKey[];
  return keys.find((key) => productType === key || tags.includes(key)) ?? null;
}

/** The ritual photograph (hands using the product) for a product page or scent tile. */
export function ritualFor(scent: Scent | null, family: string): { name: string; alt: string } {
  if (family === "body-wash-refill" && scent === "citrus") {
    return { name: "campaign-citrus-refill-ritual", alt: "Pouring a Citrus Body Wash refill into its bottle" };
  }
  switch (scent) {
    case "citrus":
      return { name: "campaign-citrus-ritual", alt: "Hands under a pump of Citrus Hand Wash beside halved oranges" };
    case "cedar":
      return { name: "campaign-cedar-ritual", alt: "Cedar Body Wash lathered on an arm over wet stone" };
    case "unscented":
      return { name: "campaign-unscented-ritual", alt: "Unscented Hand Balm squeezed onto the back of a hand" };
    case "lavender":
      return { name: "campaign-lavender-ritual", alt: "Lavender Body Lotion smoothed onto an arm beside sprigs of lavender" };
    case "fresh":
      return { name: "campaign-fresh-ritual", alt: "Opening a stick of Fresh Deodorant beside a stone ledge" };
    case "oat":
      return { name: "campaign-oat-ritual", alt: "Hands lathering Oat Bar Soap over a stone basin" };
    default:
      return { name: "campaign-everyday-oil-ritual", alt: "Everyday Body Oil applied with a dropper to a forearm" };
  }
}

/** Collection order for "Featured": the hero products first, then the store order. */
export const FEATURED_FIRST = ["citrus-body-wash", "cedar-body-wash", "citrus-body-lotion", "fresh-deodorant"];

export type ConceptProduct = {
  handle: string;
  title: string;
  size: string;
  category: CategoryKey;
  scent: Scent;
  family: string;
  /** Refills only: how many times one pouch refills a 16 fl oz bottle. */
  bottleRefills?: number;
};

const LAVENDER: [string, string, CategoryKey][] = [
  ["body-wash", "16 fl oz", "body-care"],
  ["body-lotion", "12 fl oz", "body-care"],
  ["bar-soap", "4 oz", "body-care"],
  ["hand-wash", "12 fl oz", "hand-care"],
  ["hand-balm", "2 fl oz", "hand-care"],
  ["deodorant", "2.6 oz", "deodorant-shave"],
  ["shave-gel", "8 fl oz", "deodorant-shave"],
  ["travel-body-wash", "3 fl oz", "travel"],
  ["travel-body-lotion", "3 fl oz", "travel"],
];

/** Products announced but not on sale: no price, no add to bag, no Shopify record. */
export const CONCEPT_PRODUCTS: ConceptProduct[] = [
  ...(["citrus", "cedar", "unscented", "lavender"] as Scent[]).map((scent) => ({
    handle: `${scent}-body-wash-refill`,
    title: `${SCENT_LABEL[scent]} Body Wash Refill`,
    size: "32 fl oz",
    category: "body-care" as CategoryKey,
    scent,
    family: "body-wash-refill",
    bottleRefills: 2,
  })),
  ...LAVENDER.map(([family, size, category]) => ({
    handle: `lavender-${family}`,
    title: `Lavender ${familyTitle(family)}`,
    size,
    category,
    scent: "lavender" as Scent,
    family,
  })),
];

export function findConcept(handle: string) {
  return CONCEPT_PRODUCTS.find((product) => product.handle === handle) ?? null;
}
