import { Cache, gql } from "@shopify/hydrogen";

import { PRODUCT_CARD_FRAGMENT, type ProductCardData } from "~/components/ProductCard";
import type { RequestStorefrontClient } from "~/lib/storefront";

// Everything the site says and shows comes from Shopify. This module reads the shared
// pieces (interface text, site settings, menus) and a page's sections, and turns
// metaobject fields into plain values the components render. Nothing here supplies
// content of its own: a missing value renders as nothing.

// Section queries are plain strings: gql.tada's inferred types for four levels of nested
// metaobject unions exhaust the type checker, and the data is read through Entry anyway.
// They are validated against the Storefront schema by scripts/shopify/validate-queries.mjs.
const IMAGE_FIELDS = `
  fragment PwImage on MediaImage {
    image {
      url
      altText
      width
      height
    }
  }
`;

// Sections nest up to four levels (section > item > item field > product), so the
// metaobject fragments are spelled out per level. Products inside sections are fetched by
// ID only; hydrateProducts() then fills in their card data with one batched query.
const LEAF_FIELDS = `
  fragment PwLeaf on Metaobject {
    id
    handle
    type
    fields {
      key
      type
      value
      reference {
        __typename
        ...PwImage
        ... on Product {
          id
        }
      }
    }
  }
`;

const MID_FIELDS = `
  fragment PwMid on Metaobject {
    id
    handle
    type
    fields {
      key
      type
      value
      reference {
        __typename
        ...PwImage
        ... on Product {
          id
        }
        ... on Metaobject {
          ...PwLeaf
        }
      }
      references(first: 30) {
        nodes {
          __typename
          ... on Metaobject {
            ...PwLeaf
          }
        }
      }
    }
  }
`;

const SECTION_FIELDS = `
  fragment PwSection on Metaobject {
    id
    handle
    type
    fields {
      key
      type
      value
      reference {
        __typename
        ...PwImage
        ... on Product {
          id
        }
        ... on Collection {
          handle
          title
        }
        ... on Page {
          handle
        }
        ... on Metaobject {
          ...PwMid
        }
      }
      references(first: 30) {
        nodes {
          __typename
          ...PwImage
          ... on Product {
            id
          }
          ... on Metaobject {
            ...PwMid
          }
        }
      }
    }
  }
`;

/** Every fragment a query using ...PwSection needs, appended to that query's text. */
export const SECTION_FRAGMENTS: string = [IMAGE_FIELDS, LEAF_FIELDS, MID_FIELDS, SECTION_FIELDS].join("\n");

/** Runs an untyped (plain string) Storefront query and returns its data. */
export async function untypedQuery<T>(client: Pick<RequestStorefrontClient, "graphql">, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const run = client.graphql as unknown as (q: string, o: { variables: Record<string, unknown>; cache: ReturnType<typeof Cache.short> }) => Promise<{ data?: T; errors?: { message: string }[] }>;
  const { data, errors } = await run(query, { variables, cache: Cache.short() });
  if (errors?.length) throw new Error(`Storefront query failed: ${errors.map((e) => e.message).join("; ")}`);
  if (!data) throw new Error("Storefront query returned no data");
  return data;
}

export type Image = { url: string; altText: string | null; width: number | null; height: number | null };

type RawField = {
  key: string;
  type: string;
  value?: string | null;
  reference?: unknown;
  references?: { nodes: unknown[] } | null;
};
type RawMetaobject = { id: string; handle: string; type: string; fields: RawField[] };

/** A metaobject with typed accessors for its fields. */
export class Entry {
  readonly id: string;
  readonly handle: string;
  readonly type: string;
  private readonly fields: Map<string, RawField>;

  constructor(raw: RawMetaobject) {
    this.id = raw.id;
    this.handle = raw.handle;
    this.type = raw.type;
    this.fields = new Map(raw.fields.map((field) => [field.key, field]));
  }

  static from(raw: unknown): Entry | null {
    const node = raw as Partial<RawMetaobject> & { __typename?: string };
    if (!node || !Array.isArray(node.fields) || !node.type) return null;
    return new Entry(node as RawMetaobject);
  }

