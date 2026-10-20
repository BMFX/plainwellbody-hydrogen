
import { loadPolicies } from "~/lib/policies";
import { storefrontClientContext } from "~/lib/storefront";

import { format } from "~/lib/content";
import { rootSeo, seoMeta } from "~/lib/seo";
import { useText } from "~/lib/text";

import type { Route } from "./+types/policy";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/ErrorPage";


export function meta({ matches, data }: Route.MetaArgs) {
  const policy = data?.policy;
  const text = rootSeo(matches[0]).content?.text ?? {};
  return seoMeta(matches[0], {
    title: policy?.title ?? "",
    description: policy ? format(text, "seo.policy_description", { policy: policy.title.toLowerCase(), shop: rootSeo(matches[0]).shopName }) : null,
    path: `/policies/${policy?.handle ?? ""}`,
    noindex: !policy,
  });
}

// Shopify's legal policies (Settings › Policies), at their standard /policies/:handle URLs.
export async function loader({ context, params }: Route.LoaderArgs) {
  const shop = await loadPolicies(context.get(storefrontClientContext)).catch((error: Error) => {
    console.error(error.message);
    throw new Response("Policies unavailable", { status: 500 });
  });
  const policy = Object.values(shop ?? {}).find((p) => p && typeof p === "object" && "handle" in p && p.handle === params.handle);
  if (!policy || typeof policy !== "object" || !("body" in policy)) throw new Response("Not Found", { status: 404 });
  return { policy };
}

export default function PolicyRoute({ loaderData }: Route.ComponentProps) {
  const { policy } = loaderData;
  const t = useText();
  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <section className="pw-gutter flex flex-col gap-4 pt-14 pb-10 md:pt-[72px]">
        <span className="pw-eyebrow">{t("policy.eyebrow")}</span>
        <h1 className="pw-h1">{policy.title}</h1>
      </section>
      <section className="pw-gutter border-line border-t pt-12 pb-28">
        <div className="richtext max-w-[720px] text-[15px]" dangerouslySetInnerHTML={{ __html: policy.body }} />
      </section>
    </main>
  );
}
