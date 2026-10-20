// ─────────────────────────────────────────────────────────────────────────────
// Store configuration. The storefront reads one Shopify store, set by
// PUBLIC_STORE_DOMAIN and PRIVATE_STOREFRONT_API_TOKEN in the runtime environment
// (Coolify, or `.env` locally). PUBLIC_STOREFRONT_ID is optional; without it,
// Shopify analytics stay off.
// ─────────────────────────────────────────────────────────────────────────────

import type { ShopAnalytics, ShopifyScriptsShop } from "@shopify/hydrogen";

export const storefrontConfig = {
  i18n: { country: "US", language: "EN" },
} as const;

export function getStoreDomain(env: Pick<Env, "PUBLIC_STORE_DOMAIN">): string {
  if (!env.PUBLIC_STORE_DOMAIN) throw new Error("PUBLIC_STORE_DOMAIN is required (see .env.example).");
  return env.PUBLIC_STORE_DOMAIN;
}

// Shop identity for Shopify scripts and analytics. The shop ID comes from the
// Storefront API, the storefront ID from PUBLIC_STOREFRONT_ID, and the domain is
// the one the storefront client queries. Only a storefront ID loads Shopify's
// analytics (`hydrogen` channel); otherwise events stay local (`headless`), and
// the empty script `storefrontId` means "none".
export type ShopIdentity = {
  scriptShop: ShopifyScriptsShop;
  analyticsShop: ShopAnalytics;
  shopifyAnalytics: boolean;
};

export function resolveShopIdentity(env: Pick<Env, "PUBLIC_STORE_DOMAIN" | "PUBLIC_STOREFRONT_ID">, shopId: string): ShopIdentity {
  const storefrontId = env.PUBLIC_STOREFRONT_ID ?? "";
  return {
    scriptShop: { shopId, storefrontId, myshopifyDomain: getStoreDomain(env) },
    analyticsShop: storefrontId ? { shopId, channel: "hydrogen", storefrontId } : { shopId, channel: "headless" },
    shopifyAnalytics: storefrontId !== "",
  };
}

// Use Shopify's default consent banner and Customer Privacy behavior.
export const analyticsConsent = {
  mode: "default-banner",
  country: "US",
  language: "EN",
} as const;

// Private Storefront API token for SSR requests, from the runtime environment.
// Never commit a real token.
export function getPrivateStorefrontToken(env: Pick<Env, "PRIVATE_STOREFRONT_API_TOKEN">): string {
  const token = env.PRIVATE_STOREFRONT_API_TOKEN;
  if (!token) throw new Error("PRIVATE_STOREFRONT_API_TOKEN is required (see .env.example).");
  return token;
}

// Buyer IP for the private Storefront client (Shopify uses it for bot/abuse
// signals). The Node server (scripts/runtime.mjs) sets x-forwarded-for to the
// trusted buyer IP; development falls back to localhost.
export const DEVELOPMENT_BUYER_IP = "127.0.0.1";

export function getBuyerIp(headers: Pick<Headers, "get">): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) return ip;
  if (process.env.NODE_ENV !== "production") return DEVELOPMENT_BUYER_IP;
  throw new Error("x-forwarded-for is required for the private Storefront API client");
}