  text(key: string): string {
    return this.fields.get(key)?.value?.trim() ?? "";
  }

  number(key: string): number | null {
    const value = this.fields.get(key)?.value;
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  bool(key: string): boolean {
    return this.fields.get(key)?.value === "true";
  }

  link(key: string): { text: string; url: string } | null {
    const value = this.fields.get(key)?.value;
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as { text?: string; url?: string };
      return parsed.url ? { text: parsed.text ?? "", url: parsed.url } : null;
    } catch {
      return null;
    }
  }

  url(key: string): string {
    return this.text(key);
  }

  /** Rich text as Shopify's JSON tree, or null when empty. */
  rich(key: string): RichNode | null {
    const value = this.fields.get(key)?.value;
    if (!value) return null;
    try {
      const tree = JSON.parse(value) as RichNode;
      return richHasText(tree) ? tree : null;
    } catch {
      return null;
    }
  }

  image(key: string): Image | null {
    const ref = this.fields.get(key)?.reference as { image?: Image } | null | undefined;
    return ref?.image ?? null;
  }

  product(key: string): ProductCardData | null {
    const ref = this.fields.get(key)?.reference as (ProductCardData & { __typename?: string }) | null | undefined;
    return ref && ref.__typename === "Product" ? ref : null;
  }

  products(key: string): ProductCardData[] {
    const nodes = this.fields.get(key)?.references?.nodes ?? [];
    return nodes.filter((n): n is ProductCardData => (n as { __typename?: string }).__typename === "Product");
  }

  pageHandle(key: string): string | null {
    const ref = this.fields.get(key)?.reference as { __typename?: string; handle?: string } | null | undefined;
    return ref?.__typename === "Page" ? (ref.handle ?? null) : null;
  }

  collectionHandle(key: string): string | null {
    const ref = this.fields.get(key)?.reference as { __typename?: string; handle?: string } | null | undefined;
    return ref?.__typename === "Collection" ? (ref.handle ?? null) : null;
  }

  entry(key: string): Entry | null {
    return Entry.from(this.fields.get(key)?.reference);
  }

  entries(key: string): Entry[] {
    const nodes = this.fields.get(key)?.references?.nodes ?? [];
    return nodes.map((n) => Entry.from(n)).filter((e): e is Entry => e !== null);
  }
}

export type RichNode = {
  type: string;
  value?: string;
  url?: string;
  title?: string;
  level?: number;
  listType?: "ordered" | "unordered";
  bold?: boolean;
  italic?: boolean;
  children?: RichNode[];
};

function richHasText(node: RichNode): boolean {
  if (node.type === "text") return Boolean(node.value?.trim());
  return (node.children ?? []).some(richHasText);
}

/**
 * The store's own hostnames, from Shopify: its primary domain (on a headless store, the
 * checkout host), that domain's parent, the myshopify.com domain and the requested host.
 * Links in menus and content that point at any of them become site-relative paths.
 */
export function storeHosts(primaryHost: string | null | undefined, ...more: (string | null | undefined)[]) {
  const hosts = new Set<string>();
  for (const host of [primaryHost, ...more]) {
    if (!host) continue;
    hosts.add(host);
    const parts = host.split(".");
    if (parts.length > 2) hosts.add(parts.slice(1).join("."));
  }
  return hosts;
}

