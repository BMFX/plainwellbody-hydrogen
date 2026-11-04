import {useEffect, useRef, useState} from 'react';
import {useLocation, useNavigate} from 'react-router';
import type {Selection} from '~/lib/sendthecart.server';
import {popupToken} from '~/lib/popup';
import {useText} from '~/lib/text';
import {SelectionReview} from './SelectionReview';

export function SelectionPopup() {
  const t = useText();
  const location = useLocation();
  const token = popupToken(new URLSearchParams(location.search).get('stc_popup'));
  return token ? <>
    <Popup key={token + location.search} token={token}/>
    <noscript><a href={`/a/cart/${encodeURIComponent(token)}?stc_modal=1`} className="pw-btn pw-btn--primary">{t('stc.title')}</a></noscript>
  </> : null;
}

function Popup({token}: {token:string}) {
  const t = useText();
  const location = useLocation();
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [failed, setFailed] = useState(false);
  const query = new URLSearchParams(location.search);
  query.delete('stc_popup');
  const tracking = query.toString();
  const action = `/a/cart/${encodeURIComponent(token)}?stc_modal=1${tracking ? '&' + tracking : ''}`;
  const close = () => {
    const params = new URLSearchParams(location.search);
    params.delete('stc_popup');
    const search = params.toString();
    void navigate(location.pathname + (search ? '?' + search : '') + location.hash, {replace:true, preventScrollReset:true});
  };
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.documentElement.style.overflow;
    element.showModal();
    document.documentElement.style.overflow = 'hidden';
    return () => {element.close(); document.documentElement.style.overflow = previous;};
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/sendthecart/popup/${encodeURIComponent(token)}${tracking ? '?' + tracking : ''}`, {
      signal:controller.signal, cache:'no-store', headers:{Accept:'application/json'},
    }).then(async response => {
      if (!response.ok) throw new Error('preview');
      const body = await response.json() as {selection:Selection};
      if (!controller.signal.aborted) setSelection(body.selection);
    }).catch(() => {if (!controller.signal.aborted) setFailed(true);});
    return () => controller.abort();
  }, [token, tracking]);
  return <dialog ref={dialog} className="stc-selection-popup" aria-labelledby="stc-popup-title"
    onCancel={event => {event.preventDefault(); close();}}
    onClick={event => {if (event.target === dialog.current) {
      const box = dialog.current.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    }}}>
    <button type="button" className="stc-popup-close" aria-label={t('nav.close')} onClick={close}>×</button>
    {selection ? <SelectionReview selection={selection} action={action}/> : <div role={failed ? 'alert' : 'status'} aria-busy={!failed}>
      <h2 id="stc-popup-title" className="pw-h2">{t('stc.title')}</h2>
      {failed ? <p className="mt-4">{t('stc.unavailable')}</p> : <span aria-hidden="true" className="mt-4 block">…</span>}
    </div>}
  </dialog>;
}
