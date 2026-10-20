import { data } from "react-router";

import { ErrorPage } from "~/components/ErrorPage";

import { seoMeta } from "~/lib/seo";

import type { Route } from "./+types/catchall";

// A 404 status (so Shopify's URL redirects still get a chance in the root middleware)
// with the designed page inside the site layout.
export function loader() {
  return data(null, { status: 404 });
}

export function meta({ matches }: Route.MetaArgs) {
  const text = (matches[0]?.data as { content?: { text: Record<string, string> } } | undefined)?.content?.text ?? {};
  return seoMeta(matches[0], { title: text["seo.not_found_title"] ?? "", path: "/", noindex: true });
}

export default function CatchAllRoute() {
  return <ErrorPage error={404} />;
}
