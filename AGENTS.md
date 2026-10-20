# Plainwell storefront development

A Shopify Hydrogen / React Router storefront, served by Node (`scripts/serve.mjs` in
production on Coolify, the Vite plugin in `vite.config.ts` in development). See the
README for scripts and deployment.

Use the [Shopify AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit) for all Shopify API and platform work. If missing, install it in the agent host per that page (or `npx skills add Shopify/shopify-ai-toolkit --list` for skill-compatible hosts).

- All content comes from Shopify (metaobjects, metafields, menus, Site settings). Don't
  add copy, images or fallbacks to the code; if Shopify has nothing, render nothing.
- New interface text goes in `scripts/shopify/seed/text.mjs` and in Shopify.
- Ingredient, formula and policy details are fictional-demo placeholders; keep them that way.
