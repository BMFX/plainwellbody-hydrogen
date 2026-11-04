import { Cache, createCartCookie, gql } from "@shopify/hydrogen";

import { cartHandlers } from "./cart-handlers";
import type { Env } from "./env";
import type { RequestStorefrontClient } from "./storefront";

export type SelectionItem = { key: string; title: string; quantity: number; optional: boolean; available: boolean; platform_variant_id: string; price: string | null; currency: string };
export type Selection = { ticket: string; name: string; reorder: boolean; behavior: "retain_cart" | "clear_cart"; items: SelectionItem[]; promotion?: {code:string} | null; redirect_mode?: string; redirect_to?: string };
export type Choice = { review_ticket: string; optional_keys: string[]; sets: number; behavior: "retain_cart" | "clear_cart" };
type Payload = { behavior: Choice["behavior"]; items: {platform_variant_id: string; quantity: number}[]; attribution?: {shopify?: {line_item_properties?: Record<string,string>; cart_attributes?: Record<string,string>}}; promotion?: {code: string} | null; redirect_mode?: string; redirect_to?: string };
const tokenPattern = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|[A-Za-z0-9]{40,128})$/;
const numericId = /^\d{1,20}$/;
const trackingKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export function proxyUrl(env: Env, token: string, incoming: URL): URL {
  if (token.length < 3 || token.length > 128 || !tokenPattern.test(token)) throw new Error("selection");
  const host = env.PUBLIC_CHECKOUT_DOMAIN || env.PUBLIC_STORE_DOMAIN;
  if (!host || !/^[a-z0-9.-]+$/i.test(host) || !env.PUBLIC_STORE_DOMAIN?.endsWith(".myshopify.com")) throw new Error("configuration");
  const url = new URL(`/a/cart/${encodeURIComponent(token)}`, `https://${host}`);
  url.searchParams.set("stc_headless", "1");
  for (const key of trackingKeys) {
    const value = incoming.searchParams.get(key);
    if (value) url.searchParams.set(key, value.slice(0, 255));
  }
  return url;
}

export async function proxyRequest(env: Env, token: string, request: Request, choice?: Choice, fetcher = fetch): Promise<unknown> {
  const response = await fetcher(proxyUrl(env, token, new URL(request.url)), {
    method: choice ? "POST" : "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000),
    headers: {Accept: "application/json", ...(choice ? {"Content-Type": "application/json"} : {})},
    ...(choice ? {body: JSON.stringify(choice)} : {}),
  });
  // Never forward the shopper's cookies, authorization, or Shopify session to the proxy.
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("selection");
  const text = await response.text();
  if (text.length > 250_000) throw new Error("selection");
  return JSON.parse(text);
}

export function parseSelection(value: unknown, shop: string | undefined): Selection {
  const envelope = value as {version?: unknown; shop?: unknown; review?: Selection};
  const review = envelope?.review;
  if (envelope?.version !== 1 || envelope.shop !== shop || !review || !/^[A-Za-z0-9]{64}$/.test(review.ticket)
    || typeof review.name !== "string" || !["retain_cart", "clear_cart"].includes(review.behavior)
    || !Array.isArray(review.items) || review.items.length < 1 || review.items.length > 100) throw new Error("selection");
  const keys = new Set<string>();
  for (const item of review.items) {
    if (typeof item.key !== "string" || keys.has(item.key) || !numericId.test(String(item.platform_variant_id))
      || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999
      || typeof item.title !== "string" || typeof item.optional !== "boolean") throw new Error("selection");
    keys.add(item.key);
  }
  if (!review.items.some(item => !item.optional)) throw new Error("selection");
  return review;
}

type NativeVariant = {id:string; availableForSale:boolean; price:{amount:string;currencyCode:string}; product:{requiresSellingPlan:boolean}};
const VARIANTS = gql(`
  query SendTheCartVariants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id availableForSale price { amount currencyCode }
        product { requiresSellingPlan }
      }
    }
  }
`);
export async function loadSelection(env: Env, token: string, request: Request, client: RequestStorefrontClient): Promise<Selection> {
  const selection = parseSelection(await proxyRequest(env, token, request), env.PUBLIC_STORE_DOMAIN);
  const result = await client.graphql(VARIANTS, {variables: {ids: selection.items.map(item => `gid://shopify/ProductVariant/${item.platform_variant_id}`)}, cache: Cache.none()});
  if (result.errors?.length || !result.data) throw new Error("availability");
  const variants = new Map<string,NativeVariant>();
  for (const node of result.data.nodes as (NativeVariant | null)[]) if (node?.id) variants.set(node.id,node);
  return {...selection, items: selection.items.map(item => {
    const native = variants.get(`gid://shopify/ProductVariant/${item.platform_variant_id}`);
    return {...item, available: Boolean(item.available && native?.availableForSale && !native.product.requiresSellingPlan),
      price: native?.price.amount ?? null, currency: native?.price.currencyCode ?? ""};
  })};
}

