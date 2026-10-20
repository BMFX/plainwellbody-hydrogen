import { isRouteErrorResponse, useRouteError } from "react-router";

import { ShopifyImage } from "~/components/ShopifyImage";
import { useSiteContent, useText } from "~/lib/text";

// The 404 and error page. Route-level boundaries render it inside the root layout, so the
// header and footer stay; the root boundary is the last resort (and, if the site content
// itself failed to load, has no text to show).
export function ErrorPage({ error }: { error: unknown }) {
  const t = useText();
  const content = useSiteContent();
  const notFound = error === 404 || (isRouteErrorResponse(error) && error.status === 404);
  let stack: string | undefined;
  if (!notFound && import.meta.env.DEV && error instanceof Error) stack = error.stack;
  const key = notFound ? "not_found" : "error";
  const heading = t(`${key}.heading`);

  return (
    <main id="main-content" tabIndex={-1} className="flex-1">
      <section className="border-line grid border-b md:grid-cols-2">
        <div className="pw-gutter flex flex-col justify-center gap-6 py-24">
          <span className="pw-eyebrow">{t(`${key}.eyebrow`)}</span>
          <h1 className="pw-h1">
            {heading.split("\n").map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="pw-lead">{t(`${key}.body`)}</p>
          <div className="flex flex-wrap gap-3">
            <a href="/collections/all" className="pw-btn pw-btn--primary">
              {t("not_found.shop_link")}
            </a>
            <a href="/search" className="pw-btn pw-btn--secondary">
              {t("nav.search")}
            </a>
          </div>
          {stack ? (
            <pre className="border-line mt-6 w-full overflow-x-auto border p-4 text-xs">
              <code>{stack}</code>
            </pre>
          ) : null}
        </div>
        <ShopifyImage image={content?.settings.notFoundImage} sizes="(min-width: 48rem) 50vw, 100vw" className="hidden h-[640px] w-full object-cover md:block" />
      </section>
      <div className="h-28" />
    </main>
  );
}

/** Re-export from a route as `ErrorBoundary`. */
export function RouteErrorBoundary() {
  return <ErrorPage error={useRouteError()} />;
}
