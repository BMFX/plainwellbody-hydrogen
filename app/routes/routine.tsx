import { Form, Link, redirect, useNavigation, useSubmit } from "react-router";

import { Media, mediaPreload } from "~/components/Media";
import { cartHandlers } from "~/lib/cart-handlers";
import { shopifyImageUrl, shopifySrcSet } from "~/lib/images";
import { formatPrice } from "~/lib/money";
import { FREE_SHIPPING_THRESHOLD, SCENT_LABEL, SCENT_NOTE } from "~/lib/plainwell";
import { loadCatalog } from "~/lib/plainwell-catalog";
import {
  HOUSEHOLDS,
  parseRoutine,
  QTY_PREFIX,
  ROUTINE_SCENTS,
  ROUTINE_TITLE,
  routineLines,
  routineSearch,
  type RoutineState,
} from "~/lib/routine";
import { shippingLabel, STANDARD_SHIPPING } from "~/lib/shipping";
import { storefrontClientContext } from "~/lib/storefront";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/routine";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/ErrorPage";

const STEPS = ["Household", "Scent", "Your routine"];

export function meta({ matches }: Route.MetaArgs) {
  const shopName = getShopNameFromRootMatch(matches[0]);
  return [
    { title: formatPageTitle("Find your routine", shopName) },
    {
      name: "description",
      content:
        "Two questions: who it's for and which scent you like. See every essential and quantity before anything goes in your bag.",
    },
    { tagName: "link", ...mediaPreload("campaign-everyday-ritual", "(min-width: 64rem) 50vw, 100vw") },
  ];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const state = parseRoutine(new URL(request.url).searchParams);
  const catalog = await loadCatalog(context.get(storefrontClientContext));
  const lines = routineLines(state, catalog.live).map(({ item, variant, quantity }) => ({
    handle: item.handle,
    title: item.title,
    size: item.size,
    image: item.live?.featuredImage?.url ?? null,
    price: variant.price,
    quantity,
  }));
  const currencyCode = lines[0]?.price.currencyCode ?? "USD";
  const cents = lines.reduce((sum, line) => sum + Math.round(Number(line.price.amount) * 100) * line.quantity, 0);
  const subtotal = { amount: (cents / 100).toFixed(2), currencyCode };
  const shipFree = cents >= FREE_SHIPPING_THRESHOLD * 100;
  const scents = ROUTINE_SCENTS.map((scent) => ({
    scent,
    image: catalog.live.find((item) => item.handle === `${scent}-body-wash`)?.live?.featuredImage?.url ?? null,
  }));
  return {
    state,
    lines,
    subtotal,
    estimate: { amount: ((cents + (cents > 0 && !shipFree ? STANDARD_SHIPPING * 100 : 0)) / 100).toFixed(2), currencyCode },
    scents,
  };
}

// Adds every line of the routine in one cart request, alongside what is already in the
// bag. The lines are worked out again here from the submitted choices, never taken from
// the browser. Works with or without JavaScript.
export async function action({ context, request }: Route.ActionArgs) {
  const form = await request.formData();
  const state = parseRoutine(form);
  const storefrontClient = context.get(storefrontClientContext);
  const catalog = await loadCatalog(storefrontClient);
  const lines = routineLines(state, catalog.live).map(({ variant, quantity }) => ({
    merchandiseId: variant.id,
    quantity,
  }));
  if (!lines.length) return { error: "Choose at least one essential." };

  const headers = new Headers({ "content-type": "application/json", accept: "application/json" });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const cartRequest = new Request(new URL("/api/cart", request.url), {
    method: "POST",
    headers,
    body: JSON.stringify({ lines }),
  });
  const result = await cartHandlers.post({ request: cartRequest, storefrontClient });
  if (result.type === "error") {
    console.error(`Routine add failed: ${result.error.message}`);
    return { error: "We couldn’t add the routine. Please try again." };
  }
  const response = redirect("/cart?added=routine", 303);
  for (const [name, value] of new Headers(result.headers)) response.headers.append(name, value);
  return response;
}

export default function RoutineRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { state } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <section className="pw-gutter flex flex-wrap items-end justify-between gap-6 pt-14">
        <div className="flex flex-col gap-3">
          <span className="pw-eyebrow">The routine finder</span>
          <span className="text-muted max-w-[520px] text-[15px]">
            Two questions. Every item and quantity is shown before anything goes in your bag.
          </span>
        </div>
        <nav aria-label="Steps" className="border-line flex gap-7 border-b">
          {STEPS.map((label, i) => {
            const step = i + 1;
            const current = state.step === step;
            const reachable = step <= state.step;
            const text = `${step} · ${label}`;
            return reachable ? (
              <Link
                key={label}
                to={routineSearch(state, step)}
                preventScrollReset
                aria-current={current ? "step" : undefined}
                className={`-mb-px flex h-11 items-center border-b text-[13px] ${current ? "border-ink text-ink" : "text-muted hover:text-ink border-transparent"}`}
              >
                {text}
              </Link>
            ) : (
              <span key={label} aria-disabled="true" className="text-muted -mb-px flex h-11 cursor-default items-center border-b border-transparent text-[13px]">
                {text}
              </span>
            );
          })}
        </nav>
      </section>

      <div className={`motion-safe:transition-opacity ${busy && navigation.formMethod !== "POST" ? "opacity-70" : ""}`}>
        {state.step === 1 ? <HouseholdStep state={state} /> : null}
        {state.step === 2 ? <ScentStep state={state} scents={loaderData.scents} /> : null}
        {state.step === 3 ? <RoutineStep data={loaderData} error={actionData?.error} /> : null}
      </div>
      <div className="border-line h-24 border-t" />
    </main>
  );
}

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

