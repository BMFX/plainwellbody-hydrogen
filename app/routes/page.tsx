import { Cache, gql } from "@shopify/hydrogen";
import { data as response, Link, redirect } from "react-router";

import { CONTENT_PAGES } from "~/components/ContentPages";
import { envContext } from "~/lib/env";
import { looksAutomated, readEmail, type FormResult } from "~/lib/forms";
import { loadPolicyLinks } from "~/lib/policies";
import { loadCatalog } from "~/lib/plainwell-catalog";
import { AdminNotConfiguredError, getStoreContactEmail, isAdminConfigured, recordContactMessage } from "~/lib/shopify-admin.server";

import { storefrontClientContext } from "~/lib/storefront";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/page";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/ErrorPage";

const PAGE_QUERY = gql(`
  query PlainwellPage($handle: String!) {
    page(handle: $handle) {
      id
      handle
      title
      body
      seo {
        title
        description
      }
    }
  }
`);

export function meta({ matches, data }: Route.MetaArgs) {
  const shopName = getShopNameFromRootMatch(matches[0]);
  const page = data?.page;
  return [
    { title: formatPageTitle(page?.seo?.title || page?.title || "Page", shopName) },
    ...((page?.seo?.description || (page && CONTENT_PAGES[page.handle]?.description))
      ? [{ name: "description", content: page?.seo?.description || CONTENT_PAGES[page!.handle].description }]
      : []),
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  // The store's privacy policy is a Shopify policy, not a page.
  if (params.handle === "privacy") throw redirect("/policies/privacy-policy", 301);
  const storefrontClient = context.get(storefrontClientContext);
  const content = CONTENT_PAGES[params.handle];
  const { data, errors } = await storefrontClient.graphql(PAGE_QUERY, {
    variables: { handle: params.handle },
    cache: Cache.short(),
  });
  if (errors?.length) {
    console.error(`Page query failed: ${errors.map((e) => e.message).join("; ")}`);
    throw new Response("Page query failed", { status: 500 });
  }
  if (!data?.page) throw new Response("Not Found", { status: 404 });
  const env = context.get(envContext);
  const [products, policies, contactEmail] = await Promise.all([
    content?.products
      ? loadCatalog(storefrontClient).then((catalog) =>
          content.products!.flatMap((handle) => catalog.live.filter((item) => item.handle === handle)),
        )
      : [],
    content?.policies ? loadPolicyLinks(storefrontClient) : null,
    params.handle === "contact" ? getStoreContactEmail(env) : null,
  ]);
  // Once Shopify's terms of service exist, they are the terms page.
  if (params.handle === "terms" && policies?.terms) throw redirect(`/policies/${policies.terms.handle}`, 302);
  return {
    page: data.page,
    products,
    policies,
    contactEmail,
    contactReady: params.handle === "contact" ? isAdminConfigured(env) : false,
  };
}

export type ContactField = "name" | "email" | "message" | "form";

// The contact form posts to its own page; the message is saved in Shopify (see
// recordContactMessage). Works with or without JavaScript.
export async function action({ context, params, request }: Route.ActionArgs) {
  if (params.handle !== "contact") throw new Response("Method Not Allowed", { status: 405 });
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const message = String(form.get("message") ?? "").trim();
  const { email, valid } = readEmail(form);
  const errors: Partial<Record<ContactField, string>> = {};
  if (!name) errors.name = "Tell us your name.";
  if (!valid) errors.email = "Enter a valid email address.";
  if (message.length < 2) errors.message = "Write a short message.";
  if (message.length > 2000) errors.message = "Keep your message under 2,000 characters.";
  if (Object.keys(errors).length) return response<FormResult<ContactField>>({ ok: false, errors }, { status: 400 });
  if (looksAutomated(form)) return response<FormResult<ContactField>>({ ok: true });
  try {
    await recordContactMessage(context.get(envContext), { name, email, message });
  } catch (error) {
    const notConfigured = error instanceof AdminNotConfiguredError;
    console.error(`Contact form failed: ${(error as Error).message}`);
    return response<FormResult<ContactField>>(
      {
        ok: false,
        errors: {
          form: notConfigured
            ? "The contact form isn’t connected yet. Please try again soon."
            : "We couldn’t send your message just now. Please try again.",
        },
      },
      { status: notConfigured ? 503 : 502 },
    );
  }
  return response<FormResult<ContactField>>({ ok: true });
}

// Plainwell's editorial pages render their designed layouts (ContentPages.tsx); the
// Shopify page supplies the handle, title and SEO fields. Any other page renders its
// Shopify body, or a visible placeholder when the body is empty.
export default function PageRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { page } = loaderData;
  const Content = CONTENT_PAGES[page.handle]?.component;
  if (Content) {
    return (
      <main className="flex-1" id="main-content" tabIndex={-1}>
        <Content
          data={{
            products: loaderData.products,
            policies: loaderData.policies,
            contactEmail: loaderData.contactEmail,
            contactReady: loaderData.contactReady,
            contactResult: actionData,
          }}
        />
      </main>
    );
  }

  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <section className="pw-gutter flex flex-col gap-4 pt-[72px] pb-10">
        <span className="pw-eyebrow">Plainwell Body Co.</span>
        <h1 className="pw-h1">{page.title}</h1>
      </section>
      <section className="pw-gutter border-line border-t pt-10 pb-28">
        {page.body.trim() ? (
          <div className="richtext max-w-[680px] text-base" dangerouslySetInnerHTML={{ __html: page.body }} />
        ) : (
          <div className="flex max-w-[620px] flex-col items-start gap-5">
            <p className="text-muted text-base">[Page content in progress]</p>
            <Link to="/collections/all" className="pw-link">
              Shop all essentials
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
