import { data } from "react-router";

import { ErrorPage } from "~/components/ErrorPage";

import type { Route } from "./+types/catchall";

// A 404 status (so Shopify's URL redirects still get a chance in the root middleware)
// with the designed page inside the site layout.
export function loader() {
  return data(null, { status: 404 });
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Page not found" }, { name: "robots", content: "noindex" }];
}

export default function CatchAllRoute() {
  return <ErrorPage error={404} />;
}
