# SendTheCart adapter

The `/a/cart/:token` route resolves a selection through Shopify's signed Online Store app proxy, then uses the site's existing Hydrogen 2026-10 cart handlers to populate this browser's bag. No Shopify Admin credential or SendTheCart secret is sent to the browser or added to the integration.

## Configuration and release

- Existing `PUBLIC_STORE_DOMAIN` must identify Plainwell's Shopify shop.
- Set server runtime `PUBLIC_CHECKOUT_DOMAIN=checkout.plainwellbody.com` (hostname only). This is the upstream Shopify Online Store, not the headless apex. The adapter rejects redirects and verifies the returned shop identity.
- The matching SendTheCart pilot must include the version-1 JSON proxy review contract (`stc_headless=1`, `Accept: application/json`). Both ordinary and reviewed links require explicit confirmation and a single-use review ticket through this contract.
- Add the new `stc.*` interface text to the existing Shopify `pw_text` model. `scripts/shopify/seed-sendthecart.mjs` checks first; `--apply` creates missing entries only. Use the existing authorized deployment credentials. Do not copy credential files into another checkout. Existing merchant text, definitions, products and publications remain unchanged.
- Deploy the storefront and verify cart behavior before an operator enables the pilot's `shopify_headless_enabled=true` and `shopify_headless_storefront_url=https://plainwellbody.com`. This override affects copied share URLs; keep `shopify_storefront_url` pointing at Shopify so catalog refreshes and signed proxy entry remain independent.

## Behavior and limits

- Review uses current Hydrogen-channel availability and prices; unpublished or subscription-only required variants block confirmation. Optional items and 1–10-set reorder links are supported. All choices are rechecked on the server; the backend enforces expiry, disabled links, entitlements and publication snapshots.
- The route only accepts same-origin POSTs. No browser cookie, authorization header, arbitrary query parameter or cart ID is forwarded upstream; bounded UTM fields are preserved.
- Adds include SendTheCart's line attribution. Cart attributes merge with existing attributes. A replace selection adds first, then removes the original cart snapshot; an add failure cannot empty the bag. An incomplete cart snapshot prevents replace.
- Mutation failures are never retried automatically. Partial failure preserves the cart cookie, exposes a bag-review link and disables further submission on that page. A later failure can leave the bag partly changed; opening a fresh link is an explicit new use.
- Requested promotion codes preserve existing codes and require native applicability before continuing. This does not qualify the separately held Shopify Function rollout.
- Full-document form submission ensures the bag and header reload from the committed cart cookie. Checkout uses Hydrogen's existing `/checkout` handler. Valid configured custom destinations stay on this storefront.
- There is no subscription creation, new billing behavior or purchase submission. Full paid-order attribution remains separate acceptance work.

## Verification

Run `npm run test:sendthecart`, `npm run test:runtime`, TypeScript/gql.tada checks and `npm run build`. Tests cover upstream secret isolation, store binding, forged choices, publication/subscription checks, keep/replace ordering, partial failure/cookie preservation, CSRF and redirect safety. Both new adapter files also passed the Shopify Hydrogen 2026-10 validator; it reports no Shopify UI components, so this is not a visual review.

Rollback: disable the headless share-URL override and restore the previous storefront and pilot deployment pins. Leave existing Shopify proxy links and all audit/history records intact. The new interface text can remain unused in Shopify.
