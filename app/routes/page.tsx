import { data as response, redirect } from "react-router";

import { leadImage, Sections } from "~/components/Sections";
import { imagePreload } from "~/components/ShopifyImage";
import { cartHandlers } from "~/lib/cart-handlers";
import { clientT } from "~/lib/client-text";
import { format, loadSiteContent } from "~/lib/content";
import { envContext } from "~/lib/env";
import { looksAutomated, readEmail, type FormResult } from "~/lib/forms";
import { loadPage, routineFinderData, sectionsOfType } from "~/lib/pages";
import { routineLines, parseRoutine } from "~/lib/routine";
import { seoMeta } from "~/lib/seo";
import { AdminNotConfiguredError, getStoreContactEmail, recordContactMessage } from "~/lib/shopify-admin.server";
import { storefrontClientContext } from "~/lib/storefront";

import type { Route } from "./+types/page";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/ErrorPage";

// Any Shopify page. Its content is the page's sections (Content › Pages › Sections); a page
// with no sections shows its Shopify body. A page with neither is a 404, so a Shopify URL
// redirect for its path (Online Store › Navigation › URL redirects) applies instead.

export function meta({ matches, data }: Route.MetaArgs) {
  if (!data) return seoMeta(matches[0], { title: "", path: "/", noindex: true });
  const { page } = data;
  const image = leadImage(data.sections);
  const preload = imagePreload(image, "100vw");
  return [
    ...seoMeta(matches[0], {
      title: page.seoTitle || page.title,
      description: page.seoDescription || null,
      path: `/pages/${page.handle}`,
      image: image ? { url: image.url, width: image.width ?? undefined, height: image.height ?? undefined, alt: image.altText ?? undefined } : null,
    }),
    ...(preload ? [preload] : []),
  ];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const url = new URL(request.url);
  const loaded = await loadPage(context.get(storefrontClientContext), params.handle, [env.PUBLIC_STORE_DOMAIN, url.hostname]);
  if (!loaded || (!loaded.sections.length && !loaded.page.body.trim())) throw new Response("Not Found", { status: 404 });
  // The home page lives at /.
  if (loaded.homeHandle === loaded.page.handle) throw redirect("/", 301);

  const finder = sectionsOfType(loaded.sections, "pw_routine_finder")[0];
  const hasContact = sectionsOfType(loaded.sections, "pw_contact").length > 0;
  return {
    ...loaded,
    routine: finder ? routineFinderData(finder, url.searchParams, loaded.shipping) : null,
    contactEmail: hasContact ? await getStoreContactEmail(env) : null,
  };
}

export type ContactField = "name" | "email" | "message" | "form";

export async function action({ context, params, request }: Route.ActionArgs) {
  const env = context.get(envContext);
  const storefrontClient = context.get(storefrontClientContext);
  const form = await request.formData();
  const [loaded, site] = await Promise.all([
    loadPage(storefrontClient, params.handle, [env.PUBLIC_STORE_DOMAIN, new URL(request.url).hostname]),
    loadSiteContent(storefrontClient),
  ]);
  if (!loaded) throw new Response("Not Found", { status: 404 });
  const t = (key: string) => format(site.text, key);

  // Routine finder: add every line in one cart request, alongside what is already in the
  // bag. Lines are worked out again from the submitted choices, never taken from the browser.
  if (form.get("_action") === "routine") {
    const finder = sectionsOfType(loaded.sections, "pw_routine_finder")[0];
    if (!finder) throw new Response("Not Found", { status: 404 });
    const routines = finder.entries("routines");
    const lines = routineLines(parseRoutine(form, routines.map((r) => r.handle)), routines).map((l) => ({ merchandiseId: l.variantId, quantity: l.quantity }));
    if (!lines.length) return { routineError: t("finder.error.empty") };
    const headers = new Headers({ "content-type": "application/json", accept: "application/json" });
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
    const result = await cartHandlers.post({
      request: new Request(new URL("/api/cart", request.url), { method: "POST", headers, body: JSON.stringify({ lines }) }),
      storefrontClient,
    });
    if (result.type === "error") {
      console.error(`Routine add failed: ${result.error.message}`);
      return { routineError: t("finder.error.failed") };
    }
    const res = redirect("/cart?added=routine", 303);
    for (const [name, value] of new Headers(result.headers)) res.headers.append(name, value);
    return res;
  }

  // Contact form: saved to the customer record in Shopify (see recordContactMessage).
  if (form.get("_action") === "contact" && sectionsOfType(loaded.sections, "pw_contact").length) {
    const name = String(form.get("name") ?? "").trim().slice(0, 100);
    const message = String(form.get("message") ?? "").trim();
    const { email, valid } = readEmail(form);
    const errors: Partial<Record<ContactField, string>> = {};
    if (!name) errors.name = t("contact.error.name");
    if (!valid) errors.email = t("form.error.email");
    if (message.length < 2) errors.message = t("contact.error.message_short");
    if (message.length > 2000) errors.message = t("contact.error.message_long");
    if (Object.keys(errors).length) return response({ contact: { ok: false, errors } as FormResult<ContactField> }, { status: 400 });
    if (looksAutomated(form)) return { contact: { ok: true } as FormResult<ContactField> };
    try {
      await recordContactMessage(env, { name, email, message });
    } catch (error) {
      const notConfigured = error instanceof AdminNotConfiguredError;
      console.error(`Contact form failed: ${(error as Error).message}`);
      return response(
        { contact: { ok: false, errors: { form: t(notConfigured ? "contact.error.unavailable" : "contact.error.failed") } } as FormResult<ContactField> },
        { status: notConfigured ? 503 : 502 },
      );
    }
    return { contact: { ok: true } as FormResult<ContactField> };
  }
  throw new Response("Method Not Allowed", { status: 405 });
}

// With JavaScript, a dropped connection would otherwise replace the page with the error page
// and lose what the shopper typed; keep the form and say what happened instead.
export async function clientAction({ serverAction, request }: Route.ClientActionArgs) {
  // Read which form this is before serverAction() sends (and so uses up) the body.
  const isContact = (await request.clone().formData()).get("_action") === "contact";
  try {
    return await serverAction();
  } catch (error) {
    if (error instanceof Response) throw error;
    const offline = clientT("form.error.offline");
    return isContact
      ? { contact: { ok: false, errors: { form: offline } } as FormResult<ContactField> }
      : { routineError: offline };
  }
}

export default function PageRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { page, sections, routine } = loaderData;
  const result = actionData as { contact?: FormResult<ContactField>; routineError?: string } | undefined;

  if (!sections.length) {
    return (
      <main className="flex-1" id="main-content" tabIndex={-1}>
        <section className="pw-gutter flex flex-col gap-4 pt-[72px] pb-10">
          <h1 className="pw-h1">{page.title}</h1>
        </section>
        {page.body.trim() ? (
          <section className="pw-gutter border-line border-t pt-10 pb-28">
            <div className="richtext max-w-[680px] text-base" dangerouslySetInnerHTML={{ __html: page.body }} />
          </section>
        ) : null}
      </main>
    );
  }

  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <Sections
        sections={sections}
        context={{
          contactEmail: loaderData.contactEmail,
          contactResult: result?.contact ?? null,
          routine: routine ? { ...routine, error: result?.routineError } : null,
        }}
      />
    </main>
  );
}
