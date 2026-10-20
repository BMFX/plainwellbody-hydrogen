import { Form, Link, useNavigation, useSubmit } from "react-router";

import { ShopifyImage } from "~/components/ShopifyImage";
import type { Entry } from "~/lib/content";
import { shopifyImageUrl, shopifySrcSet } from "~/lib/images";
import { formatPrice } from "~/lib/money";
import { HOUSEHOLDS, QTY_PREFIX, routineSearch, type RoutineLine, type RoutineState } from "~/lib/routine";
import { useText } from "~/lib/text";

// The routine finder section. Steps are GET forms (state lives in the URL, so it works
// without JavaScript and every routine is a shareable link); adding to the bag is a POST to
// the page, which works out the lines again on the server. Choices, products, quantities
// and photographs come from the finder section in Shopify; wording from Interface text.

export type RoutineFinderData = {
  state: RoutineState;
  routines: { handle: string; name: string; note: string; image: string | null }[];
  lines: RoutineLine[];
  subtotal: { amount: string; currencyCode: string };
  /** Standard shipping for this subtotal (0 when free), or null without figures in Shopify. */
  shippingCharge: { amount: string; currencyCode: string } | null;
  estimate: { amount: string; currencyCode: string } | null;
  error?: string;
};

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

export function RoutineFinder({ section, data }: { section: Entry; data: RoutineFinderData }) {
  const t = useText();
  const { state } = data;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle" && navigation.formMethod !== "POST";
  const steps = [t("finder.step.household"), t("finder.step.scent"), t("finder.step.routine")];

  return (
    <>
      <section className="pw-gutter flex flex-wrap items-end justify-between gap-6 pt-14">
        <div className="flex flex-col gap-3">
          <span className="pw-eyebrow">{t("finder.eyebrow")}</span>
          <span className="text-muted max-w-[520px] text-[15px]">{t("finder.intro")}</span>
        </div>
        <nav aria-label={t("finder.steps_label")} className="border-line flex gap-7 border-b">
          {steps.map((label, i) => {
            const step = i + 1;
            const current = state.step === step;
            const text = t("finder.step_number", { number: step, label });
            return step <= state.step ? (
              <Link
                key={step}
                to={routineSearch(state, step)}
                preventScrollReset
                aria-current={current ? "step" : undefined}
                className={`-mb-px flex h-11 items-center border-b text-[13px] ${current ? "border-ink text-ink" : "text-muted hover:text-ink border-transparent"}`}
              >
                {text}
              </Link>
            ) : (
              <span key={step} aria-disabled="true" className="text-muted -mb-px flex h-11 cursor-default items-center border-b border-transparent text-[13px]">
                {text}
              </span>
            );
          })}
        </nav>
      </section>

      <div className={`motion-safe:transition-opacity ${busy ? "opacity-70" : ""}`}>
        {state.step === 1 ? <HouseholdStep state={state} section={section} /> : null}
        {state.step === 2 ? <ScentStep state={state} routines={data.routines} /> : null}
        {state.step === 3 ? <RoutineStep data={data} section={section} /> : null}
      </div>
      <div className="border-line h-24 border-t" />
    </>
  );
}