function HouseholdStep({ state }: { state: RoutineState }) {
  return (
    <section className="border-line mt-7 grid border-t lg:grid-cols-2">
      <Form method="get" preventScrollReset className="pw-gutter flex flex-col gap-8 pt-14 pb-20 md:pt-[72px]">
        <Hidden values={{ scent: state.scent }} />
        <div className="flex flex-col gap-3.5">
          <span className="pw-eyebrow">1 · Household</span>
          <h1 className="pw-h1">Who’s it for?</h1>
          <p className="pw-lead max-w-[440px]">Household size sets how much of each essential you’ll need.</p>
        </div>
        <fieldset className="border-line grid max-w-[560px] grid-cols-2 border-t border-l">
          <legend className="sr-only">Household size</legend>
          {HOUSEHOLDS.map((h) => (
            <label
              key={h.value}
              className="border-line has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:outline-ink flex min-h-[132px] cursor-pointer flex-col items-start gap-1.5 border-r border-b p-[22px] has-[:focus-visible]:outline has-[:focus-visible]:-outline-offset-4"
            >
              <input
                type="radio"
                name="household"
                value={h.value}
                defaultChecked={state.household === h.value}
                className="sr-only"
              />
              <span className="text-[40px] leading-none tracking-[-0.02em]">{h.num}</span>
              <span className="mt-auto">{h.label}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <button type="submit" name="step" value="2" className="pw-btn pw-btn--primary">
            Continue
          </button>
        </div>
      </Form>
      <Media
        name="campaign-everyday-ritual"
        alt="Hands lathering under water at a green stone basin"
        sizes="(min-width: 64rem) 50vw, 100vw"
        width={1024}
        height={1536}
        priority
        className="hidden h-full max-h-[760px] min-h-[640px] w-full object-cover lg:block"
      />
    </section>
  );
}

function ScentStep({
  state,
  scents,
}: {
  state: RoutineState;
  scents: { scent: (typeof ROUTINE_SCENTS)[number]; image: string | null }[];
}) {
  return (
    <Form method="get" preventScrollReset className="pw-gutter border-line mt-7 flex flex-col gap-9 border-t pt-14 pb-20 md:pt-[72px]">
      <Hidden values={{ household: state.household, travel: state.travel ? "1" : "0" }} />
      <div className="grid items-end gap-x-16 gap-y-5 md:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <span className="pw-eyebrow">2 · Scent</span>
          <h1 className="pw-h1">What feels like you?</h1>
        </div>
        <p className="pw-lead max-w-[460px]">
          One scent family across the whole routine. The botanical on each label shows you which is which.
        </p>
      </div>
      <fieldset className="border-line grid border-t border-l sm:grid-cols-3">
        <legend className="sr-only">Scent family</legend>
        {scents.map(({ scent, image }) => (
          <label
            key={scent}
            className="border-line has-[:checked]:outline-ink has-[:focus-visible]:outline-ink group grid cursor-pointer grid-cols-[96px_1fr] items-center border-r border-b has-[:checked]:outline has-[:checked]:-outline-offset-2 has-[:focus-visible]:outline-2 sm:flex sm:flex-col sm:items-stretch"
          >
            <input type="radio" name="scent" value={scent} defaultChecked={state.scent === scent} className="peer sr-only" />
            <span className="bg-shelf row-span-2 block aspect-square overflow-hidden">
              {image ? (
                <img
                  src={shopifyImageUrl(image, 600)}
                  srcSet={shopifySrcSet(image, [360, 600, 900])}
                  sizes="(min-width: 40rem) 33vw, 96px"
                  alt={`${SCENT_LABEL[scent]} Body Wash`}
                  width={600}
                  height={600}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </span>
            <span className="flex items-baseline justify-between self-end px-4 pt-[18px] pb-1 sm:self-auto sm:px-5">
              <span className="pw-heading">{SCENT_LABEL[scent]}</span>
              <span className="hidden text-[13px] group-has-[:checked]:inline">Selected</span>
            </span>
            <span className="text-muted self-start px-4 pb-6 sm:self-auto sm:px-5">{SCENT_NOTE[scent]}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" name="step" value="3" className="pw-btn pw-btn--primary">
          See my routine
        </button>
        <button type="submit" name="step" value="1" className="pw-btn pw-btn--secondary">
          Back
        </button>
      </div>
    </Form>
  );
}

function RoutineStep({ data, error }: { data: Route.ComponentProps["loaderData"]; error?: string }) {
  const { state, lines, subtotal, estimate } = data;
  const submit = useSubmit();
  const navigation = useNavigation();
  const adding = navigation.state !== "idle" && navigation.formMethod === "POST";
  const people = HOUSEHOLDS.find((h) => h.value === state.household)!.label;
  const count = lines.reduce((n, line) => n + line.quantity, 0);
  const overrides = Object.fromEntries(lines.map((line) => [line.handle, line.quantity]));
  const keep = {
    step: "3",
    household: state.household,
    scent: state.scent,
    travel: state.travel ? "1" : "0",
    ...Object.fromEntries(Object.entries(state.overrides).map(([h, q]) => [`${QTY_PREFIX}${h}`, String(q)])),
  };

  return (
    <section className="border-line mt-7 grid items-start border-t lg:grid-cols-2">
      <div className="pw-gutter border-line flex min-w-0 flex-col gap-2 pt-16 pb-[72px] lg:border-r">
        <span className="pw-eyebrow">3 · Your routine</span>
        <h1 className="pt-1.5 pb-1 text-[clamp(36px,3.8vw,48px)] leading-[1.06] tracking-[-0.02em]">
          {ROUTINE_TITLE[state.household]}
        </h1>
        <p className="text-muted pb-5 text-[15px]">
          {people} · {SCENT_LABEL[state.scent]} · {SCENT_NOTE[state.scent]}
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
                  <span className="text-muted">
                    {line.size} · {formatPrice(line.price)} each
                  </span>
                  <div className="border-line mt-3.5 inline-flex h-11 items-center self-start border">
                    <button
                      type="submit"
                      name={`${QTY_PREFIX}${line.handle}`}
                      value={line.quantity - 1}
                      aria-label={`Decrease ${line.title}`}
                      className="inline-flex h-full w-10 items-center justify-center text-base"
                    >
                      −
                    </button>
                    <span className="w-9 text-center text-sm" aria-label={`${line.quantity} ${line.title}`}>
                      {line.quantity}
                    </span>
                    <button
                      type="submit"
                      name={`${QTY_PREFIX}${line.handle}`}
                      value={line.quantity + 1}
                      aria-label={`Increase ${line.title}`}
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
          <Hidden values={{ step: "3", household: state.household, scent: state.scent, travel: "0" }} />
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" name="travel" value="1" defaultChecked={state.travel} className="accent-ink size-[18px]" />
            Include 3 fl oz travel sizes
          </label>
          <noscript>
            <button type="submit" className="pw-link ms-auto">
              Update
            </button>
          </noscript>
        </Form>
      </div>

      <aside className="flex flex-col lg:sticky lg:top-[var(--spacing-header)]">
        <Media
          name="campaign-product-family"
          alt="Citrus Body Wash, Fresh Deodorant, Cedar Shave Gel and Travel Body Wash on a stone shelf"
          sizes="(min-width: 64rem) 50vw, 100vw"
          width={1400}
          height={933}
          className="block aspect-[3/2] w-full object-cover"
        />
        <div className="pw-gutter flex flex-col pt-8 pb-12">
          <div className="border-line flex justify-between border-t py-3.5">
            <span>
              {count} {count === 1 ? "essential" : "essentials"}
            </span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="border-line flex justify-between border-t py-3.5">
            <span>US standard shipping</span>
            <span>{shippingLabel(subtotal)}</span>
          </div>
          <div className="border-ink flex items-baseline justify-between border-t pt-5 pb-6">
            <span>Estimated total</span>
            <span className="pw-title">{formatPrice(estimate)}</span>
          </div>
          <Form method="post">
            <Hidden values={{ household: state.household, scent: state.scent, travel: state.travel ? "1" : "0" }} />
            <Hidden values={Object.fromEntries(Object.entries(overrides).map(([h, q]) => [`${QTY_PREFIX}${h}`, String(q)]))} />
            <button type="submit" className="pw-btn pw-btn--primary w-full" disabled={!lines.length || adding}>
              {adding ? "Adding…" : "Add routine to bag"}
            </button>
          </Form>
          {error ? (
            <p role="alert" className="pt-3 text-sm">
              {error}
            </p>
          ) : null}
          <p className="text-muted pt-3.5 text-[13px] leading-[1.6]">
            Each essential goes in as its own line, added alongside anything already in your bag. Change any
            quantity before you check out.
          </p>
          <div className="flex gap-6 pt-[22px]">
            <Link to={routineSearch(state, 2)} preventScrollReset className="pw-link inline-flex h-11 items-center">
              Change scent
            </Link>
            <Link to="/pages/routine" preventScrollReset className="text-muted inline-flex h-11 items-center text-[13px] underline underline-offset-4">
              Start over
            </Link>
          </div>
        </div>
      </aside>
    </section>
  );
}
