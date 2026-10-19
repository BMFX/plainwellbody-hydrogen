import { useEffect, useState } from "react";

import { HONEYPOT_FIELD, RENDERED_AT_FIELD } from "~/lib/forms";

/** True once the page has hydrated. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/** Hidden spam guards for a public form. See app/lib/forms.ts. */
export function FormGuards() {
  // Set after hydration, so cached HTML never carries a stale time. Without JavaScript the
  // field stays empty and only the honeypot applies.
  const [renderedAt, setRenderedAt] = useState("");
  useEffect(() => setRenderedAt(String(Date.now())), []);
  return (
    <>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name={RENDERED_AT_FIELD} value={renderedAt} />
    </>
  );
}