function HouseholdStep({ state, section }: { state: RoutineState; section: Entry }) {
  const t = useText();
  return (
    <section className="border-line mt-7 grid border-t lg:grid-cols-2">
      <Form method="get" preventScrollReset className="pw-gutter flex flex-col gap-8 pt-14 pb-20 md:pt-[72px]">
        <Hidden values={{ scent: state.routine }} />
        <div className="flex flex-col gap-3.5">
          <span className="pw-eyebrow">{t("finder.household.eyebrow")}</span>
          <h1 className="pw-h1">{t("finder.household.heading")}</h1>
          <p className="pw-lead max-w-[440px]">{t("finder.household.intro")}</p>
        </div>
        <fieldset className="border-line grid max-w-[560px] grid-cols-2 border-t border-l">
          <legend className="sr-only">{t("finder.household.legend")}</legend>
          {HOUSEHOLDS.map((h) => (
            <label
              key={h}
              className="border-line has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:outline-ink has-[:checked]:has-[:focus-visible]:outline-paper has-[:focus-visible]:outline-2 flex min-h-[132px] cursor-pointer flex-col items-start gap-1.5 border-r border-b p-[22px] has-[:focus-visible]:outline has-[:focus-visible]:-outline-offset-4"
            >
              <input type="radio" name="household" value={h} defaultChecked={state.household === h} className="sr-only" />
              <span className="text-[40px] leading-none tracking-[-0.02em]">{t(`finder.household.${h}.number`)}</span>
              <span className="mt-auto">{t(`finder.household.${h}.label`)}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <button type="submit" name="step" value="2" className="pw-btn pw-btn--primary">
            {t("finder.continue")}
          </button>
        </div>
      </Form>
      <ShopifyImage
        image={section.image("household_image")}
        sizes="(min-width: 64rem) 50vw, 100vw"
        priority
        className="hidden h-full max-h-[760px] min-h-[640px] w-full object-cover lg:block"
      />
    </section>
  );
}

function ScentStep({ state, routines }: { state: RoutineState; routines: RoutineFinderData["routines"] }) {
  const t = useText();
  return (
    <Form method="get" preventScrollReset className="pw-gutter border-line mt-7 flex flex-col gap-9 border-t pt-14 pb-20 md:pt-[72px]">
      <Hidden values={{ household: state.household, travel: state.travel ? "1" : "0" }} />
      <div className="grid items-end gap-x-16 gap-y-5 md:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <span className="pw-eyebrow">{t("finder.scent.eyebrow")}</span>
          <h1 className="pw-h1">{t("finder.scent.heading")}</h1>
        </div>
        <p className="pw-lead max-w-[460px]">{t("finder.scent.intro")}</p>
      </div>
      <fieldset className="border-line grid border-t border-l sm:grid-cols-3">
        <legend className="sr-only">{t("finder.scent.legend")}</legend>
        {routines.map((routine) => (
          <label
            key={routine.handle}
            className="border-line has-[:checked]:outline-ink has-[:focus-visible]:outline-ink group grid cursor-pointer grid-cols-[96px_1fr] items-center border-r border-b has-[:checked]:outline has-[:checked]:-outline-offset-2 has-[:focus-visible]:outline-2 sm:flex sm:flex-col sm:items-stretch"
          >
            <input type="radio" name="scent" value={routine.handle} defaultChecked={state.routine === routine.handle} className="peer sr-only" />
            <span className="bg-shelf row-span-2 block aspect-square overflow-hidden">
              {routine.image ? (
                <img
                  src={shopifyImageUrl(routine.image, 600)}
                  srcSet={shopifySrcSet(routine.image, [360, 600, 900])}
                  sizes="(min-width: 40rem) 33vw, 96px"
                  alt=""
                  width={600}
                  height={600}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </span>
            <span className="flex items-baseline justify-between self-end px-4 pt-[18px] pb-1 sm:self-auto sm:px-5">
              <span className="pw-heading">{routine.name}</span>
              <span className="hidden text-[13px] group-has-[:checked]:inline">{t("finder.scent.selected")}</span>
            </span>
            <span className="text-muted self-start px-4 pb-6 sm:self-auto sm:px-5">{routine.note}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" name="step" value="3" className="pw-btn pw-btn--primary">
          {t("finder.scent.submit")}
        </button>
        <button type="submit" name="step" value="1" className="pw-btn pw-btn--secondary">
          {t("finder.back")}
        </button>
      </div>
    </Form>
  );
}

function RoutineStep({ data, section }: { data: RoutineFinderData; section: Entry }) {
  const t = useText();
  const { state, lines, subtotal, estimate } = data;
  const submit = useSubmit();
  const navigation = useNavigation();
  const adding = navigation.state !== "idle" && navigation.formData?.get("_action") === "routine";
  const routine = data.routines.find((r) => r.handle === state.routine);
  const count = lines.reduce((n, line) => n + line.quantity, 0);
  const overrides = Object.fromEntries(lines.map((line) => [line.handle, line.quantity]));
  const keep = {
    step: "3",
    household: state.household,
    scent: state.routine,
    travel: state.travel ? "1" : "0",
    ...Object.fromEntries(Object.entries(state.overrides).map(([h, q]) => [`${QTY_PREFIX}${h}`, String(q)])),
  };
  const essentials = t(count === 1 ? "finder.count_one" : "finder.count_other", { count });

  return (
    <section className="border-line mt-7 grid items-start border-t lg:grid-cols-2">
      <div className="pw-gutter border-line flex min-w-0 flex-col gap-2 pt-16 pb-[72px] lg:border-r">
        <span className="pw-eyebrow">{t("finder.routine.eyebrow")}</span>
        <h1 className="pt-1.5 pb-1 text-[clamp(36px,3.8vw,48px)] leading-[1.06] tracking-[-0.02em]">{t(`finder.routine.title.${state.household}`)}</h1>
        <p className="text-muted pb-5 text-[15px]">
          {t("finder.routine.summary", { household: t(`finder.household.${state.household}.label`), scent: routine?.name ?? "", note: routine?.note ?? "" })}
        </p>
        {/* Quantity changes are GET submissions too, so the routine is always a shareable URL. */}
        <Form method="get" preventScrollReset replace className="border-line border-t">
          <Hidden values={keep} />
          <ul role="list">
            {lines.map((line) => (
              <li key={line.handle} className="border-line grid grid-cols-[80px_1fr_auto] items-start gap-x-4 border-b py-6 sm:grid-cols-[96px_1fr_auto] sm:gap-x-5">
                <div className="bg-shelf aspect-[4/5] overflow-hidden">
                  {line.image ? (
                    <img
                      src={shopifyImageUrl(line.image, 200)}
                      srcSet={shopifySrcSet(line.image, [200, 300])}
                      sizes="96px"
                      alt=""
                      width={96}
                      height={120}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link to={`/products/${line.handle}`} className="pw-hover font-medium">
                    {line.title}
                  </Link>
                  <span className="text-muted">{t("finder.line.each", { size: line.size, price: formatPrice(line.price) })}</span>
                  <div className="border-line mt-3.5 inline-flex h-11 items-center self-start border">
                    <button
                      type="submit"
                      name={`${QTY_PREFIX}${line.handle}`}
                      value={line.quantity - 1}
                      aria-label={t("finder.line.decrease", { title: line.title })}
                      className="inline-flex h-full w-10 items-center justify-center text-base"
                    >
                      −
                    </button>
                    <span className="w-9 text-center text-sm">
                      {line.quantity}
                      <span className="sr-only">{t("finder.line.quantity_sr", { title: line.title })}</span>
                    </span>
                    <button
                      type="submit"
                      name={`${QTY_PREFIX}${line.handle}`}
                      value={line.quantity + 1}
                      aria-label={t("finder.line.increase", { title: line.title })}
                      className="inline-flex h-full w-10 items-center justify-center text-base"
                    >
                      +
                    </button>
                  </div>
                </div>
                <span className="text-right">
                  {formatPrice({
                    amount: ((Math.round(Number(line.price.amount) * 100) * line.quantity) / 100).toFixed(2),
                    currencyCode: line.price.currencyCode,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Form>
        <Form
          method="get"
          preventScrollReset
          replace
          onChange={(event) => submit(event.currentTarget, { preventScrollReset: true, replace: true })}
          className="border-line flex min-h-[52px] items-center gap-3 border-b"
        >
          <Hidden values={{ step: "3", household: state.household, scent: state.routine, travel: "0" }} />
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" name="travel" value="1" defaultChecked={state.travel} className="accent-ink size-[18px]" />
            {t("finder.travel")}
          </label>
          <noscript>
            <button type="submit" className="pw-link ms-auto">
              {t("finder.update")}
            </button>
          </noscript>
        </Form>
      </div>

      <aside className="flex flex-col lg:sticky lg:top-[var(--spacing-header)]">
        <ShopifyImage image={section.image("summary_image")} sizes="(min-width: 64rem) 50vw, 100vw" className="block aspect-[3/2] w-full object-cover" />
        <div className="pw-gutter flex flex-col pt-8 pb-12">
          <div className="border-line flex justify-between border-t py-3.5">
            <span>{essentials}</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {data.shippingCharge ? (
            <div className="border-line flex justify-between border-t py-3.5">
              <span>{t("finder.shipping")}</span>
              <span>{Number(data.shippingCharge.amount) === 0 ? t("shipping.complimentary") : formatPrice(data.shippingCharge)}</span>
            </div>
          ) : null}
          {estimate ? (
            <div className="border-ink flex items-baseline justify-between border-t pt-5 pb-6">
              <span>{t("finder.estimate")}</span>
              <span className="pw-title">{formatPrice(estimate)}</span>
            </div>
          ) : null}
          <p className="sr-only" role="status" aria-live="polite">
            {t("finder.status", { count: essentials, total: formatPrice(estimate ?? subtotal) })}
          </p>
          <Form method="post">
            <input type="hidden" name="_action" value="routine" />
            <Hidden values={{ household: state.household, scent: state.routine, travel: state.travel ? "1" : "0" }} />
            <Hidden values={Object.fromEntries(Object.entries(overrides).map(([h, q]) => [`${QTY_PREFIX}${h}`, String(q)]))} />
            <button type="submit" className="pw-btn pw-btn--primary w-full" disabled={!lines.length || adding}>
              {adding ? t("finder.adding") : t("finder.add")}
            </button>
          </Form>
          {data.error ? (
            <p role="alert" className="pt-3 text-sm">
              {data.error}
            </p>
          ) : null}
          <p className="text-muted pt-3.5 text-[13px] leading-[1.6]">{t("finder.add_note")}</p>
          <div className="flex gap-6 pt-[22px]">
            <Link to={routineSearch(state, 2)} preventScrollReset className="pw-link inline-flex h-11 items-center">
              {t("finder.change_scent")}
            </Link>
            <Link to="?" preventScrollReset className="text-muted inline-flex h-11 items-center text-[13px] underline underline-offset-4">
              {t("finder.start_over")}
            </Link>
          </div>
        </div>
      </aside>
    </section>
  );
}
