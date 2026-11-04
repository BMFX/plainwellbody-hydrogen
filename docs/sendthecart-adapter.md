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

## Live acceptance — November 2, 2026

Production Hydrogen is pinned to `1d3fc66c6fd53558f3e3da609a200a12fb877e3d`; the isolated Plainwell SendTheCart pilot is pinned to `504198d8bb5a720f6d22c8f3160ba84d1d3958e9`. Both completed deployment and reported healthy containers. Pilot app, worker and scheduler images use the same revision. No other store deployment was changed.

The existing deployment credentials created the 19 missing `stc.*` Shopify labels in place; no credential file was copied and no existing entry overwritten.

Native shopper acceptance on `plainwellbody.com`:

| Case | Result |
| --- | --- |
| Optional selection, both accessories deselected | 2 required units, $40 subtotal |
| Keep existing bag, add Cedar Starter | Existing $40 retained; 4 units, $66 subtotal |
| Replace bag, all Cedar Routine items | Previous items removed after add; 4 units, $62 subtotal |
| Cedar Essentials Refill, two sets, replace | 2 washes + 2 hand washes + 4 soaps; 8 units, $96 subtotal |
| Cleanup | Original empty bag restored with native remove controls |

No checkout or order was submitted. Promotion applicability has automated coverage; live native discount/Function qualification, subscriptions and paid-order attribution remain separate work. Nine focused adapter tests and three runtime tests pass. TypeScript, gql.tada and build pass; the unrelated section-query external check was skipped because the toolkit was absent from this isolated checkout.

After these passes, the operator enabled the exact Plainwell pilot connection's headless share URL at `https://plainwellbody.com`, while retaining `https://checkout.plainwellbody.com` as its native signed-proxy origin. Activation stores verification time/revision and emits `shopify.headless_storefront.activated` in application logs.

## Cart write batching — November 3, 2026

The adapter now creates a fresh visitor cart with its selection, line/cart attribution
and requested promotion in one Storefront API mutation. It commits the Hydrogen
cart cookie even if Shopify returns a partial created cart, so recovery can inspect
that cart without repeating the add. Exact returned quantities and promotion
applicability are checked before redirecting.

For an existing bag, the cart identity, note and buyer details remain in place.
The add succeeds before removal is allowed. Old-line removal, merged attributes
and any promotion update then share one GraphQL request. GraphQL errors,
user errors, warnings and lost/inapplicable promotions fail without an automatic
retry. The existing same-origin and single-use review contract is unchanged.

Validation: eleven adapter tests, three Node runtime tests, TypeScript,
`hydrogen gql check --fail-on-warn`, and the production build pass. The Shopify
AI Toolkit Hydrogen validator reports no UI components in this server helper;
GraphQL validation is supplied by the project's pinned Hydrogen checker.
Reference: [Hydrogen 2026-10 cart server handlers](https://shopify.dev/docs/api/hydrogen/2026-10/cart/cart-server-handlers).

SendTheCart's full-document form redirect now uses `/cart` directly. The root
loader already reads the newly committed cart cookie on that document request;
the routine finder's `?added` client refresh flag would fetch the same cart again
after hydration. Interactive routine-finder refresh behavior is left in place.

### Request profiling (November 4)

Cart-link and `/cart` document responses include numeric `Server-Timing` stages:
`selection_lookup`, `availability`, `confirmation`, `cart_read`, `cart_create`
or `cart_add`/`cart_finish`, plus concurrent root cart/layout/content and total
request preparation. Durations only; no identifiers, payloads or credentials.
These headers do not change caching, availability validation, cart writes or
retry behavior. Root stages overlap each other and the child loader; don't sum
all metrics as if they were serial. HTTP response completion includes streaming
and network time beyond the request-preparation metric.

Reference: [Hydrogen performance guidance](https://shopify.dev/docs/storefronts/themes/best-practices/performance/hydrogen-performance).