export function readChoice(form: FormData, selection: Selection): Choice {
  const sets = Number(form.get("sets"));
  const behavior = form.get("behavior");
  const optional_keys = form.getAll("optional_keys").map(String);
  if (!Number.isInteger(sets) || sets < 1 || sets > (selection.reorder ? 10 : 1)
    || !["retain_cart", "clear_cart"].includes(String(behavior)) || new Set(optional_keys).size !== optional_keys.length
    || optional_keys.some(key => !selection.items.some(item => item.key === key && item.optional))) throw new Error("choice");
  const chosen = selection.items.filter(item => !item.optional || optional_keys.includes(item.key));
  if (chosen.some(item => !item.available || item.quantity * sets > 999)) throw new Error("availability");
  return {review_ticket: String(form.get("review_ticket") || ""), optional_keys, sets, behavior: behavior as Choice["behavior"]};
}

export function parsePayload(value: unknown, selection: Selection, choice: Choice): Payload {
  const payload = value as Payload;
  const expected = selection.items.filter(item => !item.optional || choice.optional_keys.includes(item.key));
  if (!payload || payload.behavior !== choice.behavior || !Array.isArray(payload.items) || payload.items.length !== expected.length
    || payload.items.some((item, index) => String(item.platform_variant_id) !== String(expected[index]?.platform_variant_id) || item.quantity !== expected[index].quantity * choice.sets)) throw new Error("selection");
  return payload;
}

export function requireSameOrigin(request: Request): void {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new Error("origin");
}
export function destination(payload: Pick<Payload,"redirect_mode" | "redirect_to">): string {
  if (payload.redirect_mode === "checkout") return "/checkout";
  const path = payload.redirect_to;
  if (payload.redirect_mode === "custom" && typeof path === "string" && path.length <= 255
    && /^\/(?:[A-Za-z0-9][A-Za-z0-9._~-]*(?:\/[A-Za-z0-9][A-Za-z0-9._~-]*)*\/?)?$/.test(path)
    && !/\/(?:a|apps|community|tools|api|s|c)(?:\/|$)|\/cart\/(?:add|change|clear|update)(?:[./]|$)/i.test(path)) return path;
  return "/cart";
}

const attributes = (values: Record<string, string> = {}) => Object.entries(values).map(([key,value]) => ({key,value:String(value)}));

const CREATE_SELECTION_CART = gql(`
  mutation SendTheCartCreate($input: CartInput!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    cartCreate(input: $input) {
      cart {
        id totalQuantity
        lines(first: 250) { nodes { quantity merchandise { ... on ProductVariant { id } } } }
        discountCodes { code applicable }
      }
      userErrors { code field message }
      warnings { code message target }
    }
  }
`);
const FINISH_SELECTION_CART = gql(`
  mutation SendTheCartFinish(
    $cartId: ID!, $lineIds: [ID!]!, $attributes: [AttributeInput!]!, $discountCodes: [String!]!,
    $remove: Boolean!, $attribute: Boolean!, $promote: Boolean!,
    $country: CountryCode, $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    removed: cartLinesRemove(cartId: $cartId, lineIds: $lineIds) @include(if: $remove) {
      cart { id }
      userErrors { code field message }
      warnings { code message target }
    }
    attributed: cartAttributesUpdate(cartId: $cartId, attributes: $attributes) @include(if: $attribute) {
      cart { id }
      userErrors { code field message }
      warnings { code message target }
    }
    promoted: cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) @include(if: $promote) {
      cart { id discountCodes { code applicable } }
      userErrors { code field message }
      warnings { code message target }
    }
  }
`);

type MutationResult = {cart?: {id:string} | null; userErrors?: readonly unknown[]; warnings?: readonly unknown[]};
function checkedMutation(value: MutationResult | null | undefined) {
  if (!value?.cart?.id || value.userErrors?.length || value.warnings?.length) throw new Error("cart");
}
function checkPromotion(code: string | undefined, previous: {code:string;applicable:boolean}[], next: {code:string;applicable:boolean}[]) {
  if (code && (!next.some(item => item.code.toLowerCase() === code.toLowerCase() && item.applicable)
    || previous.some(old => old.applicable && !next.some(item => item.code === old.code && item.applicable)))) throw new Error("promotion");
}

