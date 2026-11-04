import { Form, Link, data, redirect, useNavigation } from "react-router";

import {requestTimingContext} from "~/lib/request-timing";
import { useText } from "~/lib/text";
import { envContext } from "~/lib/env";
import { loadSiteContent } from "~/lib/content";
import { seoMeta } from "~/lib/seo";
import { storefrontClientContext } from "~/lib/storefront";
import { applySelection, destination, loadSelection, parsePayload, proxyRequest, readChoice, requireSameOrigin } from "~/lib/sendthecart.server";

import type { Route } from "./+types/sendthecart";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/ErrorPage";
const privateHeaders = {"Cache-Control":"no-store", "Referrer-Policy":"no-referrer"};
export function meta({matches}: Route.MetaArgs) {
  return seoMeta(matches[0], {title:"",path:"/a/cart",noindex:true});
}
export async function loader({context,params,request}: Route.LoaderArgs) {
  try {
    const client = context.get(storefrontClientContext);
    const site = await loadSiteContent(client);
    if (!site.text["stc.title"]) throw new Error("content");
    const selection = await loadSelection(context.get(envContext),params.token,request,client,context.get(requestTimingContext));
    return data({selection},{headers:privateHeaders});
  } catch {
    throw new Response(null,{status:404,headers:privateHeaders});
  }
}
export async function action({context,params,request}: Route.ActionArgs) {
  if (request.method !== "POST") throw new Response(null,{status:405,headers:privateHeaders});
  try {requireSameOrigin(request);} catch {throw new Response(null,{status:403,headers:privateHeaders});}
  const env = context.get(envContext);
  const client = context.get(storefrontClientContext);
  try {
    const form = await request.formData();
    // Recheck current link state and Hydrogen-channel publication before any cart write.
    const selection = await loadSelection(env,params.token,request,client,context.get(requestTimingContext));
    const choice = readChoice(form,selection);
    const payload = parsePayload(await context.get(requestTimingContext).measure("confirmation", () => proxyRequest(env,params.token,request,choice)),selection,choice);
    const result = await applySelection(request,client,payload,undefined,context.get(requestTimingContext));
    if (!result.ok) return data({failed:true},{status:502,headers:result.headers});
    // Keep the shopper in this storefront. /checkout is Hydrogen's existing checkout route.
    return redirect(destination(payload),{status:303,headers:result.headers});
  } catch {
    return data({failed:true},{status:409,headers:privateHeaders});
  }
}
export default function SendTheCartRoute({loaderData,actionData}: Route.ComponentProps) {
  const t = useText();
  const {selection} = loaderData;
  const pending = useNavigation().state !== "idle";
  const unavailable = selection.items.some(item => !item.optional && !item.available);
  return <main id="main-content" className="pw-contain pw-gutter py-14" tabIndex={-1}>
    <p className="pw-eyebrow">{t("stc.title")}</p>
    <h1 className="pw-h1 mt-4">{selection.name}</h1>
    <p className="mt-6 max-w-[640px]">{t("stc.intro")}</p>
    {actionData?.failed ? <div role="alert" className="border-line my-8 border p-6">
      <p>{t("stc.error")}</p><Link to="/cart" reloadDocument className="underline">{t("stc.review_bag")}</Link>
    </div> : null}
    <Form method="post" reloadDocument className="mt-10 max-w-[740px]" aria-busy={pending}>
      <input type="hidden" name="review_ticket" value={selection.ticket}/>
      <ul className="divide-line divide-y border-y border-line">
        {selection.items.map(item => <li key={item.key} className="flex items-start gap-4 py-6">
          {item.optional ? <input type="checkbox" name="optional_keys" value={item.key} defaultChecked={item.available} disabled={!item.available}
            aria-label={t("stc.include",{name:item.title})} className="mt-1"/> : null}
          <div><h2 className="pw-heading">{item.title}</h2>
            <p>{t(item.optional ? "stc.optional" : "stc.required")} · {t("stc.quantity",{count:item.quantity})}</p>
            <p>{item.price !== null && item.currency ? new Intl.NumberFormat("en-US",{style:"currency",currency:item.currency}).format(Number(item.price)) : ""} · {t(item.available ? "stc.available" : "stc.unavailable")}</p>
          </div>
        </li>)}
      </ul>
      {selection.reorder ? <label className="mt-6 block">{t("stc.sets")}<input type="number" name="sets" min="1" max="10" defaultValue="1" required className="border-line ml-4 border p-3"/></label> : <input type="hidden" name="sets" value="1"/>}
      <label className="mt-6 block">{t("stc.behavior")}<select name="behavior" defaultValue={selection.behavior} className="border-line mt-2 block w-full border p-3">
        <option value="retain_cart">{t("stc.keep")}</option><option value="clear_cart">{t("stc.replace")}</option>
      </select></label>
      {selection.promotion ? <p className="mt-6">{t("stc.promotion",{code:selection.promotion.code})}</p> : null}
      <p className="text-muted my-6 text-sm">{t("stc.disclosure")}</p>
      {unavailable ? <p role="alert">{t("stc.blocked")}</p> : null}
      <button type="submit" disabled={pending || unavailable || Boolean(actionData?.failed)} className="pw-btn pw-btn--primary disabled:opacity-50">{t(pending ? "stc.adding" : "stc.add")}</button>
    </Form>
  </main>;
}
