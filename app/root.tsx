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
import { SearchDrawer } from "~/components/SearchDrawer";
import { CartProvider } from "~/lib/cart";
import { cartHandlers } from "~/lib/cart-handlers";
import { createRequestCustomerAccount, customerAccountContext } from "~/lib/customer-account";
import { envContext } from "~/lib/env";
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
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
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
  const [cartResult, layout] = await Promise.all([
    cartHandlers.get({ storefrontClient, request }),
    loadRootLayout(storefrontClient),
  ]);

  return {
    cartData: cartResult.data,
    shopInfo: layout.shopInfo,
    shopIdentity: resolveShopIdentity(env, layout.shopId),
    currency: layout.currency,
  };
}

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  // Absent when the root loader failed (error page only).
  const rootData = useRouteLoaderData<typeof loader>("root");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
        <a
          href="#main-content"
          className="focus-visible:bg-interactive focus-visible:text-interactive-text sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:start-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded focus-visible:px-4 focus-visible:py-2"
        >
          Skip to content
        </a>
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
