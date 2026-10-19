# Plainwell Body Co. — Hydrogen storefront

Standalone Shopify Hydrogen / React Router storefront. The legacy Liquid theme remains in `BMFX/plainwellbody`; this repository contains only Hydrogen and its history.

## Local development

Use Node 24. Run `npm ci`, copy `.env.example` to `.env`, and supply the Shopify values. Run `npm run dev` or `npm run dev:https` for Customer Account authentication. `npm run typecheck` checks types and GraphQL; `npm run test:runtime` tests the Node adapter.

## Coolify

Create a Dockerfile application from `BMFX/plainwellbody-hydrogen`, branch `main`, base directory `/`, Dockerfile `/Dockerfile`, container port `3000`. Use `/healthz` for health checks. Do not expose the container directly; Coolify's reverse proxy terminates TLS. `TRUST_PROXY=true` trusts that proxy for buyer IP and HTTPS origin.

Set the runtime variables from `.env.example` in Coolify. Tokens, session secret and Admin client secret must remain runtime secrets, never Docker build arguments or Git files. The Node process gets its own bounded TTL cache; no Oxygen runtime or deployment is required. MiniOxygen is retained only for the existing local development workflow.

Start with an HTTPS preview domain. Verify catalog, product, cart, checkout redirect, policies, contact, newsletter and Customer Accounts before attaching `plainwellbody.com`. Register preview and production callback/logout origins in Shopify Customer Account settings. Email sign-in needs the user to complete its one-time code. Domain cutover is a separate rollout step.

## Credentials

Use `SHOPIFY_ADMIN_CLIENT_ID` and `SHOPIFY_ADMIN_CLIENT_SECRET` for automatic 24-hour Admin token renewal. The legacy `SHOPIFY_ADMIN_API_TOKEN` fallback is optional and should be omitted for this app. Never prefix private credentials with `PUBLIC_`. `.env` is ignored by Git and excluded from Docker.

The existing product ingredient and journal placeholder content still needs approved copy. Contact messages are saved to Shopify customer notes with the `contact-form` tag; staff email notifications require a separate workflow.
