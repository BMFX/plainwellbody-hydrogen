import { Fragment, type ReactNode } from "react";
import { Form, Link, useNavigation } from "react-router";

import { FormGuards } from "~/components/FormGuards";
import { cardFromProduct, ProductGrid } from "~/components/ProductCard";
import { parseRich, RichText } from "~/components/RichText";
import { RoutineFinder, type RoutineFinderData } from "~/components/RoutineFinder";
import { ShopifyImage } from "~/components/ShopifyImage";
import { Entry, type RichNode } from "~/lib/content";
import type { FormResult } from "~/lib/forms";
import { wholePrice } from "~/lib/money";
import { useText } from "~/lib/text";

// One component per Shopify section type (Content › Metaobjects › Section: …). Each renders
// the refined design; every word, link and image comes from the section's fields. A field
// left empty in Shopify renders nothing.

export type SectionContext = {
  contactEmail?: string | null;
  contactResult?: FormResult<"name" | "email" | "message"> | null;
  routine?: RoutineFinderData | null;
};

/** Multi-line text with its line breaks kept (headings set on two lines in Shopify). */
function Lines({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </>
  );
}

function Heading({ first, className, children, id }: { first: boolean; className?: string; children: ReactNode; id?: string }) {
  return first ? (
    <h1 className={className} id={id}>
      {children}
    </h1>
  ) : (
    <h2 className={className} id={id}>
      {children}
    </h2>
  );
}

function LinkButton({ link, className }: { link: { text: string; url: string } | null; className: string }) {
  if (!link?.text) return null;
  return (
    <Link to={link.url} className={className}>
      {link.text}
    </Link>
  );
}

const paragraphs = (node: RichNode | null, className: string) => <RichText node={node} paragraphClassName={className} className="flex flex-col gap-4" />;

