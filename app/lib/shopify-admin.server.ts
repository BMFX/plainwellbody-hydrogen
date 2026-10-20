// Server-only Shopify Admin API access for the newsletter and contact forms.
//
// Uses a Dev Dashboard app with read_customers/write_customers access. Set
// SHOPIFY_ADMIN_CLIENT_ID and SHOPIFY_ADMIN_CLIENT_SECRET in .env and Coolify;
// tokens are renewed automatically.
// The `.server` suffix keeps this module, and the token, out of the browser bundle.
//
// Operations validated against the Admin GraphQL schema, version 2026-10.
import type { Env } from "~/lib/env";

const ADMIN_API_VERSION = "2026-10";
const TIMEOUT_MS = 8000;
const NOTE_LIMIT = 5000;

export class AdminNotConfiguredError extends Error {
  constructor() {
    super("Shopify Admin API credentials are not set");
  }
}

export function isAdminConfigured(env: Env) {
  return Boolean(
    env.SHOPIFY_ADMIN_CLIENT_ID &&
      env.SHOPIFY_ADMIN_CLIENT_SECRET &&
      env.PUBLIC_STORE_DOMAIN?.endsWith(".myshopify.com"),
  );
}

// Each server isolate caches its own short-lived token and renews before expiry.
let adminTokenCache: { key: string; token: string; expiresAt: number } | null = null;
let pendingAdminToken: { key: string; promise: Promise<string> } | null = null;