export function relativeUrl(url: string, hosts: Set<string>): string {
  if (!/^https?:\/\//.test(url)) return url;
  try {
    const parsed = new URL(url);
    return hosts.has(parsed.hostname) ? `${parsed.pathname}${parsed.search}${parsed.hash}` : url;
  } catch {
    return url;
  }
}

/** Rewrites every link and url field in raw metaobject data to site-relative paths. */
export function normalizeLinks<T>(raw: T, hosts: Set<string>): T {
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const record = node as Record<string, unknown>;
    const value = record.value;
    if (typeof record.type === "string" && typeof value === "string" && value) {
      if (record.type === "url") record.value = relativeUrl(value, hosts);
      if (record.type === "link") {
        try {
          const link = JSON.parse(value) as { text?: string; url?: string };
          if (link.url) record.value = JSON.stringify({ ...link, url: relativeUrl(link.url, hosts) });
        } catch {
          // leave malformed values alone; the component ignores them
        }
      }
      if (record.type === "rich_text_field") {
        try {
          const tree = JSON.parse(value) as RichNode;
          const fix = (n: RichNode) => {
            if (n.url) n.url = relativeUrl(n.url, hosts);
            n.children?.forEach(fix);
          };
          fix(tree);
          record.value = JSON.stringify(tree);
        } catch {
          // as above
        }
      }
    }
    Object.values(record).forEach(walk);
  };
  walk(raw);
  return raw;
}

// ─── Product cards inside sections ───────────────────────────────────────────────

export const PRODUCT_NODES_QUERY = gql(
  `
    query PlainwellProductNodes($ids: [ID!]!) {
      nodes(ids: $ids) {
        __typename
        ... on Product {
          ...ProductCard
        }
      }
    }
  `,
  [PRODUCT_CARD_FRAGMENT],
);

/** Replaces every product reference ({__typename: "Product", id}) in raw section data with card data. */
export async function hydrateProducts<T>(client: Pick<RequestStorefrontClient, "graphql">, raw: T): Promise<T> {
  const refs: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const record = node as Record<string, unknown>;
    if (record.__typename === "Product" && typeof record.id === "string" && !("handle" in record)) refs.push(record);
    Object.values(record).forEach(walk);
  };
  walk(raw);
  if (!refs.length) return raw;
  const ids = [...new Set(refs.map((r) => r.id as string))];
  const byId = new Map<string, unknown>();
  for (let i = 0; i < ids.length; i += 250) {
    const { data, errors } = await client.graphql(PRODUCT_NODES_QUERY, { variables: { ids: ids.slice(i, i + 250) }, cache: Cache.short() });
    if (errors?.length) throw new Error(`Product nodes query failed: ${errors.map((e) => e.message).join("; ")}`);
    for (const node of data?.nodes ?? []) if (node && "id" in node) byId.set(node.id as string, node);
  }
  for (const ref of refs) {
    const full = byId.get(ref.id as string);
    if (full) Object.assign(ref, full);
    // A product unpublished from the storefront resolves to null: mark it so it is skipped.
    else ref.__typename = "Unavailable";
  }
  return raw;
}

// ─── Shared content: interface text, settings, menus ───────────────────────────────

const MENU_FIELDS = `
  fragment PwMenu on Menu {
    handle
    items {
      title
      url
      items {
        title
        url
      }
    }
  }
`;

export const SITE_CONTENT_QUERY: string = `
  query PlainwellSiteContent($textAfter: String) {
    shop {
      primaryDomain {
        host
      }
    }
    text: metaobjects(type: "pw_text", first: 250, after: $textAfter) {
      nodes {
        key: field(key: "key") {
          value
        }
        value: field(key: "value") {
          value
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
    settings: metaobject(handle: { type: "pw_settings", handle: "site" }) {
      ...PwSection
    }
    mainMenu: menu(handle: "main-menu") {
      ...PwMenu
    }
    footerMenu: menu(handle: "footer") {
      ...PwMenu
    }
    legalMenu: menu(handle: "footer-legal") {
      ...PwMenu
    }
    categoryMenu: menu(handle: "shop-categories") {
      ...PwMenu
    }
    mobileMenu: menu(handle: "mobile-secondary") {
      ...PwMenu
    }
    suggestionMenu: menu(handle: "search-suggestions") {
      ...PwMenu
    }
  }
  ${MENU_FIELDS}
  ${SECTION_FRAGMENTS}
`;

type SiteContentData = {
  shop: { primaryDomain: { host: string } };
  text: { nodes: { key?: { value?: string | null } | null; value?: { value?: string | null } | null }[]; pageInfo: { hasNextPage: boolean; endCursor?: string | null } };
  settings: unknown;
  mainMenu: RawMenu;
  footerMenu: RawMenu;
  legalMenu: RawMenu;
  categoryMenu: RawMenu;
  mobileMenu: RawMenu;
  suggestionMenu: RawMenu;
};

