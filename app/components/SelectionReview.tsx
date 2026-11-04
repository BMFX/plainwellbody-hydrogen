import {Form, Link, useNavigation} from "react-router";
import type {Selection} from "~/lib/sendthecart.server";
import {useText} from "~/lib/text";
export function SelectionReview({selection, action, failed = false, pending = false}: {selection:Selection; action:string; failed?:boolean; pending?:boolean}) {
  const t = useText();
  const submitting = useNavigation().state !== 'idle' || pending;
  const unavailable = selection.items.some(item => !item.optional && !item.available);
  return <>
    <p className="pw-eyebrow">{t("stc.title")}</p>
    <h2 id="stc-popup-title" className="pw-h2 mt-4">{selection.name}</h2>
    <p className="mt-4">{t("stc.intro")}</p>
    {failed ? <div role="alert" className="border-line my-6 border p-4"><p>{t("stc.error")}</p><Link to="/cart" reloadDocument className="underline">{t("stc.review_bag")}</Link></div> : null}
    <Form method="post" action={action} className="mt-10 max-w-[740px]" aria-busy={submitting}>
      <input type="hidden" name="review_ticket" value={selection.ticket}/>
      {selection.recipe_token && <input type="hidden" name="recipe_token" value={selection.recipe_token}/>}
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
      <button type="submit" disabled={submitting || unavailable || Boolean(failed)} className="pw-btn pw-btn--primary disabled:opacity-50">{t(submitting ? "stc.adding" : "stc.add")}</button>
    </Form>
  </>;
}
