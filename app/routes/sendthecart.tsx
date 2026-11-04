import {popupDestination} from "~/lib/popup";
import {useEffect, useRef} from "react";
import {automaticFields, canApplyAutomatically} from "~/lib/automatic-selection";
import type {Selection} from "~/lib/sendthecart.server";
import { data, redirect, useNavigation } from "react-router";

import {backendTimings, requestTimingContext} from "~/lib/request-timing";
import {SelectionReview} from "~/components/SelectionReview";
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
    if (!canApplyAutomatically(selection) && new URL(request.url).searchParams.get('stc_modal') !== '1') {
      return redirect(popupDestination(selection.popup_path, params.token!, new URL(request.url)), {headers:privateHeaders});
    }
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
    const confirmed = await context.get(requestTimingContext).measure("confirmation", () => proxyRequest(env,params.token,request,choice));
    Object.assign(context.get(requestTimingContext).durations, backendTimings((confirmed as {stc_timing?:unknown})?.stc_timing));
    const payload = parsePayload(confirmed,selection,choice);
    const result = await applySelection(request,client,payload,undefined,context.get(requestTimingContext));
    if (!result.ok) return data({failed:true},{status:502,headers:result.headers});
    // Keep the shopper in this storefront. /checkout is Hydrogen's existing checkout route.
    return redirect(destination(payload),{status:303,headers:result.headers});
  } catch {
    return data({failed:true},{status:409,headers:privateHeaders});
  }
}
function AutomaticSelection({selection}:{selection:Selection}) {
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (!submitted.current && form.current) {
      submitted.current = true;
      form.current.submit();
    }
  }, []);
  return <form ref={form} method="post" hidden>
    {Object.entries(automaticFields(selection)).map(([name,value]) => <input key={name} type="hidden" name={name} value={value}/>)}
  </form>;
}
export default function SendTheCartRoute({loaderData,actionData}: Route.ComponentProps) {
  const {selection} = loaderData;
  const pending = useNavigation().state !== "idle";
  if (!actionData?.failed && canApplyAutomatically(selection)) return <AutomaticSelection selection={selection}/>;
  return <main id="main-content" className="pw-contain pw-gutter py-14" tabIndex={-1}>
    <SelectionReview selection={selection} action="" failed={actionData?.failed} pending={pending}/>
  </main>;
}