// No mutation is retried. Existing carts keep their identity, note and buyer details.
export async function applySelection(request: Request, client: RequestStorefrontClient, payload: Payload, handlers = cartHandlers) {
  const headers = new Headers({"Cache-Control":"no-store", "Referrer-Policy":"no-referrer"});
  try {
    // Never accept a cart id from shared-link query parameters.
    const cartRequest = new Request(new URL("/api/cart",request.url), {headers:{Cookie:request.headers.get("cookie") || ""}});
    const initial = await handlers.get({request:cartRequest, storefrontClient:client});
    if (initial.data.errors?.length) throw new Error("cart");
    const cart = initial.data.cart;
    const attribution = payload.attribution?.shopify ?? {};
    const lines = payload.items.map(item => ({merchandiseId:`gid://shopify/ProductVariant/${item.platform_variant_id}`, quantity:item.quantity,
      attributes:attributes(attribution.line_item_properties)}));
    const oldLines = payload.behavior === "clear_cart" ? cart?.lines.nodes.map(line => line.id) ?? [] : [];
    if (payload.behavior === "clear_cart" && cart && cart.lines.nodes.reduce((sum,line) => sum + line.quantity,0) !== cart.totalQuantity) throw new Error("cart");
    const codes = cart?.discountCodes ?? [];
    const combined = new Map((cart?.attributes ?? []).map(item => [item.key,item.value ?? ""]));
    for (const entry of attributes(attribution.cart_attributes)) combined.set(entry.key,entry.value);
    const cartAttributes = [...combined].map(([key,value]) => ({key,value}));
    const discountCodes = payload.promotion ? [...new Set([...codes.map(item => item.code),payload.promotion.code])] : [];

    if (!cart) {
      // A new shopper's items, attribution and promotion need only one native write.
      const result = await client.graphql(CREATE_SELECTION_CART, {variables:{input:{lines,
        ...(cartAttributes.length ? {attributes:cartAttributes} : {}),
        ...(payload.promotion ? {discountCodes} : {}),
      }}});
      const created = result.data?.cartCreate?.cart;
      // A partial result may still create a bag. Keep it visible for manual recovery.
      if (created?.id) headers.append("Set-Cookie",createCartCookie(created.id));
      if (result.errors?.length) throw new Error("cart");
      checkedMutation(result.data?.cartCreate);
      if (!created || created.totalQuantity !== lines.reduce((sum,line) => sum+line.quantity,0)) throw new Error("cart");
      const expected = new Map<string,number>();
      for (const line of lines) expected.set(line.merchandiseId,(expected.get(line.merchandiseId) ?? 0)+line.quantity);
      const actual = new Map<string,number>();
      for (const line of created.lines.nodes) {
        const id = line.merchandise.id;
        actual.set(id,(actual.get(id) ?? 0)+line.quantity);
      }
      if (expected.size !== actual.size || [...expected].some(([id,quantity]) => actual.get(id) !== quantity)) throw new Error("cart");
      checkPromotion(payload.promotion?.code,[],created.discountCodes);
      return {ok:true as const,headers};
    }

    // Add first and check success before removing any previous products.
    const added = await handlers.post({storefrontClient:client,request:new Request(new URL("/api/cart",request.url),{
      method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json",Cookie:request.headers.get("cookie") || ""},
      body:JSON.stringify({cartId:cart.id,lines}),
    })});
    new Headers(added.headers).forEach((value,key) => {if (key.toLowerCase() === "set-cookie") headers.append(key,value);});
    if (added.type !== "json") throw new Error("cart");
    checkedMutation(added.data as MutationResult);

    if (oldLines.length || cartAttributes.length || payload.promotion) {
      // Independent completion fields share one network round trip, after a successful add.
      const result = await client.graphql(FINISH_SELECTION_CART,{variables:{cartId:cart.id,lineIds:oldLines,
        attributes:cartAttributes,discountCodes,remove:Boolean(oldLines.length),attribute:Boolean(cartAttributes.length),promote:Boolean(payload.promotion),
      }});
      if (result.errors?.length || !result.data) throw new Error("cart");
      if (oldLines.length) checkedMutation(result.data.removed);
      if (cartAttributes.length) checkedMutation(result.data.attributed);
      if (payload.promotion) {
        checkedMutation(result.data.promoted);
        checkPromotion(payload.promotion.code,codes,result.data.promoted?.cart?.discountCodes ?? []);
      }
    }
    return {ok:true as const,headers};
  } catch {
    return {ok:false as const,headers};
  }
}
