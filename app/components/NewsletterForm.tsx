import { useEffect, useRef } from "react";
import { Link, useFetcher, useSearchParams } from "react-router";

import { FormGuards, useHydrated } from "~/components/FormGuards";
import type { FormResult } from "~/lib/forms";

const NATIVE_MESSAGES: Record<string, string> = {
  subscribed: "Thank you. You’re on the list.",
  invalid: "Enter a valid email address.",
  unavailable: "Sign-up isn’t connected yet. Please try again soon.",
  error: "We couldn’t sign you up just now. Please try again.",
};

export function NewsletterForm() {
  const fetcher = useFetcher<FormResult<"email">>();
  const hydrated = useHydrated();
  const [searchParams] = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const native = searchParams.get("newsletter");
  const result = fetcher.data;
  const busy = fetcher.state !== "idle";
  const done = result?.ok || (!result && native === "subscribed");
  const error = result && !result.ok ? (result.errors.email ?? result.errors.form) : !result && native && native !== "subscribed" ? NATIVE_MESSAGES[native] : null;

  useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <fetcher.Form ref={formRef} method="post" action="/newsletter" id="newsletter" className="relative flex max-w-[440px] flex-col gap-3.5">
      <label htmlFor="newsletter-email" className="pw-section-label font-normal">
        New essentials and everyday notes, now and then.
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
          placeholder="Email address"
          aria-invalid={error ? true : undefined}
          aria-describedby="newsletter-status"
          className="text-paper placeholder:text-on-ink-muted min-w-0 flex-1 !border-0 !bg-transparent !px-0 !py-3.5 !text-sm"
        />
        <button type="submit" disabled={busy} className="text-paper h-11 shrink-0 ps-4 text-[13px] disabled:opacity-60">
          {busy ? "Joining…" : "Subscribe"}
        </button>
      </div>
      <p id="newsletter-status" role="status" aria-live="polite" className="text-on-ink-muted min-h-5 text-xs leading-relaxed">
        {done ? (
          NATIVE_MESSAGES.subscribed
        ) : error ? (
          <span className="text-paper">{error}</span>
        ) : (
          <>
            Unsubscribe any time. See our{" "}
            <Link to="/policies/privacy-policy" className="underline underline-offset-2">
              privacy policy
            </Link>
            .
          </>
        )}
      </p>
    </fetcher.Form>
  );
}
