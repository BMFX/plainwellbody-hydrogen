import { isRouteErrorResponse, useRouteError } from "react-router";

import { Media } from "~/components/Media";

// The 404 and error page from the refined design. Route-level boundaries render it inside
// the root layout, so the header and footer stay; the root boundary is the last resort.
export function ErrorPage({ error }: { error: unknown }) {
  const notFound = error === 404 || (isRouteErrorResponse(error) && error.status === 404);
  let stack: string | undefined;
  if (!notFound && import.meta.env.DEV && error instanceof Error) stack = error.stack;

  return (
    <main id="main-content" tabIndex={-1} className="flex-1">
      <section className="border-line grid border-b md:grid-cols-2">
        <div className="pw-gutter flex flex-col justify-center gap-6 py-24">
          <span className="pw-eyebrow">{notFound ? "404 · Page not found" : "Something went wrong"}</span>
          <h1 className="pw-h1">
            {notFound ? (
              <>
                A little off
                <br />
                the path.
              </>
            ) : (
              "We couldn’t load this page."
            )}
          </h1>
          <p className="pw-lead">
            {notFound ? "Let’s bring you back to everyday care." : "Please try again in a moment."}
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/collections/all" className="pw-btn pw-btn--primary">
              Back to the shelf
            </a>
            <a href="/search" className="pw-btn pw-btn--secondary">
              Search
            </a>
          </div>
          {stack ? (
            <pre className="border-line mt-6 w-full overflow-x-auto border p-4 text-xs">
              <code>{stack}</code>
            </pre>
          ) : null}
        </div>
        <Media
          name="campaign-oat-ritual"
          alt="Hands lathering Oat Bar Soap over a stone basin"
          sizes="(min-width: 48rem) 50vw, 100vw"
          width={1254}
          height={1254}
          className="hidden h-[640px] w-full object-cover md:block"
        />
      </section>
      <div className="h-28" />
    </main>
  );
}

/** Re-export from a route as `ErrorBoundary`. */
export function RouteErrorBoundary() {
  return <ErrorPage error={useRouteError()} />;
}
