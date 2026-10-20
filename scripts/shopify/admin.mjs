// Admin API client for the setup scripts (Node, not the storefront). Reads the same
// credentials as the app from hydrogen/.env: a Dev Dashboard app's client ID and secret,
// exchanged for a short-lived token.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ADMIN_API_VERSION = "2026-10";
const here = path.dirname(fileURLToPath(import.meta.url));
export const HYDROGEN = path.resolve(here, "../..");
export const REPO = path.resolve(HYDROGEN, "..");

async function readEnv() {
  const text = await readFile(path.join(HYDROGEN, ".env"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return { ...env, ...process.env };
}

let session;
async function getSession() {
  if (session) return session;
  const env = await readEnv();
  const domain = env.PUBLIC_STORE_DOMAIN;
  if (!domain?.endsWith(".myshopify.com")) throw new Error("PUBLIC_STORE_DOMAIN must be the store's myshopify.com domain");
  let token = env.SHOPIFY_ADMIN_API_TOKEN;
  if (env.SHOPIFY_ADMIN_CLIENT_ID && env.SHOPIFY_ADMIN_CLIENT_SECRET) {
    const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.SHOPIFY_ADMIN_CLIENT_ID, client_secret: env.SHOPIFY_ADMIN_CLIENT_SECRET }),
    });
    if (!res.ok) throw new Error(`Admin token request failed: ${res.status}`);
    const body = await res.json();
    token = body.access_token;
    session = { domain, token, scopes: String(body.scope ?? "").split(",") };
  } else {
    session = { domain, token, scopes: [] };
  }
  if (!token) throw new Error("No Admin API credentials in hydrogen/.env");
  return session;
}

export async function scopes() {
  return (await getSession()).scopes;
}

export async function admin(query, variables = {}) {
  const { domain, token } = await getSession();
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-shopify-access-token": token },
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.json().catch(() => ({}));
    const throttled = res.status === 429 || body.errors?.some((e) => e.extensions?.code === "THROTTLED");
    if (throttled && attempt < 6) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok || body.errors?.length) throw new Error(`Admin API: ${res.status} ${JSON.stringify(body.errors ?? body).slice(0, 600)}`);
    return body.data;
  }
}

/** Throws when a mutation payload carries userErrors. */
export function check(label, payload) {
  const errors = payload?.userErrors ?? [];
  if (errors.length) throw new Error(`${label}: ${errors.map((e) => `${(e.field ?? []).join(".")} ${e.message}`).join("; ")}`);
  return payload;
}
