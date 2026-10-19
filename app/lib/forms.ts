// Shared checks for the newsletter and contact forms. Light spam protection without a
// third-party service: a hidden honeypot field people never fill, and a minimum time
// between rendering the form and submitting it.
export const HONEYPOT_FIELD = "company";
export const RENDERED_AT_FIELD = "rendered_at";
const MIN_FILL_MS = 1500;

export type FormResult<Field extends string = string> =
  | { ok: true }
  | { ok: false; errors: Partial<Record<Field | "form", string>> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function readEmail(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  return { email, valid: email.length <= 254 && EMAIL.test(email) };
}

/** True when the submission looks automated; respond as if it succeeded. */
export function looksAutomated(form: FormData) {
  if (String(form.get(HONEYPOT_FIELD) ?? "").trim()) return true;
  const renderedAt = Number(form.get(RENDERED_AT_FIELD));
  return Number.isFinite(renderedAt) && renderedAt > 0 && Date.now() - renderedAt < MIN_FILL_MS;
}
