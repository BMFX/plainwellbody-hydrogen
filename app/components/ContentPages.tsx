import type { ReactNode } from "react";
import { Form, Link, useNavigation } from "react-router";

import { FormGuards } from "~/components/FormGuards";

import { Media } from "~/components/Media";
import { ProductGrid, type CardItem } from "~/components/ProductCard";
import { RoutineBlock } from "~/components/RoutineBlock";
import { shopifyImageUrl, shopifySrcSet } from "~/lib/images";
import type { FormResult } from "~/lib/forms";
import { FREE_SHIPPING_THRESHOLD } from "~/lib/plainwell";
import type { PolicyLink } from "~/lib/policies";

// Plainwell's editorial pages, from the approved refined designs on the Claude Design
// canvas. The copy is the design copy; anything not yet written (ingredients, returns,
// terms, the care email) stays a visible placeholder in [brackets].

export type ContentData = {
  /** Cards for the products a page features. */
  products: CardItem[];
  /** Shopify's legal policies that exist (Settings › Policies). */
  policies?: Record<"privacy" | "refund" | "shipping" | "terms", PolicyLink | null> | null;
  /** The store's customer email (Settings › Store details), via the Admin API. */
  contactEmail?: string | null;
  /** Whether the contact form can save messages (Admin API token set). */
  contactReady?: boolean;
  contactResult?: FormResult<"name" | "email" | "message"> | null;
};

