import { handleShopifyRedirects, handleShopifyRoutes } from "@shopify/hydrogen";
import { ShopifyScripts } from "@shopify/hydrogen/react";
import type { ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigate,
  useRouteLoaderData,
} from "react-router";

import { CartAnalyticsTracker, PageViewedTracker } from "~/components/AnalyticsTrackers";
import { AnnouncementBar } from "~/components/AnnouncementBar";
import { CartDrawer } from "~/components/CartDrawer";
import { Footer } from "~/components/Footer";
import { ErrorPage } from "~/components/ErrorPage";
import { Header } from "~/components/Header";
import { RouteAnnouncer } from "~/components/RouteAnnouncer";
import { SearchDrawer } from "~/components/SearchDrawer";
import { CartProvider } from "~/lib/cart";
import { cartHandlers } from "~/lib/cart-handlers";
import { createRequestCustomerAccount, customerAccountContext } from "~/lib/customer-account";
import { setClientText } from "~/lib/client-text";
import { loadSiteContent, format } from "~/lib/content";
import { envContext } from "~/lib/env";
import { shopifyImageUrl } from "~/lib/images";
import { predictiveSearchHandlers } from "~/lib/predictive-search-handlers";
import { loadRootLayout } from "~/lib/root-layout";
import { routeTemplates } from "~/lib/route-templates";
import { createEphemeralSessionManager } from "~/lib/session";
import { analyticsConsent, resolveShopIdentity, storefrontConfig } from "~/lib/shop";
import {
  createRequestStorefrontClient,
  storefrontClientContext,
  storefrontRequestContext,
} from "~/lib/storefront";

import type { Route } from "./+types/root";

import fontHref from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url";

import appStylesHref from "./app.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "preload", href: fontHref, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: appStylesHref },
];

export const middleware: Route.MiddlewareFunction[] = [
  async ({ context, request }, next) => {
    const env = context.get(envContext);
    const storefrontClient = createRequestStorefrontClient(
      request,
      env,
      context.cache,
      context.waitUntil,
    );
    const requestContext = storefrontClient.requestContext;
    const customerAccount = await createRequestCustomerAccount(request, env, requestContext);
    const sessionManager =
      customerAccount?.customerAccount.sessionManager ?? createEphemeralSessionManager(request);

    const shopifyRoute = handleShopifyRoutes({
      request,
      requestContext,
      sessionManager,
      storefrontClient,
      routeTemplates,
      handlers: customerAccount
        ? [cartHandlers, predictiveSearchHandlers, customerAccount.handlers]
        : [cartHandlers, predictiveSearchHandlers],
    });

    if (shopifyRoute) return shopifyRoute;

    context.set(storefrontClientContext, storefrontClient);
    context.set(storefrontRequestContext, requestContext);
    context.set(customerAccountContext, customerAccount?.customerAccount ?? null);

    const response = await next();
    const sessionHeaders = new Headers((await sessionManager.commit?.()) ?? undefined);
    for (const [name, value] of sessionHeaders) response.headers.append(name, value);
    if (response.status === 404) {
      const redirect = await handleShopifyRedirects({
        request,
        storefrontClient,
        routeTemplates,
      });

      if (redirect) return redirect;
    }

    requestContext.applyResponseHeaders(response.headers);
    return response;
  },
];

export async function loader({ context, request }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const storefrontClient = context.get(storefrontClientContext);
  const [cartResult, layout, content] = await Promise.all([
    cartHandlers.get({ storefrontClient, request }),
    loadRootLayout(storefrontClient),
    loadSiteContent(storefrontClient, [env.PUBLIC_STORE_DOMAIN, new URL(request.url).hostname]),
  ]);

  return {
    cartData: cartResult.data,
    shopInfo: layout.shopInfo,
    // Canonical and share URLs. Not Shopify's "primary domain": on a headless store that is
    // the checkout host (checkout.plainwellbody.com). PUBLIC_CANONICAL_ORIGIN pins it when
    // the site is reachable on more than one host.
    primaryOrigin: (env.PUBLIC_CANONICAL_ORIGIN || new URL(request.url).origin).replace(/\/$/, ""),
    shopIdentity: resolveShopIdentity(env, layout.shopId),
    currency: layout.currency,
    content,
  };
}

// Shared content (text, settings, menus) and shop identity don't change between pages, and
// the cart lives in its client store after the first load; skip reloading them on navigation.
export function shouldRevalidate() {
  return false;
}

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  // Absent when the root loader failed (error page only).
  const rootData = useRouteLoaderData<typeof loader>("root");
  if (rootData) setClientText(rootData.content.text);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f6f4ef" />
        {rootData?.content.settings.icon ? (
          <>
            <link rel="icon" type="image/png" sizes="48x48" href={shopifyImageUrl(rootData.content.settings.icon.url, 48, 48)} />
            <link rel="icon" type="image/png" sizes="192x192" href={shopifyImageUrl(rootData.content.settings.icon.url, 192, 192)} />
            <link rel="apple-touch-icon" href={shopifyImageUrl(rootData.content.settings.icon.url, 180, 180)} />
          </>
        ) : null}
        {rootData ? (
          <ShopifyScripts
            i18n={{ ...storefrontConfig.i18n, currency: rootData.currency }}
            shop={rootData.shopIdentity.scriptShop}
            analytics={{ channel: rootData.shopIdentity.analyticsShop.channel }}
            shopifyAnalytics={rootData.shopIdentity.shopifyAnalytics}
            consent={analyticsConsent}
            navigate={navigate}
            routes={routeTemplates}
          />
        ) : null}
        <Meta />
        <Links />
      </head>
      <body className="bg-paper text-ink font-body flex min-h-svh flex-col antialiased">
        {rootData ? (
          <a
            href="#main-content"
            className="focus-visible:bg-interactive focus-visible:text-interactive-text sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:start-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded focus-visible:px-4 focus-visible:py-2"
          >
            {format(rootData.content.text, "a11y.skip_to_content")}
          </a>
        ) : null}
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <CartProvider initialData={loaderData.cartData}>
      <PageViewedTracker />
      <RouteAnnouncer />
      <CartAnalyticsTracker />
      <AnnouncementBar />
      <Header shopName={loaderData.shopInfo.name} />
      <Outlet />
      <Footer shopName={loaderData.shopInfo.name} />
      <CartDrawer />
      <SearchDrawer />
    </CartProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ErrorPage error={error} />;
}
