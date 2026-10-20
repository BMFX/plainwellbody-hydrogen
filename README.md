# Plainwell Body Co. — Hydrogen storefront

Standalone Shopify Hydrogen / React Router storefront. The legacy Liquid theme remains in `BMFX/plainwellbody`; this repository contains only Hydrogen and its history.

## Local development

Use Node 24. Run `npm ci`, copy `.env.example` to `.env`, and supply the Shopify values. Run `npm run dev` or `npm run dev:https` for Customer Account authentication. `npm run typecheck` checks types and GraphQL; `npm run test:runtime` tests the Node adapter.

## Coolify

Create a Dockerfile application from `BMFX/plainwellbody-hydrogen`, branch `main`, base directory `/`, Dockerfile `/Dockerfile`, container port `3000`. Use `/healthz` for health checks. Do not expose the container directly; Coolify's reverse proxy terminates TLS. `TRUST_PROXY=true` trusts that proxy for buyer IP and HTTPS origin.

Set the runtime variables from `.env.example` in Coolify. Tokens, session secret and Admin client secret must remain runtime secrets, never Docker build arguments or Git files. The Node process gets its own bounded TTL cache; no Oxygen runtime or deployment is required. MiniOxygen is retained only for the existing local development workflow.

Start with an HTTPS preview domain. Verify catalog, product, cart, checkout redirect, policies, contact, newsletter and Customer Accounts before attaching `plainwellbody.com`. Register preview and production callback/logout origins in Shopify Customer Account settings. Email sign-in needs the user to complete its one-time code. Domain cutover is a separate rollout step.

## Content lives in Shopify

Every word, image, link and menu comes from Shopify; the code holds layout only. If
Shopify has nothing for something, the site shows nothing (or a 404), never a fallback.

- **Pages and collections** carry a `plainwell.sections` metafield: a list of section
  metaobjects (Content › Metaobjects › Section: …), each rendered by its component in
  `app/components/Sections.tsx`.
- **Interface text** (buttons, labels, messages) is the `pw_text` metaobject, one entry
  per key. `useText()` reads it; `{name}` fills a value and `[label](/path)` makes a link.
- **Site settings** (`pw_settings`, handle `site`): logos, site icon, sharing image,
  shipping figures, the Shop all collection, the home page, the bag's "Often added"
  products and the announcement bar.
- **Menus** (Online Store › Navigation): `main-menu`, `footer` (one column per top-level
  item), `footer-legal`, `shop-categories` (collection tabs), `mobile-secondary`,
  `search-suggestions`.
- **Products** use `plainwell.scent`, `family`, `coming_soon`, `details`, `ingredients`
  and `ritual_image`; reviews come from the standard `reviews.rating` and
  `reviews.rating_count` metafields that review apps fill.

`scripts/shopify/setup.mjs` creates the model and seeds the approved design copy
(`scripts/shopify/seed/`). It needs an Admin app (Dev Dashboard) with
`SHOPIFY_ADMIN_CLIENT_ID` and `SHOPIFY_ADMIN_CLIENT_SECRET` in `.env` and these scopes:
`write_products`, `write_publications`, `write_files`, `write_online_store_navigation`,
`write_online_store_pages`, `write_metaobject_definitions`, `write_metaobjects`.

```bash
npm run shopify:setup                         # read-only check of what would change
npm run shopify:setup -- --apply              # create whatever is missing
npm run shopify:setup -- --apply --overwrite  # also reset existing entries to the seed
```

Entries that already exist are left alone unless you pass `--overwrite`, so edits made in
Shopify survive a rerun. The Headless channel's Storefront API permissions must include
metaobjects, pages and menus.

## Credentials

Use `SHOPIFY_ADMIN_CLIENT_ID` and `SHOPIFY_ADMIN_CLIENT_SECRET` for automatic 24-hour Admin token renewal. The legacy `SHOPIFY_ADMIN_API_TOKEN` fallback is optional and should be omitted for this app. Never prefix private credentials with `PUBLIC_`. `.env` is ignored by Git and excluded from Docker.

The existing product ingredient and journal placeholder content still needs approved copy. Contact messages are saved to Shopify customer notes with the `contact-form` tag; staff email notifications require a separate workflow.