async function getAdminAccessToken(env: Env): Promise<string> {
  if (!isAdminConfigured(env)) throw new AdminNotConfiguredError();
  const key = JSON.stringify([env.PUBLIC_STORE_DOMAIN, env.SHOPIFY_ADMIN_CLIENT_ID, env.SHOPIFY_ADMIN_CLIENT_SECRET]);
  if (adminTokenCache?.key === key && Date.now() < adminTokenCache.expiresAt - 60_000) return adminTokenCache.token;
  if (pendingAdminToken?.key === key) return pendingAdminToken.promise;
  const promise = (async () => {
    const response = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.SHOPIFY_ADMIN_CLIENT_ID!,
        client_secret: env.SHOPIFY_ADMIN_CLIENT_SECRET!,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Admin token request failed: ${response.status}`);
    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token || !data.expires_in || data.expires_in <= 0) throw new Error("Invalid Admin token response");
    adminTokenCache = { key, token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  })();
  pendingAdminToken = { key, promise };
  try {
    return await promise;
  } finally {
    if (pendingAdminToken?.promise === promise) pendingAdminToken = null;
  }
}

type UserError = { field?: string[] | null; message: string };

async function adminGraphql<T>(env: Env, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!isAdminConfigured(env)) throw new AdminNotConfiguredError();
  const response = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-access-token": await getAdminAccessToken(env),
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Admin API responded ${response.status}`);
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(`Admin API: ${body.errors.map((e) => e.message).join("; ")}`);
  if (!body.data) throw new Error("Admin API returned no data");
  return body.data;
}

function assertNoUserErrors(operation: string, errors: UserError[] | undefined) {
  if (errors?.length) throw new Error(`${operation}: ${errors.map((e) => e.message).join("; ")}`);
}

const CUSTOMER_BY_EMAIL = `
  query PlainwellCustomerByEmail($identifier: CustomerIdentifierInput!) {
    customer: customerByIdentifier(identifier: $identifier) {
      id
      note
      defaultEmailAddress {
        marketingState
      }
    }
  }
`;

const CUSTOMER_CREATE = `
  mutation PlainwellCustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const EMAIL_CONSENT_UPDATE = `
  mutation PlainwellEmailConsent($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CUSTOMER_NOTE_UPDATE = `
  mutation PlainwellCustomerNote($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// tagsAdd keeps a customer's existing tags; customerUpdate's `tags` would replace them.
const TAGS_ADD = `
  mutation PlainwellTagsAdd($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors {
        field
        message
      }
    }
  }
`;

const SHOP_CONTACT = `
  query PlainwellShopContact {
    shop {
      contactEmail
    }
  }
`;

type ExistingCustomer = { id: string; note: string | null; defaultEmailAddress: { marketingState: string } | null };

async function findCustomer(env: Env, email: string) {
  const data = await adminGraphql<{ customer: ExistingCustomer | null }>(env, CUSTOMER_BY_EMAIL, {
    identifier: { emailAddress: email },
  });
  return data.customer;
}

async function addTags(env: Env, id: string, tags: string[]) {
  const data = await adminGraphql<{ tagsAdd: { userErrors: UserError[] } }>(env, TAGS_ADD, { id, tags });
  assertNoUserErrors("tagsAdd", data.tagsAdd.userErrors);
}

/** Subscribes an email to marketing: a new customer, or consent added to an existing one. */
export async function subscribeToNewsletter(env: Env, email: string) {
  const consent = {
    marketingState: "SUBSCRIBED",
    marketingOptInLevel: "SINGLE_OPT_IN",
    consentUpdatedAt: new Date().toISOString(),
  };
  const existing = await findCustomer(env, email);
  if (!existing) {
    const data = await adminGraphql<{ customerCreate: { userErrors: UserError[] } }>(env, CUSTOMER_CREATE, {
      input: { email, emailMarketingConsent: consent, tags: ["newsletter"] },
    });
    assertNoUserErrors("customerCreate", data.customerCreate.userErrors);
    return;
  }
  if (existing.defaultEmailAddress?.marketingState !== "SUBSCRIBED") {
    const data = await adminGraphql<{ customerEmailMarketingConsentUpdate: { userErrors: UserError[] } }>(
      env,
      EMAIL_CONSENT_UPDATE,
      { input: { customerId: existing.id, emailMarketingConsent: consent } },
    );
    assertNoUserErrors("customerEmailMarketingConsentUpdate", data.customerEmailMarketingConsentUpdate.userErrors);
  }
  await addTags(env, existing.id, ["newsletter"]);
}

/**
 * Records a contact message in Shopify: on a new customer, or added to the top of an
 * existing customer's note. Tagged `contact-form` so the team can filter for it (and a
 * Shopify Flow "Customer tags added" workflow can email the team).
 */
export async function recordContactMessage(env: Env, input: { name: string; email: string; message: string }) {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const entry = `[Contact form ${stamp} UTC] ${input.name}: ${input.message}`;
  const existing = await findCustomer(env, input.email);
  if (!existing) {
    const [firstName, ...rest] = input.name.split(/\s+/);
    const data = await adminGraphql<{ customerCreate: { userErrors: UserError[] } }>(env, CUSTOMER_CREATE, {
      input: {
        email: input.email,
        firstName,
        lastName: rest.join(" ") || undefined,
        note: entry.slice(0, NOTE_LIMIT),
        tags: ["contact-form"],
      },
    });
    assertNoUserErrors("customerCreate", data.customerCreate.userErrors);
    return;
  }
  const note = [entry, existing.note].filter(Boolean).join("\n\n").slice(0, NOTE_LIMIT);
  const data = await adminGraphql<{ customerUpdate: { userErrors: UserError[] } }>(env, CUSTOMER_NOTE_UPDATE, {
    input: { id: existing.id, note },
  });
  assertNoUserErrors("customerUpdate", data.customerUpdate.userErrors);
  await addTags(env, existing.id, ["contact-form"]);
}

let contactEmailCache: { value: string | null; expires: number } | null = null;

/** The store's customer email (Settings › Store details), cached for ten minutes per isolate. */
export async function getStoreContactEmail(env: Env): Promise<string | null> {
  if (!isAdminConfigured(env)) return null;
  if (contactEmailCache && contactEmailCache.expires > Date.now()) return contactEmailCache.value;
  try {
    const data = await adminGraphql<{ shop: { contactEmail: string | null } }>(env, SHOP_CONTACT);
    contactEmailCache = { value: data.shop.contactEmail || null, expires: Date.now() + 10 * 60 * 1000 };
  } catch (error) {
    console.error(`Store contact email unavailable: ${(error as Error).message}`);
    contactEmailCache = { value: null, expires: Date.now() + 60 * 1000 };
  }
  return contactEmailCache.value;
}
