import { data, redirect } from "react-router";

import { envContext } from "~/lib/env";
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
  if (!valid) {
    if (nativeSubmit) return back("invalid");
    return data<FormResult<"email">>({ ok: false, errors: { email: "Enter a valid email address." } }, { status: 400 });
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
          form: notConfigured
            ? "Sign-up isn’t connected yet. Please try again soon."
            : "We couldn’t sign you up just now. Please try again.",
        },
      },
      { status: notConfigured ? 503 : 502 },
    );
  }
  return nativeSubmit ? back("subscribed") : data<FormResult>({ ok: true });
}

export function loader() {
  return redirect("/", 302);
}