function SectionHead({ eyebrow, title, intro, children }: { eyebrow: string; title: ReactNode; intro?: string; children?: ReactNode }) {
  return (
    <section className="pw-gutter grid items-end gap-x-16 gap-y-6 pt-14 pb-10 md:grid-cols-2 md:pt-[72px]">
      <div className="flex flex-col gap-4">
        <span className="pw-eyebrow">{eyebrow}</span>
        <h1 className="pw-h1">{title}</h1>
      </div>
      {intro ? (
        <div className="flex flex-col items-start gap-[18px]">
          <p className="pw-lead">{intro}</p>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function Accordion({ items, name }: { items: { title: string; body: ReactNode }[]; name: string }) {
  return (
    <div className="border-line border-b">
      {items.map((item, index) => (
        <details key={item.title} name={name} open={index === 0} className="group border-line border-t">
          <summary className="marker-hidden flex min-h-14 cursor-pointer items-center justify-between gap-4 text-sm">
            {item.title}
            <span aria-hidden="true" className="w-[18px] text-center text-lg group-open:hidden">
              +
            </span>
            <span aria-hidden="true" className="hidden w-[18px] text-center text-lg group-open:inline">
              −
            </span>
          </summary>
          <div className="text-muted max-w-[620px] pb-[22px] text-sm leading-[1.65]">{item.body}</div>
        </details>
      ))}
    </div>
  );
}

const SCENT_TILES = [
  { name: "Citrus", note: "Bright · clean · morning", image: "campaign-citrus-ritual", alt: "Hands under a pump of Citrus Hand Wash beside halved oranges", href: "/collections/all?scent=citrus" },
  { name: "Cedar", note: "Warm · woody · evening", image: "campaign-cedar-ritual", alt: "Cedar Body Wash lathered on an arm over wet stone", href: "/collections/all?scent=cedar" },
  { name: "Unscented", note: "Nothing extra · anytime", image: "campaign-unscented-ritual", alt: "Unscented Hand Balm squeezed onto the back of a hand", href: "/collections/all?scent=unscented" },
  { name: "Lavender", note: "Coming soon", image: "campaign-lavender-ritual", alt: "Lavender Body Lotion smoothed onto an arm beside sprigs of lavender", href: "/collections/lavender" },
];

function OurStory() {
  return (
    <>
      <section className="bg-olive relative h-[520px] overflow-hidden md:h-[640px]">
        <Media
          name="campaign-botanical-bathhouse"
          alt="Cedar Body Wash on a wet stone ledge in green morning light"
          sizes="100vw"
          width={1672}
          height={941}
          priority
          className="absolute inset-0 h-full w-full object-cover object-[70%_50%] md:object-center"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,22,18,0.62)_0%,rgba(20,22,18,0.25)_45%,rgba(20,22,18,0)_65%)]" />
        <div className="pw-gutter absolute inset-x-0 bottom-16 flex max-w-[640px] flex-col gap-5 text-white">
          <span className="text-xs tracking-[0.14em]">OUR STORY</span>
          <h1 className="pw-display-xl">
            Keep it plain.
            <br />
            Make it well.
          </h1>
        </div>
      </section>
      <section className="pw-gutter flex flex-col items-center gap-6 py-24 text-center md:pt-[120px] md:pb-28">
        <p className="pw-statement max-w-[880px]">
          We believe the small things you reach for every day deserve a little thought.
        </p>
      </section>
      <section className="border-line grid border-t md:grid-cols-2">
        <Media
          name="campaign-everyday-ritual"
          alt="Hands lathering under water at a green stone basin"
          sizes="(min-width: 48rem) 50vw, 100vw"
          width={1024}
          height={1536}
          className="block h-[420px] w-full object-cover md:h-full md:max-h-[760px] md:min-h-[640px]"
        />
        <div className="flex flex-col justify-center gap-6 px-[clamp(28px,7vw,120px)] py-16 md:py-20">
          <h2 className="pw-h2">Care that feels at home.</h2>
          <p className="max-w-[460px] text-base leading-[1.7]">
            Plainwell starts with the everyday: a morning shower, freshly washed hands, a shared bathroom shelf.
            Essentials that fit into your life, with scents and sizes you can choose for yourself.
          </p>
          <p className="max-w-[460px] text-base leading-[1.7]">
            Our idea is simple. Make room for useful things. Keep routines clear. Let small choices add up.
          </p>
          <Link to="/collections/all" className="pw-btn pw-btn--primary self-start">
            Meet your essentials
          </Link>
        </div>
      </section>
      <section className="pw-gutter flex flex-col gap-10 pt-28 pb-[120px]">
        <h2 className="pw-h2">Choose by the plant on the label.</h2>
        <ul role="list" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SCENT_TILES.map((tile) => (
            <li key={tile.name}>
              <Link to={tile.href} className="flex flex-col gap-[18px]">
                <div className="bg-olive aspect-[4/5] overflow-hidden">
                  <Media name={tile.image} alt={tile.alt} sizes="(min-width: 64rem) 25vw, 50vw" width={1254} height={1254} className="h-full w-full object-cover" />
                </div>
                <div className="border-ink flex flex-wrap items-baseline justify-between gap-x-3 border-t pt-3.5">
                  <span className="pw-heading">{tile.name}</span>
                  <span className="text-muted">{tile.note}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Ingredients({ data }: { data: ContentData }) {
  const bodyWash = data.products.find((p) => p.handle === "citrus-body-wash")?.live?.featuredImage;
  const steps = [
    ["Clear product details", "Product pages bring size, scent, and ingredient information together."],
    ["Your scent, your choice", "Citrus, cedar, or unscented, with lavender on the way. Start with the family that feels right. The botanical on the label shows which is which."],
    ["A routine you can adjust", "Choose individual essentials and change quantities to fit your household."],
  ];
  const facts = [
    ["Size", "16 fl oz (473 mL)", false],
    ["On the label", "Plant-based personal care", false],
    ["Key ingredients", "[Ingredient list to confirm]", true],
    ["Made without", "[Exclusions to confirm]", true],
  ] as const;
  return (
    <>
      <SectionHead
        eyebrow="Our ingredient approach"
        title={
          <>
            Know your
            <br />
            everyday care.
          </>
        }
        intro="Thoughtful choices start with clear information. Explore each product’s details and choose what works for your routine."
      />
      <section className="border-line grid items-center border-t md:grid-cols-2">
        <div className="bg-shelf aspect-square">
          {bodyWash ? (
            <img
              src={shopifyImageUrl(bodyWash.url, 900)}
              srcSet={shopifySrcSet(bodyWash.url, [480, 720, 960, 1200])}
              sizes="(min-width: 48rem) 50vw, 100vw"
              alt="Citrus Body Wash in an amber pump bottle with a cream label"
              width={1000}
              height={1000}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-7 px-[clamp(20px,6vw,96px)] py-16 md:py-[72px]">
          <span className="pw-eyebrow">Read the label</span>
          <ol className="flex flex-col">
            {steps.map(([title, body], i) => (
              <li key={title} className="border-line grid grid-cols-[48px_1fr] gap-3 border-t py-[18px] last:border-b">
                <span className="text-muted">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <span className="text-lg">{title}</span>
                  <p className="text-muted mt-1 text-sm leading-[1.65]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="border-line bg-surface flex flex-col border px-7 py-6">
            <div className="flex justify-between gap-4 pb-3">
              <span className="pw-eyebrow">Inside the bottle</span>
              <span>Citrus Body Wash</span>
            </div>
            {facts.map(([label, value, placeholder]) => (
              <div key={label} className="border-line flex justify-between gap-4 border-t py-3 last:pb-0">
                <span className="text-muted">{label}</span>
                <span className={`text-right ${placeholder ? "text-muted" : ""}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="pw-gutter flex flex-col items-center gap-6 pt-28 text-center">
        <p className="pw-statement max-w-[820px]">
          Product-specific ingredient lists appear on each product page once the formulas are final.
        </p>
        <Link to="/collections/all" className="pw-link">
          Shop all essentials
        </Link>
      </section>
      <RoutineBlock />
    </>
  );
}

function Journal() {
  return (
    <>
      <SectionHead
        eyebrow="The Plainwell journal"
        title={
          <>
            Notes for
            <br />
            the everyday.
          </>
        }
        intro="A little thought for the routines we come back to."
      />
      <section className="border-line grid border-t md:grid-cols-2">
        <Link to="/pages/shared-bathroom-routine" className="block">
          <Media
            name="campaign-citrus-ritual"
            alt="Hands under a pump of Citrus Hand Wash beside halved oranges"
            sizes="(min-width: 48rem) 50vw, 100vw"
            width={1254}
            height={1254}
            priority
            className="block h-[420px] w-full object-cover md:h-[640px]"
          />
        </Link>
        <div className="flex flex-col justify-center gap-5 px-[clamp(20px,7vw,120px)] py-16 md:py-[72px]">
          <span className="pw-eyebrow">Shared spaces · Everyday routines</span>
          <h2 className="pw-h2">
            <Link to="/pages/shared-bathroom-routine" className="pw-hover">
              A routine for the two of you.
            </Link>
          </h2>
          <p className="text-muted max-w-[440px] text-base leading-[1.7]">
            A practical place to start when your bathroom shelf belongs to more than one person.
          </p>
          <Link to="/pages/shared-bathroom-routine" className="pw-link self-start">
            Read the note
          </Link>
        </div>
      </section>
      <section className="pw-gutter grid gap-4 pt-24 pb-28 md:grid-cols-2">
        <Link to="/pages/routine" className="flex flex-col gap-4">
          <Media
            name="campaign-unscented-ritual"
            alt="Unscented Hand Balm squeezed onto the back of a hand"
            sizes="(min-width: 48rem) 50vw, 100vw"
            width={1254}
            height={1254}
            className="block aspect-[3/2] w-full object-cover"
          />
          <span className="pw-eyebrow">Small daily choices</span>
          <span className="pw-heading">Find your morning scent</span>
          <span className="text-muted">A little bright, a little warm, or nothing extra.</span>
        </Link>
        <div className="border-line flex min-h-[280px] flex-col justify-end gap-3 border p-8">
          <span className="pw-eyebrow">More notes</span>
          <span className="pw-heading text-muted">[Further journal entries to come]</span>
        </div>
      </section>
    </>
  );
}

function SharedRoutineArticle({ data }: { data: ContentData }) {
  const sections = [
    ["Start with the everyday.", "A wash, a deodorant, a shave essential. Think about what gets used often and how many people share it. Choose quantities first; extras can come later."],
    ["Find your common ground.", "A bright citrus morning or a warm cedar evening. If scent isn’t your thing, start with unscented. A shared routine should still leave room for personal choices."],
    ["Keep the list clear.", "Our finder shows every product, quantity and price before your routine joins the cart. Change anything before checkout."],
  ];
  return (
    <>
      <section className="pw-gutter flex flex-col items-center gap-5 pt-14 pb-12 text-center md:pt-[72px]">
        <span className="pw-eyebrow">Journal · Shared spaces</span>
        <h1 className="pw-h1 max-w-[760px]">
          A routine for
          <br />
          the two of you.
        </h1>
        <p className="text-muted max-w-[620px] text-lg leading-[1.6]">
          A shared shelf can be simple. Start with what you both reach for, then leave room for your own
          preferences.
        </p>
      </section>
      <Media
        name="campaign-citrus-ritual"
        alt="Hands under a pump of Citrus Hand Wash beside halved oranges"
        sizes="100vw"
        width={1254}
        height={1254}
        priority
        className="block h-[380px] w-full object-cover md:h-[620px]"
      />
      <article className="pw-gutter mx-auto flex max-w-[856px] flex-col gap-12 py-24 md:max-w-[856px]">
        {sections.map(([title, body]) => (
          <div key={title} className="flex flex-col gap-3.5">
            <h2 className="pw-title">{title}</h2>
            <p className="text-[17px] leading-[1.75]">{body}</p>
          </div>
        ))}
        <Link to="/pages/routine" className="pw-btn pw-btn--primary self-start">
          Find your routine
        </Link>
      </article>
      {data.products.length ? (
        <section className="border-line border-t pb-28">
          <div className="pw-gutter flex items-baseline justify-between py-[22px]">
            <h2 className="pw-section-label">The routine for two, citrus</h2>
            <Link to="/pages/routine?step=3&household=2&scent=citrus&travel=1" className="pw-link">
              See the routine
            </Link>
          </div>
          <ProductGrid items={data.products} />
        </section>
      ) : null}
    </>
  );
}

const FAQS = [
  ["How does the routine finder work?", "Choose household size and a scent family. Review the individual essentials and their quantities before opening your cart."],
  ["Can I change my routine?", "Yes. Every product is a normal cart item. Adjust quantities or remove an item before checkout."],
  ["Will it replace items already in my cart?", "The routine keeps existing cart items and adds the selected essentials alongside them."],
  ["What scents can I choose?", "Citrus, cedar, and unscented guide the range, with lavender coming soon. Check each product page for available options."],
  ["Where can I see product ingredients?", "Product-specific ingredient information belongs on each product page once the formula is finalized."],
  ["When are body wash refills available?", "Refills are coming soon. Prices and availability are still to come."],
];

function Faq() {
  return (
    <>
      <SectionHead eyebrow="Customer care" title="A little help." intro="Good questions, plain answers." />
      <section className="pw-gutter border-line grid items-start gap-x-16 gap-y-10 border-t pt-12 pb-28 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <span className="pw-eyebrow">Still stuck?</span>
          <p className="text-muted max-w-[300px] text-[15px] leading-[1.65]">
            Tell us what’s on your mind. For an order question, include your order number.
          </p>
          <Link to="/pages/contact" className="pw-link self-start">
            Contact customer care
          </Link>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Accordion name="faq" items={FAQS.map(([title, body]) => ({ title, body }))} />
        </div>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
          }),
        }}
      />
    </>
  );
}

const CONTACT_FIELDS = [
  { id: "contact-name", name: "name", label: "Name", type: "text", autoComplete: "name" },
  { id: "contact-email", name: "email", label: "Email", type: "email", autoComplete: "email" },
] as const;

function Contact({ data }: { data: ContentData }) {
  const navigation = useNavigation();
  const sending = navigation.state === "submitting" && navigation.formAction?.startsWith("/pages/contact");
  const result = data.contactResult;
  const errors = result && !result.ok ? result.errors : {};
  const sent = result?.ok;
  const fieldClass = "!border-ink !h-12 !border-0 !border-b !bg-transparent !px-0 !text-[15px] aria-[invalid=true]:!border-b-2";

  return (
    <>
      <SectionHead
        eyebrow="Here to help"
        title={
          <>
            We’re here
            <br />
            to help.
          </>
        }
        intro="Tell us what’s on your mind. For an order question, include your order number."
      />
      <section className="border-line grid items-start border-t md:grid-cols-2">
        <ol className="pw-gutter border-line flex flex-col pt-12 pb-[72px] md:border-r">
          {["Questions about products or scents?", "Need a hand with an order?"].map((text, i) => (
            <li key={text} className="border-line grid grid-cols-[48px_1fr] gap-3 border-b py-[18px]">
              <span className="text-muted">0{i + 1}</span>
              <span className="text-lg">{text}</span>
            </li>
          ))}
          <li className="border-line grid grid-cols-[48px_1fr] gap-3 border-b py-[18px]">
            <span className="text-muted">03</span>
            <Link to="/pages/faq" className="pw-hover text-lg">
              Explore our FAQs first →
            </Link>
          </li>
          <li className="flex flex-col gap-1 pt-7">
            <span className="pw-eyebrow">Email</span>
            {data.contactEmail ? (
              <a href={`mailto:${data.contactEmail}`} className="pw-link self-start text-[15px]">
                {data.contactEmail}
              </a>
            ) : (
              <span className="text-muted">[Customer care email to confirm]</span>
            )}
          </li>
        </ol>
        {sent ? (
          <div className="pw-gutter flex max-w-[560px] flex-col items-start gap-4 pt-12 pb-[72px]" role="status">
            <span className="pw-eyebrow">Message sent</span>
            <p className="pw-title">Thank you. We’ll be in touch.</p>
            <p className="pw-lead">We read every message and reply by email.</p>
            <Link to="/collections/all" className="pw-link">
              Back to the shelf
            </Link>
          </div>
        ) : (
          <Form method="post" preventScrollReset className="pw-gutter relative flex max-w-[560px] flex-col gap-7 pt-12 pb-[72px]" noValidate>
            <FormGuards />
            {CONTACT_FIELDS.map((field) => (
              <div key={field.id} className="flex flex-col gap-1.5">
                <label htmlFor={field.id} className="text-[13px] tracking-[0.02em]">
                  {field.label}
                </label>
                <input
                  id={field.id}
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  required
                  maxLength={field.name === "name" ? 100 : 254}
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
                Message
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
                {sending ? "Sending…" : "Send message"}
              </button>
              {errors.form ? (
                <p className="text-[13px]" role="alert">
                  {errors.form}
                </p>
              ) : null}
              <p className="text-muted text-[13px]">
                {data.contactReady ? (
                  <>
                    We use your details only to reply. See our{" "}
                    <Link to="/policies/privacy-policy" className="underline underline-offset-2">
                      privacy policy
                    </Link>
                    .
                  </>
                ) : (
                  "[Contact form delivery to connect before launch]"
                )}
              </p>
            </div>
          </Form>
        )}
      </section>
    </>
  );
}

function PolicyNote({ policy, missing }: { policy?: PolicyLink | null; missing: string }) {
  if (!policy) return <>{missing}</>;
  return (
    <>
      Read the full{" "}
      <Link to={`/policies/${policy.handle}`} className="pw-link">
        {policy.title.toLowerCase()}
      </Link>
      .
    </>
  );
}

function ShippingReturns({ data }: { data: ContentData }) {
  const policies = data.policies;
  return (
    <>
      <SectionHead
        eyebrow="Customer care"
        title={
          <>
            The everyday
            <br />
            details.
          </>
        }
        intro="Shipping, returns, and the information behind your order."
      />
      <section className="pw-gutter border-line flex justify-center border-t pt-12 pb-28">
        <div className="w-full max-w-[760px]">
          <Accordion
            name="policies"
            items={[
              {
                title: "Shipping",
                body: (
                  <>
                    Standard US shipping is complimentary on orders of ${FREE_SHIPPING_THRESHOLD} or more. Below $
                    {FREE_SHIPPING_THRESHOLD}, standard US shipping is $8. Other delivery options and international rates
                    are shown at checkout.
                    {policies?.shipping ? (
                      <>
                        {" "}
                        <PolicyNote policy={policies.shipping} missing="" />
                      </>
                    ) : null}
                  </>
                ),
              },
              {
                title: "Returns",
                body: <PolicyNote policy={policies?.refund} missing="[Returns window and eligibility to confirm before launch]" />,
              },
              {
                title: "Privacy",
                body: (
                  <>
                    This is a fictional Plainwell demo storefront. <PolicyNote policy={policies?.privacy} missing="" />
                  </>
                ),
              },
              {
                title: "Terms",
                body: <PolicyNote policy={policies?.terms} missing="[Terms of service to confirm before a public launch]" />,
              },
            ]}
          />
          <div className="pt-7">
            <Link to="/pages/contact" className="pw-link">
              Contact customer care
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Terms() {
  return (
    <>
      <SectionHead eyebrow="Customer care" title="Terms" intro="The terms that apply to orders from this store." />
      <section className="pw-gutter border-line border-t pt-12 pb-28">
        <p className="text-muted max-w-[620px] text-base">[Terms of service to confirm before a public launch]</p>
      </section>
    </>
  );
}

type ContentPage = {
  component: (props: { data: ContentData }) => ReactNode;
  /** Meta description, used when the Shopify page has no SEO description. */
  description: string;
  products?: string[];
  /** Load links to Shopify's policies. */
  policies?: boolean;
};

export const CONTENT_PAGES: Record<string, ContentPage> = {
  "our-story": {
    component: OurStory,
    description: "Keep it plain. Make it well. Plainwell makes everyday body care for the people who share your bathroom.",
  },
  ingredients: {
    component: Ingredients,
    description: "Our ingredient approach: clear product details, your choice of scent, and a routine you can adjust.",
    products: ["citrus-body-wash"],
  },
  journal: { component: Journal, description: "Notes for the everyday: a little thought for the routines we come back to." },
  "shared-bathroom-routine": {
    component: SharedRoutineArticle,
    description: "A shared shelf can be simple. Start with what you both reach for, then leave room for your own preferences.",
    products: ["citrus-body-wash", "fresh-deodorant", "cedar-shave-gel", "travel-body-wash"],
  },
  faq: { component: Faq, description: "Good questions, plain answers: the routine finder, scents, ingredients and refills." },
  contact: { component: Contact, description: "Questions about products, scents or an order? Get in touch with Plainwell customer care." },
  "shipping-returns": {
    component: ShippingReturns,
    policies: true,
    description: `Shipping, returns and the details behind your order. Complimentary US shipping on orders over $${FREE_SHIPPING_THRESHOLD}.`,
  },
  terms: { component: Terms, policies: true, description: "The terms that apply to orders from Plainwell Body Co." },
};
