import type { RoutineFinderData } from "~/components/RoutineFinder";
import { Entry, hydrateProducts, normalizeLinks, SECTION_FRAGMENTS, storeHosts, untypedQuery } from "~/lib/content";
import { parseRoutine, routineLines } from "~/lib/routine";
import { shippingCharge } from "~/lib/shipping";
import type { RequestStorefrontClient } from "~/lib/storefront";

// Shopify pages built from sections (page metafield plainwell.sections). The home page is
// the page chosen in Site settings › Home page.

const PAGE_FIELDS = `
  fragment PwPage on Page {
    id
    handle
    title
    body
    seo {
      title
      description
    }
    sections: metafield(namespace: "plainwell", key: "sections") {
      references(first: 30) {
        nodes {
          __typename
          ... on Metaobject {
            ...PwSection
          }
        }
      }
    }
  }
`;

const SHIPPING_FIELDS = `
  fragment PwShippingSettings on Metaobject {
    threshold: field(key: "free_shipping_threshold") {
      value
    }
    rate: field(key: "standard_shipping_rate") {
      value
    }
    homePage: field(key: "home_page") {
      reference {
        ... on Page {
          handle
        }
      }
    }
  }
`;

export const PAGE_QUERY: string = `
  query PlainwellPage($handle: String!) {
    shop {
      primaryDomain {
        host
      }
    }
    page(handle: $handle) {
      ...PwPage
    }
    settings: metaobject(handle: { type: "pw_settings", handle: "site" }) {
      ...PwShippingSettings
    }
  }
  ${PAGE_FIELDS}
  ${SHIPPING_FIELDS}
  ${SECTION_FRAGMENTS}
`;

export const HOME_PAGE_QUERY: string = `
  query PlainwellHomePage {
    shop {
      primaryDomain {
        host
      }
    }
    settings: metaobject(handle: { type: "pw_settings", handle: "site" }) {
      ...PwShippingSettings
      home: field(key: "home_page") {
        reference {
          ... on Page {
            ...PwPage
          }
        }
      }
    }
  }
  ${PAGE_FIELDS}
  ${SHIPPING_FIELDS}
  ${SECTION_FRAGMENTS}
`;

type Client = Pick<RequestStorefrontClient, "graphql">;
type RawPage = {
  id: string;
  handle: string;
  title: string;
  body: string;
  seo?: { title?: string | null; description?: string | null } | null;
  sections?: { references?: { nodes: unknown[] } | null } | null;
};

export type LoadedPage = {
  page: { id: string; handle: string; title: string; body: string; seoTitle: string; seoDescription: string };
  sections: unknown[];
  homeHandle: string | null;
  shipping: { freeShippingThreshold: number | null; standardShippingRate: number | null };
};

type Settings = { threshold?: { value?: string | null } | null; rate?: { value?: string | null } | null; homePage?: { reference?: { handle?: string } | null } | null } | null;

async function toLoaded(client: Client, raw: RawPage, settings: Settings, hosts: Set<string>): Promise<LoadedPage> {
  const num = (v?: string | null) => (v == null || v === "" ? null : Number(v));
  return {
    page: {
      id: raw.id,
      handle: raw.handle,
      title: raw.title,
      body: raw.body,
      seoTitle: raw.seo?.title ?? "",
      seoDescription: raw.seo?.description ?? "",
    },
    sections: await hydrateProducts(client, normalizeLinks(raw.sections?.references?.nodes ?? [], hosts)),
    homeHandle: settings?.homePage?.reference?.handle ?? null,
    shipping: { freeShippingThreshold: num(settings?.threshold?.value), standardShippingRate: num(settings?.rate?.value) },
  };
}

type PageQueryData = { shop: { primaryDomain: { host: string } }; page: RawPage | null; settings: Settings };
type HomeQueryData = { shop: { primaryDomain: { host: string } }; settings: (Settings & { home?: { reference?: RawPage | null } | null }) | null };

export async function loadPage(client: Client, handle: string, extraHosts: (string | null | undefined)[]): Promise<LoadedPage | null> {
  const data = await untypedQuery<PageQueryData>(client, PAGE_QUERY, { handle });
  if (!data.page) return null;
  return toLoaded(client, data.page, data.settings, storeHosts(data.shop.primaryDomain.host, ...extraHosts));
}

export async function loadHomePage(client: Client, extraHosts: (string | null | undefined)[]): Promise<LoadedPage | null> {
  const data = await untypedQuery<HomeQueryData>(client, HOME_PAGE_QUERY);
  const raw = data.settings?.home?.reference;
  if (!raw?.id) return null;
  return toLoaded(client, raw, data.settings, storeHosts(data.shop.primaryDomain.host, ...extraHosts));
}

export function sectionsOfType(sections: unknown[], type: string) {
  return sections.map((raw) => Entry.from(raw)).filter((e): e is Entry => e?.type === type);
}

/** The routine finder's state and totals for this URL, from the finder section. */
export function routineFinderData(finder: Entry, params: URLSearchParams | FormData, shipping: LoadedPage["shipping"]): RoutineFinderData {
  const routines = finder.entries("routines");
  const state = parseRoutine(params, routines.map((r) => r.handle));
  const lines = routineLines(state, routines);
  const currencyCode = lines[0]?.price.currencyCode ?? "USD";
  const cents = lines.reduce((sum, line) => sum + Math.round(Number(line.price.amount) * 100) * line.quantity, 0);
  const subtotal = { amount: (cents / 100).toFixed(2), currencyCode };
  const charge = shippingCharge(shipping, subtotal);
  return {
    state,
    routines: routines.map((routine) => {
      const scent = routine.entry("scent");
      const firstProduct = routine.entries("lines")[0]?.product("product");
      return {
        handle: routine.handle,
        name: scent?.text("name") || routine.text("name"),
        note: scent?.text("note") ?? "",
        image: firstProduct?.featuredImage?.url ?? null,
      };
    }),
    lines,
    subtotal,
    shippingCharge: charge,
    estimate: charge ? { amount: ((cents + Math.round(Number(charge.amount) * 100)) / 100).toFixed(2), currencyCode } : null,
  };
}