export type MenuItem = { title: string; url: string; items: MenuItem[] };

type RawMenu = { items: { title: string; url?: string | null; items?: { title: string; url?: string | null }[] }[] } | null | undefined;

function menu(raw: RawMenu, hosts: Set<string>): MenuItem[] {
  return (raw?.items ?? []).map((item) => ({
    title: item.title,
    url: item.url ? relativeUrl(item.url, hosts) : "",
    items: (item.items ?? []).map((child) => ({ title: child.title, url: child.url ? relativeUrl(child.url, hosts) : "", items: [] })),
  }));
}

export type SiteSettings = {
  logo: Image | null;
  logoOnDark: Image | null;
  icon: Image | null;
  shareImage: Image | null;
  notFoundImage: Image | null;
  freeShippingThreshold: number | null;
  standardShippingRate: number | null;
  shopAllHandle: string | null;
  homePageHandle: string | null;
  oftenAdded: ProductCardData[];
  announcement: string;
};

export type SiteContent = {
  /** Hostnames that are this store (see storeHosts). */
  hosts: string[];
  text: Record<string, string>;
  settings: SiteSettings;
  menus: {
    main: MenuItem[];
    footer: MenuItem[];
    legal: MenuItem[];
    categories: MenuItem[];
    mobile: MenuItem[];
    suggestions: MenuItem[];
  };
};

export async function loadSiteContent(
  storefrontClient: Pick<RequestStorefrontClient, "graphql">,
  extraHosts: (string | null | undefined)[] = [],
): Promise<SiteContent> {
  const text: Record<string, string> = {};
  let after: string | null = null;
  let first: SiteContentData | null = null;
  const fetchPage = (cursor: string | null) => untypedQuery<SiteContentData>(storefrontClient, SITE_CONTENT_QUERY, { textAfter: cursor });
  do {
    const page = await fetchPage(after);
    first ??= page;
    for (const node of page.text.nodes) if (node.key?.value) text[node.key.value] = node.value?.value ?? "";
    after = page.text.pageInfo.hasNextPage ? (page.text.pageInfo.endCursor ?? null) : null;
  } while (after);

  const hosts = storeHosts(first!.shop.primaryDomain.host, ...extraHosts);
  const settings = Entry.from(await hydrateProducts(storefrontClient, normalizeLinks(first!.settings, hosts)));
  return {
    hosts: [...hosts],
    text,
    settings: {
      logo: settings?.image("logo") ?? null,
      logoOnDark: settings?.image("logo_on_dark") ?? null,
      icon: settings?.image("icon") ?? null,
      shareImage: settings?.image("share_image") ?? null,
      notFoundImage: settings?.image("not_found_image") ?? null,
      freeShippingThreshold: settings?.number("free_shipping_threshold") ?? null,
      standardShippingRate: settings?.number("standard_shipping_rate") ?? null,
      shopAllHandle: settings?.collectionHandle("shop_all") ?? null,
      homePageHandle: settings?.pageHandle("home_page") ?? null,
      oftenAdded: settings?.products("often_added") ?? [],
      announcement: settings?.text("announcement") ?? "",
    },
    menus: {
      main: menu(first!.mainMenu, hosts),
      footer: menu(first!.footerMenu, hosts),
      legal: menu(first!.legalMenu, hosts),
      categories: menu(first!.categoryMenu, hosts),
      mobile: menu(first!.mobileMenu, hosts),
      suggestions: menu(first!.suggestionMenu, hosts),
    },
  };
}

/** Fills {placeholders} in a text value. A missing key renders as nothing. */
export function format(text: Record<string, string>, key: string, vars?: Record<string, string | number>) {
  const template = text[key];
  if (template == null) {
    if (import.meta.env.DEV) console.warn(`[content] Missing interface text "${key}" (Shopify › Content › Interface text)`);
    return "";
  }
  return vars ? template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : "")) : template;
}
