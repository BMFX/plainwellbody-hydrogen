import { useRouteLoaderData } from "react-router";

import { format, type SiteContent } from "~/lib/content";
import type { loader as rootLoader } from "~/root";

/** The site's content from Shopify, loaded once by the root loader. */
export function useSiteContent(): SiteContent | null {
  return useRouteLoaderData<typeof rootLoader>("root")?.content ?? null;
}

/** Interface text from Shopify (Content › Interface text). `t("key", { name })`. */
export function useText() {
  const content = useSiteContent();
  const text = content?.text ?? {};
  return (key: string, vars?: Record<string, string | number>) => format(text, key, vars);
}
