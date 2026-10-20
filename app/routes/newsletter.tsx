import { data, redirect } from "react-router";

import { clientT } from "~/lib/client-text";
import { format, loadSiteContent } from "~/lib/content";
import { envContext } from "~/lib/env";
import { storefrontClientContext } from "~/lib/storefront";
import { looksAutomated, readEmail, type FormResult } from "~/lib/forms";
import { AdminNotConfiguredError, subscribeToNewsletter } from "~/lib/shopify-admin.server";

import type { Route } from "./+types/newsletter";

// The footer sign-up posts here. With JavaScript it is a fetcher and reads the JSON
// result; without it the browser follows a redirect back to the page it came from.
export async function action({ context, request }: Route.ActionArgs) {
  const form = await request.formData();
  const nativeSubmit = !request.headers.get("accept")?.includes("application/json") && form.get("_js") !== "1";
  const back = (status: string) => {
    const referer = request.headers.get("referer");
    const url = new URL(referer && new URL(referer).origin === new URL(request.url).origin ? referer : "/", request.url);
    url.searchParams.set("newsletter", status);
    url.hash = "newsletter";
    return redirect(`${url.pathname}${url.search}${url.hash}`, 303);
  };

  const { email, valid } = readEmail(form);
  const site = await loadSiteContent(context.get(storefrontClientContext));
  const t = (key: string) => format(site.text, key);
  if (!valid) {
    if (nativeSubmit) return back("invalid");
    return data<FormResult<"email">>({ ok: false, errors: { email: t("form.error.email") } }, { status: 400 });
  }
  if (looksAutomated(form)) return nativeSubmit ? back("subscribed") : data<FormResult>({ ok: true });

  try {
    await subscribeToNewsletter(context.get(envContext), email);
  } catch (error) {
    const notConfigured = error instanceof AdminNotConfiguredError;
    console.error(`Newsletter sign-up failed: ${(error as Error).message}`);
    if (nativeSubmit) return back(notConfigured ? "unavailable" : "error");
    return data<FormResult>(
      {
        ok: false,
        errors: {
          form: t(notConfigured ? "newsletter.error.unavailable" : "newsletter.error.failed"),
        },
      },
      { status: notConfigured ? 503 : 502 },
    );
  }
  return nativeSubmit ? back("subscribed") : data<FormResult>({ ok: true });
}

// Keeps the footer form in place with a message when the connection drops.
export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  try {
    return await serverAction();
  } catch (error) {
    if (error instanceof Response) throw error;
    return { ok: false as const, errors: { form: clientT("form.error.offline") } };
  }
}

export function loader() {
  return redirect("/", 302);
}
