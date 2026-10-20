import {
  type CacheInstance,
  type CachingStrategy,
  createShopifyRequestContext,
  createStorefrontClient,
  type RequestScopedPrivateStorefrontClient,
  type ShopifyRequestContext,
} from "@shopify/hydrogen";
import { createContext } from "react-router";

import type { Env } from "~/lib/env";
import { getBuyerIp, getPrivateStorefrontToken, getStoreDomain, storefrontConfig } from "~/lib/shop";

// Private token + trusted buyer IP, created with a cache so each query can opt in
// with `cache: Cache.short()`.
type CacheOption = { cache?: CachingStrategy };
export type RequestStorefrontClient = RequestScopedPrivateStorefrontClient<CacheOption>;

export function createRequestStorefrontClient(
  request: Request,
  env: Env,
  cache: CacheInstance,
  waitUntil: WaitUntil,
): RequestStorefrontClient {
  const { i18n } = storefrontConfig;
  return createStorefrontClient({
    type: "private",
    requestContext: createShopifyRequestContext({
      request,
      i18n,
      buyerIp: getBuyerIp(request.headers),
    }),
    config: {
      storeDomain: getStoreDomain(env),
      privateStorefrontToken: getPrivateStorefrontToken(env),
      storefrontId: env.PUBLIC_STOREFRONT_ID,
      cache,
      waitUntil,
    },
  });
}

export const storefrontClientContext = createContext<RequestStorefrontClient>();
export const storefrontRequestContext = createContext<ShopifyRequestContext>();