function Hero({ e, first }: { e: Entry; first: boolean }) {
  const heading = e.text("heading");
  return (
    <section className="bg-olive relative h-[560px] overflow-hidden md:h-[760px]">
      <ShopifyImage image={e.image("image")} sizes="100vw" priority={first} className="absolute inset-0 h-full w-full object-cover object-[78%_50%] md:object-[62%_50%]" />
      <div aria-hidden="true" className="pw-hero-scrim absolute inset-0" />
      <div className="pw-gutter absolute inset-x-0 bottom-12 flex max-w-[640px] flex-col gap-5 text-white md:bottom-16">
        {e.text("eyebrow") ? <span className="text-xs tracking-[0.14em] uppercase">{e.text("eyebrow")}</span> : null}
        {heading ? (
          <Heading first={first} className="pw-display-xl">
            <Lines text={heading} />
          </Heading>
        ) : null}
        {e.text("body") ? <p className="max-w-[420px] text-base leading-relaxed text-[#f1eee6]">{e.text("body")}</p> : null}
        {e.link("primary_link") || e.link("secondary_link") ? (
          <div className="flex flex-wrap gap-3">
            <LinkButton link={e.link("primary_link")} className="pw-btn pw-btn--light" />
            <LinkButton link={e.link("secondary_link")} className="pw-btn pw-btn--outline-light" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Statement({ e }: { e: Entry }) {
  return (
    <section className="pw-gutter flex flex-col items-center gap-7 py-24 text-center md:pt-[120px] md:pb-28">
      {e.text("eyebrow") ? <span className="pw-eyebrow">{e.text("eyebrow")}</span> : null}
      {e.text("text") ? <p className="pw-statement max-w-[880px]">{e.text("text")}</p> : null}
      <LinkButton link={e.link("link")} className="pw-link" />
    </section>
  );
}

function PageHead({ e, first }: { e: Entry; first: boolean }) {
  const centered = e.text("align") === "center";
  const heading = e.text("heading");
  const title = heading ? (
    <Heading first={first} className={`pw-h1 ${centered ? "max-w-[760px]" : ""}`}>
      <Lines text={heading} />
    </Heading>
  ) : null;
  if (centered) {
    return (
      <section className="pw-gutter flex flex-col items-center gap-5 pt-14 pb-12 text-center md:pt-[72px]">
        {e.text("eyebrow") ? <span className="pw-eyebrow">{e.text("eyebrow")}</span> : null}
        {title}
        {e.text("intro") ? <p className="text-muted max-w-[620px] text-lg leading-[1.6]">{e.text("intro")}</p> : null}
      </section>
    );
  }
  return (
    <section className="pw-gutter grid items-end gap-x-16 gap-y-6 pt-14 pb-10 md:grid-cols-2 md:pt-[72px]">
      <div className="flex flex-col gap-4">
        {e.text("eyebrow") ? <span className="pw-eyebrow">{e.text("eyebrow")}</span> : null}
        {title}
      </div>
      {e.text("intro") ? <p className="pw-lead">{e.text("intro")}</p> : null}
    </section>
  );
}

function Banner({ e, first }: { e: Entry; first: boolean }) {
  return <ShopifyImage image={e.image("image")} sizes="100vw" priority={first} className="block h-[380px] w-full object-cover md:h-[620px]" />;
}

function SectionProductGrid({ e }: { e: Entry }) {
  const items = e.products("products").map(cardFromProduct);
  if (!items.length) return null;
  return (
    <section className="border-line border-t" aria-label={e.text("heading") || undefined}>
      {e.text("heading") || e.link("link") ? (
        <div className="pw-gutter flex items-baseline justify-between gap-4 py-[22px]">
          {e.text("heading") ? <h2 className="pw-section-label">{e.text("heading")}</h2> : <span />}
          <LinkButton link={e.link("link")} className="pw-link" />
        </div>
      ) : null}
      <ProductGrid items={items} />
    </section>
  );
}

function Split({ e, first }: { e: Entry; first: boolean }) {
  const olive = e.text("tone") !== "paper";
  const heading = e.text("heading");
  return (
    <section className={`grid md:grid-cols-2 ${olive ? "bg-olive text-paper" : "border-line border-t"}`}>
      <ShopifyImage
        image={e.image("image")}
        sizes="(min-width: 48rem) 50vw, 100vw"
        className="block h-[420px] w-full object-cover md:h-full md:max-h-[860px] md:min-h-[640px]"
      />
      <div className="flex flex-col justify-center gap-6 px-[clamp(28px,7vw,120px)] py-16 md:py-20">
        {e.text("eyebrow") ? <span className={`pw-eyebrow ${olive ? "text-on-olive" : ""}`}>{e.text("eyebrow")}</span> : null}
        {heading ? (
          <Heading first={first} className="pw-h2">
            <Lines text={heading} />
          </Heading>
        ) : null}
        {paragraphs(e.rich("body"), `max-w-[460px] text-base leading-[1.7] ${olive ? "text-on-olive" : ""}`)}
        <LinkButton link={e.link("link")} className={`pw-btn self-start ${olive ? "pw-btn--outline-light" : "pw-btn--primary"}`} />
      </div>
    </section>
  );
}

function ScentTiles({ e }: { e: Entry }) {
  const scents = e.entries("scents");
  const heading = e.text("heading");
  return (
    <section className="pw-gutter flex flex-col gap-10 pt-24 pb-24 md:pt-28 md:pb-[120px]">
      {heading || e.text("intro") ? (
        <div className="grid items-end gap-x-16 gap-y-5 md:grid-cols-2">
          {heading ? (
            <h2 className="pw-h2">
              <Lines text={heading} />
            </h2>
          ) : null}
          {e.text("intro") ? <p className="text-muted max-w-[460px] text-[15px] leading-[1.7]">{e.text("intro")}</p> : null}
        </div>
      ) : null}
      <ul role="list" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {scents.map((scent) => {
          const link = scent.link("link");
          const tile = (
            <>
              <div className="bg-olive aspect-[4/5] overflow-hidden">
                <ShopifyImage
                  image={scent.image("ritual_image")}
                  sizes="(min-width: 64rem) 25vw, 50vw"
                  className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]"
                />
              </div>
              <div className="border-ink flex flex-wrap items-baseline justify-between gap-x-3 border-t pt-3.5">
                <span className="pw-heading">{scent.text("name")}</span>
                <span className="text-muted">{scent.text("short_note")}</span>
              </div>
            </>
          );
          return (
            <li key={scent.id}>
              {link ? (
                <Link to={link.url} className="group flex flex-col gap-[18px]">
                  {tile}
                </Link>
              ) : (
                <div className="flex flex-col gap-[18px]">{tile}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Feature({ e }: { e: Entry }) {
  const t = useText();
  const products = e.products("products");
  if (!products.length) return null;
  const prices = products.map((p) => p.selectedOrFirstAvailableVariant?.price ?? p.priceRange.minVariantPrice);
  // List prices from Shopify, summed in cents; the bag shows Shopify's own totals.
  const cents = prices.reduce((sum, price) => sum + Math.round(Number(price.amount) * 100), 0);
  const total = { amount: (cents / 100).toFixed(2), currencyCode: prices[0].currencyCode };
  return (
    <section className="bg-olive relative overflow-hidden md:h-[680px]">
      <ShopifyImage image={e.image("image")} sizes="100vw" className="block h-[320px] w-full object-cover md:absolute md:inset-0 md:h-full" />
      <div className="bg-paper relative flex flex-col gap-3.5 p-8 md:absolute md:right-[var(--spacing-gutter)] md:bottom-12 md:w-[400px]">
        {e.text("eyebrow") ? <span className="pw-eyebrow">{e.text("eyebrow")}</span> : null}
        {e.text("heading") ? <h2 className="pw-title">{e.text("heading")}</h2> : null}
        <ul role="list" className="border-line flex flex-col border-t">
          {products.map((product, i) => (
            <li key={product.id} className="border-line flex justify-between border-b py-[9px]">
              <Link to={`/products/${product.handle}`} className="pw-hover">
                {product.title}
              </Link>
              <span className="text-muted">{wholePrice(prices[i])}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-4 pt-1.5">
          <span className="text-lg" aria-label={t("feature.total_sr", { total: wholePrice(total) })}>
            {wholePrice(total)}
          </span>
          <LinkButton link={e.link("link")} className="pw-btn pw-btn--primary h-11 px-[22px]" />
        </div>
      </div>
    </section>
  );
}

function Teasers({ e }: { e: Entry }) {
  const items = e.entries("items");
  return (
    <section className="pw-gutter flex flex-col gap-9 py-24 md:py-28">
      {e.text("heading") || e.link("link") ? (
        <div className="flex items-baseline justify-between gap-4">
          {e.text("heading") ? <h2 className="pw-section-label">{e.text("heading")}</h2> : <span />}
          <LinkButton link={e.link("link")} className="pw-link" />
        </div>
      ) : null}
      <div className="grid gap-x-4 gap-y-12 md:grid-cols-2">
        {items.map((item) => {
          const body = (
            <>
              <div className="aspect-[3/2] overflow-hidden">
                <ShopifyImage image={item.image("image")} sizes="(min-width: 48rem) 50vw, 100vw" className="h-full w-full object-cover" />
              </div>
              {item.text("eyebrow") ? <span className="pw-eyebrow">{item.text("eyebrow")}</span> : null}
              {item.text("title") ? <span className="text-2xl leading-tight tracking-[-0.015em]">{item.text("title")}</span> : null}
              {item.text("body") ? <span className="text-muted">{item.text("body")}</span> : null}
            </>
          );
          return item.url("url") ? (
            <Link key={item.id} to={item.url("url")} className="group flex flex-col gap-[18px]">
              {body}
            </Link>
          ) : (
            <div key={item.id} className="flex flex-col gap-[18px]">
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Points({ e }: { e: Entry }) {
  const items = e.entries("items");
  return (
    <section className="border-line border-y">
      <ul role="list" className="grid sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-line pw-gutter flex flex-col gap-1.5 border-b py-8 last:border-b-0 sm:border-r sm:even:border-r-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0"
          >
            <span className="font-medium">{item.text("title")}</span>
            <RichText node={item.rich("body")} inline />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LabelSplit({ e }: { e: Entry }) {
  const items = e.entries("items");
  const facts = e.entries("facts");
  return (
    <section className="border-line grid items-center border-t md:grid-cols-2">
      <div className="bg-shelf aspect-square">
        <ShopifyImage image={e.image("image")} sizes="(min-width: 48rem) 50vw, 100vw" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-col gap-7 px-[clamp(20px,6vw,96px)] py-16 md:py-[72px]">
        {e.text("eyebrow") ? <span className="pw-eyebrow">{e.text("eyebrow")}</span> : null}
        {items.length ? (
          <ol className="flex flex-col">
            {items.map((item, i) => (
              <li key={item.id} className="border-line grid grid-cols-[48px_1fr] gap-3 border-t py-[18px] last:border-b">
                <span className="text-muted">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <span className="text-lg">{item.text("title")}</span>
                  <RichText node={item.rich("body")} paragraphClassName="text-muted mt-1 text-sm leading-[1.65]" />
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        {facts.length ? (
          <div className="border-line bg-surface flex flex-col border px-7 py-6">
            {e.text("card_eyebrow") || e.text("card_title") ? (
              <div className="flex justify-between gap-4 pb-3">
                <span className="pw-eyebrow">{e.text("card_eyebrow")}</span>
                <span>{e.text("card_title")}</span>
              </div>
            ) : null}
            {facts.map((fact) => (
              <div key={fact.id} className="border-line flex justify-between gap-4 border-t py-3 last:pb-0">
                <span className="text-muted">{fact.text("title")}</span>
                <RichText node={fact.rich("body")} inline className="text-right" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Accordion({ items, name }: { items: Entry[]; name: string }) {
  return (
    <div className="border-line border-b">
      {items.map((item, index) => (
        <details key={item.id} name={name} open={index === 0} className="group border-line border-t">
          <summary className="marker-hidden flex min-h-14 cursor-pointer items-center justify-between gap-4 text-sm">
            {item.text("title")}
            <span aria-hidden="true" className="w-[18px] text-center text-lg group-open:hidden">
              +
            </span>
            <span aria-hidden="true" className="hidden w-[18px] text-center text-lg group-open:inline">
              −
            </span>
          </summary>
          <RichText node={item.rich("body")} className="text-muted flex max-w-[620px] flex-col gap-3 pb-[22px] text-sm leading-[1.65]" />
        </details>
      ))}
    </div>
  );
}

/** Plain text of a rich text tree, for structured data. */
function plain(node: RichNode | null): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(plain).join(node.type === "root" ? "\n" : "");
}

function Faq({ e }: { e: Entry }) {
  const items = e.entries("items");
  return (
    <section className="pw-gutter border-line grid items-start gap-x-16 gap-y-10 border-t pt-12 pb-28 lg:grid-cols-3">
      <div className="flex flex-col gap-4">
        {e.text("side_eyebrow") ? <span className="pw-eyebrow">{e.text("side_eyebrow")}</span> : null}
        {e.text("side_text") ? <p className="text-muted max-w-[300px] text-[15px] leading-[1.65]">{e.text("side_text")}</p> : null}
        <LinkButton link={e.link("side_link")} className="pw-link self-start" />
      </div>
      <div className="min-w-0 lg:col-span-2">
        <Accordion items={items} name={`faq-${e.handle}`} />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((item) => ({
              "@type": "Question",
              name: item.text("title"),
              acceptedAnswer: { "@type": "Answer", text: plain(item.rich("body")) },
            })),
          }),
        }}
      />
    </section>
  );
}

function Article({ e }: { e: Entry }) {
  return (
    <article className="pw-gutter mx-auto flex max-w-[856px] flex-col gap-12 py-24">
      {e.entries("items").map((item) => (
        <div key={item.id} className="flex flex-col gap-3.5">
          {item.text("title") ? <h2 className="pw-title">{item.text("title")}</h2> : null}
          <RichText node={item.rich("body")} paragraphClassName="text-[17px] leading-[1.75]" className="flex flex-col gap-4" />
        </div>
      ))}
      <LinkButton link={e.link("link")} className="pw-btn pw-btn--primary self-start" />
    </article>
  );
}

function SectionAccordion({ e }: { e: Entry }) {
  return (
    <section className="pw-gutter border-line flex justify-center border-t pt-12 pb-28">
      <div className="w-full max-w-[760px]">
        <Accordion items={e.entries("items")} name={`accordion-${e.handle}`} />
        {e.link("link") ? (
          <div className="pt-7">
            <LinkButton link={e.link("link")} className="pw-link" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

const CONTACT_FIELDS = [
  { id: "contact-name", name: "name", type: "text", autoComplete: "name", max: 100 },
  { id: "contact-email", name: "email", type: "email", autoComplete: "email", max: 254 },
] as const;

function Contact({ e, context }: { e: Entry; context: SectionContext }) {
  const t = useText();
  const navigation = useNavigation();
  const sending = navigation.state === "submitting" && navigation.formData?.get("_action") === "contact";
  const result = context.contactResult;
  const errors = result && !result.ok ? result.errors : {};
  const fieldClass = "!border-ink !h-12 !border-0 !border-b !bg-transparent !px-0 !text-[15px] aria-[invalid=true]:!border-b-2";
  const topics = e.entries("items");

  return (
    <section className="border-line grid items-start border-t md:grid-cols-2">
      <ol className="pw-gutter border-line flex flex-col pt-12 pb-[72px] md:border-r">
        {topics.map((topic, i) => (
          <li key={topic.id} className="border-line grid grid-cols-[48px_1fr] gap-3 border-b py-[18px]">
            <span className="text-muted">{String(i + 1).padStart(2, "0")}</span>
            {topic.rich("body") ? (
              <RichText node={topic.rich("body")} inline linkClassName="pw-hover text-lg" />
            ) : (
              <span className="text-lg">{topic.text("title")}</span>
            )}
          </li>
        ))}
        {context.contactEmail ? (
          <li className="flex flex-col gap-1 pt-7">
            <span className="pw-eyebrow">{t("contact.email_label")}</span>
            <a href={`mailto:${context.contactEmail}`} className="pw-link self-start text-[15px]">
              {context.contactEmail}
            </a>
          </li>
        ) : null}
      </ol>
      {result?.ok ? (
        <div className="pw-gutter flex max-w-[560px] flex-col items-start gap-4 pt-12 pb-[72px]" role="status">
          <span className="pw-eyebrow">{t("contact.sent_eyebrow")}</span>
          <p className="pw-title">{t("contact.sent_title")}</p>
          <p className="pw-lead">{t("contact.sent_body")}</p>
          <RichText node={parseRich(t("contact.sent_link"))} inline />
        </div>
      ) : (
        <Form method="post" preventScrollReset className="pw-gutter relative flex max-w-[560px] flex-col gap-7 pt-12 pb-[72px]" noValidate>
          <input type="hidden" name="_action" value="contact" />
          <FormGuards />
          {CONTACT_FIELDS.map((field) => (
            <div key={field.id} className="flex flex-col gap-1.5">
              <label htmlFor={field.id} className="text-[13px] tracking-[0.02em]">
                {t(`contact.field.${field.name}`)}
              </label>
              <input
                id={field.id}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                required
                maxLength={field.max}
                aria-invalid={errors[field.name] ? true : undefined}
                aria-describedby={errors[field.name] ? `${field.id}-error` : undefined}
                className={fieldClass}
              />
              {errors[field.name] ? (
                <p id={`${field.id}-error`} className="text-[13px]" role="alert">
                  {errors[field.name]}
                </p>
              ) : null}
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-message" className="text-[13px] tracking-[0.02em]">
              {t("contact.field.message")}
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              required
              maxLength={2000}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={errors.message ? "contact-message-error" : undefined}
              className="!border-ink !border-0 !border-b !bg-transparent !px-0 !py-3 !text-[15px] aria-[invalid=true]:!border-b-2"
            />
            {errors.message ? (
              <p id="contact-message-error" className="text-[13px]" role="alert">
                {errors.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-3">
            <button type="submit" disabled={sending} className="pw-btn pw-btn--primary">
              {sending ? t("contact.submitting") : t("contact.submit")}
            </button>
            {errors.form ? (
              <p className="text-[13px]" role="alert">
                {errors.form}
              </p>
            ) : null}
            <RichText node={parseRich(t("contact.privacy_note"))} paragraphClassName="text-muted text-[13px]" linkClassName="underline underline-offset-2" />
          </div>
        </Form>
      )}
    </section>
  );
}

/** Renders a page's or collection's sections, in the order set in Shopify. */
export function Sections({ sections, context = {}, firstIsTitle = true }: { sections: unknown[]; context?: SectionContext; firstIsTitle?: boolean }) {
  const entries = sections.map((raw) => Entry.from(raw)).filter((e): e is Entry => e !== null);
  return (
    <>
      {entries.map((e, i) => {
        const first = firstIsTitle && i === 0;
        switch (e.type) {
          case "pw_hero":
            return <Hero key={e.id} e={e} first={first} />;
          case "pw_statement":
            return <Statement key={e.id} e={e} />;
          case "pw_page_head":
            return <PageHead key={e.id} e={e} first={first} />;
          case "pw_banner":
            return <Banner key={e.id} e={e} first={first} />;
          case "pw_product_grid":
            return <SectionProductGrid key={e.id} e={e} />;
          case "pw_split":
            return <Split key={e.id} e={e} first={first} />;
          case "pw_scent_tiles":
            return <ScentTiles key={e.id} e={e} />;
          case "pw_feature":
            return <Feature key={e.id} e={e} />;
          case "pw_teasers":
            return <Teasers key={e.id} e={e} />;
          case "pw_points":
            return <Points key={e.id} e={e} />;
          case "pw_label_split":
            return <LabelSplit key={e.id} e={e} />;
          case "pw_faq":
            return <Faq key={e.id} e={e} />;
          case "pw_article":
            return <Article key={e.id} e={e} />;
          case "pw_accordion":
            return <SectionAccordion key={e.id} e={e} />;
          case "pw_contact":
            return <Contact key={e.id} e={e} context={context} />;
          case "pw_routine_finder":
            return context.routine ? <RoutineFinder key={e.id} section={e} data={context.routine} /> : null;
          default:
            return null;
        }
      })}
    </>
  );
}

/** The first image of a page's sections, for preloading the LCP image. */
export function leadImage(sections: unknown[]) {
  const first = Entry.from(sections[0]);
  if (!first) return null;
  return first.image("image") ?? first.image("household_image");
}
