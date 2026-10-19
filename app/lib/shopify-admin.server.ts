// Server-only Shopify Admin API access for the newsletter and contact forms.
//
// Needs a custom app in Shopify admin (Settings › Apps › Develop apps) with the
// `read_customers` and `write_customers` Admin API scopes. Its Admin API access token goes
// in SHOPIFY_ADMIN_API_TOKEN (.env locally, the storefront's environment on Oxygen).
// The `.server` suffix keeps this module, and the token, out of the browser bundle.
//
// Operations validated against the Admin GraphQL schema, version 2026-10.
import type { Env } from "~/lib/env";

const ADMIN_API_VERSION = "2026-10";
const TIMEOUT_MS = 8000;
const NOTE_LIMIT = 5000;

export class AdminNotConfiguredError extends Error {
  constructor() {
    super("SHOPIFY_ADMIN_API_TOKEN is not set");
  }
}

export function isAdminConfigured(env: Env) {
  return Boolean(env.SHOPIFY_ADMIN_API_TOKEN && env.PUBLIC_STORE_DOMAIN?.endsWith(".myshopify.com"));
}

type UserError = { field?: string[] | null; message: string };

async function adminGraphql<T>(env: Env, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!isAdminConfigured(env)) throw new AdminNotConfiguredError();
  const response = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-access-token": env.SHOPIFY_ADMIN_API_TOKEN!,
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
