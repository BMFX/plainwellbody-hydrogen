import {useState} from 'react';
import {Form, Link, useNavigation} from 'react-router';
import type {Selection, SelectionItem} from '~/lib/sendthecart.server';
import {selectionSummary} from '~/lib/selection-summary';
import {useText} from '~/lib/text';
import {ShopifyImage} from './ShopifyImage';

function linePrice(item: SelectionItem, sets: number) {
  if (item.price === null || !item.currency || !Number.isFinite(Number(item.price))) return null;
  return new Intl.NumberFormat('en-US', {style:'currency',currency:item.currency}).format(Number(item.price) * item.quantity * sets);
}

export function SelectionReview({selection, action, failed = false, pending = false}: {selection:Selection; action:string; failed?:boolean; pending?:boolean}) {
  const t = useText();
  const [sets, setSets] = useState('1');
  const [optionalKeys, setOptionalKeys] = useState(() => selection.items.filter(item => item.optional && item.available).map(item => item.key));
  const [activeKey, setActiveKey] = useState(() => selection.items.find(item => item.image)?.key);
  const [posting, setPosting] = useState(false);
  const submitting = useNavigation().state !== 'idle' || pending || posting;
  const unavailable = selection.items.some(item => !item.optional && !item.available);
  const validSets = Number.isInteger(Number(sets)) && Number(sets) >= 1 && Number(sets) <= (selection.reorder ? 10 : 1);
  const multiplier = validSets ? Number(sets) : 1;
  const summary = selectionSummary(selection.items, optionalKeys, validSets ? multiplier : 0);
  const galleryItems = selection.items.filter(item => item.image);
  const active = galleryItems.find(item => item.key === activeKey) ?? galleryItems[0];
  const moveSets = (delta:number) => setSets(String(Math.max(1, Math.min(10, multiplier + delta))));
  return <Form method="post" action={action} reloadDocument className={`stc-review${active ? '' : ' stc-review--no-media'}`} aria-busy={submitting}
    onSubmit={() => setPosting(true)}>
    <input type="hidden" name="review_ticket" value={selection.ticket}/>
    {selection.recipe_token && <input type="hidden" name="recipe_token" value={selection.recipe_token}/>}
    <header className="stc-review-header">
      <p className="stc-review-eyebrow">{t('stc.title')}</p>
      <h2 id="stc-popup-title">{selection.name}</h2>
      <p className="stc-review-intro">{t('stc.intro')}</p>
    </header>
    <div className="stc-review-scroll">
      {active ? <section className="stc-review-gallery" aria-label={selection.name}>
        <ShopifyImage image={active.image} alt={active.image?.altText ?? active.product_title ?? active.title}
          sizes="(max-width: 700px) 156px, 430px" widths={[180,320,480,800,1000]} priority className="stc-review-hero"/>
        <div className="stc-review-caption"><span>{active.product_title ?? active.title}</span><span>{active.variant_title}</span></div>
        {galleryItems.length > 1 ? <div className="stc-review-thumbnails">
          {galleryItems.map(item => <button key={item.key} type="button" aria-label={item.title} aria-pressed={active.key === item.key}
            onClick={() => setActiveKey(item.key)} className="stc-review-thumbnail">
            <ShopifyImage image={item.image} alt="" sizes="72px" widths={[72,144]} />
          </button>)}
        </div> : null}
      </section> : null}
      <div className="stc-review-detail">
        {failed ? <div role="alert" className="stc-review-error"><p>{t('stc.error')}</p><Link to="/cart" reloadDocument className="underline">{t('stc.review_bag')}</Link></div> : null}
        <ul className="stc-review-items">
          {selection.items.map(item => <li key={item.key} className="stc-review-item" data-unavailable={!item.available || undefined}>
            {item.optional ? <input type="checkbox" name="optional_keys" value={item.key} checked={optionalKeys.includes(item.key)} disabled={!item.available}
              onChange={event => setOptionalKeys(keys => event.target.checked ? [...keys,item.key] : keys.filter(key => key !== item.key))}
              aria-label={t('stc.include',{name:item.title})} className="stc-review-optional"/> : null}
            {item.image ? <ShopifyImage image={item.image} alt="" sizes="54px" widths={[64,128,180]} className="stc-review-item-image"/> : null}
            <div className="stc-review-item-copy"><h3>{item.product_title ?? item.title}</h3>
              {item.variant_title ? <p>{item.variant_title}</p> : null}
              <p>{t('stc.quantity',{count:item.quantity})}</p>
            </div>
            <div className="stc-review-price"><span>{linePrice(item,multiplier)}</span>
              <small>{t(!item.available ? 'stc.unavailable' : item.optional ? 'stc.optional' : 'stc.required')}</small>
            </div>
          </li>)}
        </ul>
        {selection.reorder ? <div className="stc-review-controls"><label htmlFor="stc-review-sets">{t('stc.sets')}</label>
          <div className="stc-review-stepper">
            <button type="button" onClick={() => moveSets(-1)} disabled={multiplier <= 1 || submitting} aria-label={t('product.quantity_decrease')}>−</button>
            <input id="stc-review-sets" type="number" name="sets" min="1" max="10" step="1" value={sets} onChange={event => setSets(event.target.value)} required/>
            <button type="button" onClick={() => moveSets(1)} disabled={multiplier >= 10 || submitting} aria-label={t('product.quantity_increase')}>+</button>
          </div>
        </div> : <input type="hidden" name="sets" value="1"/>}
        <details className="stc-review-behavior">
          <summary>{t('stc.behavior')}<span aria-hidden="true">⌄</span></summary>
          <label className="sr-only" htmlFor="stc-review-behavior">{t('stc.behavior')}</label>
          <select id="stc-review-behavior" name="behavior" defaultValue={selection.behavior}>
            <option value="retain_cart">{t('stc.keep')}</option><option value="clear_cart">{t('stc.replace')}</option>
          </select>
        </details>
        {selection.promotion ? <p className="stc-review-notice">{t('stc.promotion',{code:selection.promotion.code})}</p> : null}
        {unavailable ? <p role="alert" className="stc-review-notice">{t('stc.blocked')}</p> : null}
      </div>
    </div>
    <footer className="stc-review-buy">
      <div className="stc-review-subtotal" aria-live="polite" aria-atomic="true">
        <div>{t('bag.subtotal')}{validSets ? <span> · {t(summary.count === 1 ? 'bag.count_one' : 'bag.count_other',{count:summary.count})}</span> : null}</div>
        <strong>{summary.total}</strong>
      </div>
      <button type="submit" disabled={submitting || unavailable || Boolean(failed) || !validSets} className="stc-review-add">
        {t(submitting ? 'stc.adding' : 'stc.add')}<span aria-hidden="true">→</span>
      </button>
      <p className="stc-review-disclosure">{t('stc.disclosure')}</p>
    </footer>
  </Form>;
}
