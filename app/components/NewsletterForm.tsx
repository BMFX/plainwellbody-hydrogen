import { useEffect, useRef } from "react";
import { useFetcher, useSearchParams } from "react-router";

import { FormGuards, useHydrated } from "~/components/FormGuards";
import { parseRich, RichText } from "~/components/RichText";
import type { FormResult } from "~/lib/forms";
import { useText } from "~/lib/text";

// Messages after a no-JavaScript sign-up, keyed by the ?newsletter= status it returns with.
const NATIVE_MESSAGE_KEYS: Record<string, string> = {
  subscribed: "newsletter.success",
  invalid: "form.error.email",
  unavailable: "newsletter.error.unavailable",
  error: "newsletter.error.failed",
};

export function NewsletterForm() {
  const t = useText();
  const fetcher = useFetcher<FormResult<"email">>();
  const hydrated = useHydrated();
  const [searchParams] = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const native = searchParams.get("newsletter");
  const result = fetcher.data;
  const note = parseRich(t("newsletter.note"));
  const busy = fetcher.state !== "idle";
  const done = result?.ok || (!result && native === "subscribed");
  const error = result && !result.ok ? (result.errors.email ?? result.errors.form) : !result && native && native !== "subscribed" && NATIVE_MESSAGE_KEYS[native] ? t(NATIVE_MESSAGE_KEYS[native]) : null;

  useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <fetcher.Form ref={formRef} method="post" action="/newsletter" id="newsletter" className="relative flex max-w-[440px] flex-col gap-3.5">
      <label htmlFor="newsletter-email" className="pw-section-label font-normal">
        {t("newsletter.label")}
        <span className="sr-only"> {t("newsletter.email_sr")}</span>
      </label>
      <FormGuards />
      {hydrated ? <input type="hidden" name="_js" value="1" /> : null}
      <div className="border-on-ink-muted flex items-center border-b">
        <input
          id="newsletter-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder={t("newsletter.placeholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby="newsletter-status"
          className="text-paper placeholder:text-on-ink-muted min-w-0 flex-1 !border-0 !bg-transparent !px-0 !py-3.5 !text-sm"
        />
        <button type="submit" disabled={busy} className="text-paper h-11 shrink-0 ps-4 text-[13px] disabled:opacity-60">
          {busy ? t("newsletter.submitting") : t("newsletter.submit")}
        </button>
      </div>
      <p id="newsletter-status" role="status" aria-live="polite" className="text-on-ink-muted min-h-5 text-xs leading-relaxed">
        {done ? t("newsletter.success") : error ? <span className="text-paper">{error}</span> : <RichText node={note} inline linkClassName="underline underline-offset-2" />}
      </p>
    </fetcher.Form>
  );
}
