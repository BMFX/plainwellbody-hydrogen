import { Cache, gql } from "@shopify/hydrogen";
import { Link } from "react-router";

import { Media, mediaPreload } from "~/components/Media";
import {
  cardFromProduct,
  PRODUCT_CARD_FRAGMENT,
  ProductGrid,
  type ProductCardData,
} from "~/components/ProductCard";
import { wholePrice } from "~/lib/money";
import { CONCEPT_PRODUCTS, PLAINWELL_COLLECTION } from "~/lib/plainwell";
import { storefrontClientContext } from "~/lib/storefront";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/home";

const HERO = "campaign-citrus-bathhouse";
const HERO_SIZES = "100vw";

const HOME_QUERY = gql(
  `
    query PlainwellHome($collection: String!) {
      collection(handle: $collection) {
        products(first: 100) {
          nodes {
            ...ProductCard
          }
        }
      }
    }
  `,
  [PRODUCT_CARD_FRAGMENT],
);

const ESSENTIALS = ["citrus-body-lotion", "cedar-body-wash", "unscented-hand-wash", "citrus-hand-balm"];
const HOUSEHOLD_ROUTINE = [
  { handle: "citrus-body-wash", label: "Citrus Body Wash" },
  { handle: "fresh-deodorant", label: "Fresh Deodorant, 3 pack" },
  { handle: "cedar-shave-gel", label: "Cedar Shave Gel" },
  { handle: "travel-body-wash", label: "Travel Body Wash" },
];

const SCENT_TILES = [
  {
    name: "Citrus",
    note: "Bright · clean · morning",
    image: "campaign-citrus-ritual",
    alt: "Hands under a pump of Citrus Hand Wash beside halved oranges",
    href: "/collections/all?scent=citrus",
  },
  {
    name: "Cedar",
    note: "Warm · woody · evening",
    image: "campaign-cedar-ritual",
    alt: "Cedar Body Wash lathered on an arm over wet stone",
    href: "/collections/all?scent=cedar",
  },
  {
    name: "Unscented",
    note: "Nothing extra · anytime",
    image: "campaign-unscented-ritual",
    alt: "Unscented Hand Balm squeezed onto the back of a hand",
    href: "/collections/all?scent=unscented",
  },
  {
    name: "Lavender",
    note: "Coming soon",
    image: "campaign-lavender-ritual",
    alt: "Lavender Body Lotion smoothed onto an arm beside sprigs of lavender",
    href: "/collections/lavender",
  },
];

const BRAND_POINTS = [
  ["Plant-based personal care", "Printed plainly on every label."],
  ["Sizes for home and away", "Full bottles and 3 fl oz travel sizes."],
  ["Complimentary shipping", "On US orders over $50."],
  ["Your bag, your way", "Change any quantity before checkout."],
];

const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function countInWords(n: number) {
  if (n < 20) return WORDS[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${WORDS[n % 10]}` : "");
  return String(n);
}

export const links: Route.LinksFunction = () => [mediaPreload(HERO, HERO_SIZES)];

export function meta({ matches }: Route.MetaArgs) {
  const shopName = getShopNameFromRootMatch(matches[0]);
  const description =
    "Everyday body care for the people who share your bathroom: body wash, lotion, hand care, deodorant, shave and travel sizes in citrus, cedar and unscented.";
  return [
    { title: formatPageTitle("Keep it plain. Make it well.", shopName) },
    { name: "description", content: description },
    { property: "og:title", content: shopName },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const storefrontClient = context.get(storefrontClientContext);
  const { data, errors } = await storefrontClient.graphql(HOME_QUERY, {
    variables: { collection: PLAINWELL_COLLECTION },
    cache: Cache.short(),
  });
  if (errors?.length) console.error(`Home query failed: ${errors.map((e) => e.message).join("; ")}`);

  const products: ProductCardData[] = data?.collection?.products.nodes ?? [];
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  const essentials = ESSENTIALS.flatMap((h) => byHandle.get(h) ?? []).map(cardFromProduct);

  const routine = HOUSEHOLD_ROUTINE.flatMap(({ handle, label }) => {
    const price = byHandle.get(handle)?.selectedOrFirstAvailableVariant?.price;
    return price ? [{ handle, label, price }] : [];
  });
  // List prices from the Storefront API; the bag shows Shopify's own totals.
  const routineCents = routine.reduce((sum, item) => sum + Math.round(Number(item.price.amount) * 100), 0);
  const routineTotal = routine[0]
    ? { amount: (routineCents / 100).toFixed(2), currencyCode: routine[0].price.currencyCode }
    : null;

  return {
    essentials,
    liveCount: products.length,
    comingSoonCount: CONCEPT_PRODUCTS.length,
    routine: routine.length === HOUSEHOLD_ROUTINE.length ? routine : [],
    routineTotal,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { essentials, liveCount, routine, routineTotal } = loaderData;
  const count = countInWords(liveCount);

  return (
    <main className="flex-1" id="main-content" tabIndex={-1}>
      <section className="bg-olive relative h-[560px] overflow-hidden md:h-[760px]">
        <Media
          name={HERO}
          alt="Citrus Body Wash on a wet stone ledge beside halved lemons in morning light"
          sizes={HERO_SIZES}
          width={1672}
          height={941}
          priority
          className="absolute inset-0 h-full w-full object-cover object-[78%_50%] md:object-[62%_50%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,22,18,0.62)_0%,rgba(20,22,18,0.28)_42%,rgba(20,22,18,0)_64%)] max-md:bg-[linear-gradient(0deg,rgba(20,22,18,0.62)_0%,rgba(20,22,18,0.2)_55%,rgba(20,22,18,0)_80%)]"
        />
        <div className="pw-gutter absolute inset-x-0 bottom-12 flex max-w-[640px] flex-col gap-5 text-white md:bottom-16">
          <span className="text-xs tracking-[0.14em]">CITRUS BODY WASH · 16 FL OZ</span>
          <h1 className="pw-display-xl">
            Keep it plain.
            <br />
            Make it well.
          </h1>
          <p className="max-w-[420px] text-base leading-relaxed text-[#f1eee6]">
            Body care for the people who share your bathroom. Bright and clean, made to be reached for every
            morning.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/products/citrus-body-wash" className="pw-btn pw-btn--light">
              Discover citrus
            </Link>
            <Link to="/collections/all" className="pw-btn pw-btn--outline-light">
              Shop all
            </Link>
          </div>
        </div>
      </section>

      <section className="pw-gutter flex flex-col items-center gap-7 pt-24 pb-24 text-center md:pt-[120px] md:pb-28">
        <span className="pw-eyebrow">Plainwell Body Co.</span>
        <p className="pw-statement max-w-[880px]">
          {count.charAt(0).toUpperCase() + count.slice(1)} essentials for body, hands and travel, in three scent
          families: citrus, cedar and unscented. Each made to sit plainly on a shared shelf and be used every day.
        </p>
        <Link to="/pages/our-story" className="pw-link">
          Our story
        </Link>
      </section>

      {essentials.length ? (
        <section className="border-line border-t" aria-labelledby="essentials-heading">
          <div className="pw-gutter flex items-baseline justify-between gap-4 py-[22px]">
            <h2 id="essentials-heading" className="pw-section-label">
              The essentials
            </h2>
            <Link to="/collections/all" className="pw-link">
              Shop all {liveCount}
            </Link>
          </div>
          <ProductGrid items={essentials} />
        </section>
      ) : null}

      <section className="bg-olive text-paper grid md:grid-cols-2">
        <Media
          name="campaign-everyday-ritual"
          alt="Hands lathering under water at a green stone basin"
          sizes="(min-width: 48rem) 50vw, 100vw"
          width={1024}
          height={1536}
          className="block h-[420px] w-full object-cover md:h-full md:max-h-[860px] md:min-h-[720px]"
        />
        <div className="flex flex-col justify-center gap-6 px-[clamp(28px,7vw,120px)] py-16 md:py-20">
          <span className="pw-eyebrow text-on-olive">The daily ritual</span>
          <h2 className="pw-display-lg">
            Wash. Rinse.
            <br />
            Begin again.
          </h2>
          <p className="text-on-olive max-w-[420px] text-base leading-[1.7]">
            A routine for the shared bathroom: body wash in the morning, hand wash by the sink, a balm before
            bed. Tell us who it’s for and which scent you like, and we’ll show every item and quantity before
            anything goes in your bag.
          </p>
          <Link to="/pages/routine" className="pw-btn self-start border-[rgb(246_244_239/0.7)]">
            Find your routine
          </Link>
        </div>
      </section>

      <section className="pw-gutter flex flex-col gap-10 pt-24 md:pt-28">
        <div className="grid items-end gap-x-16 gap-y-5 md:grid-cols-2">
          <h2 className="pw-h2">
            Three scent families.
            <br />
            One for every shelf.
          </h2>
          <p className="text-muted max-w-[460px] text-[15px] leading-[1.7]">
            Each family runs across the range, from body wash to travel sizes, so everyone sharing a bathroom can
            keep to the one that feels like theirs.
          </p>
        </div>
      </section>
      <section className="pw-gutter pt-10 pb-24 md:pb-[120px]">
        <ul role="list" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SCENT_TILES.map((tile) => (
            <li key={tile.name}>
              <Link to={tile.href} className="group flex flex-col gap-[18px]">
                <div className="bg-olive aspect-[4/5] overflow-hidden">
                  <Media
                    name={tile.image}
                    alt={tile.alt}
                    sizes="(min-width: 64rem) 25vw, 50vw"
                    width={1254}
                    height={1254}
                    className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]"
                  />
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

      {routine.length && routineTotal ? (
        <section className="bg-olive relative overflow-hidden md:h-[680px]">
          <Media
            name="campaign-product-family"
            alt="Citrus Body Wash, Fresh Deodorant, Cedar Shave Gel and Travel Body Wash on a stone shelf"
            sizes="100vw"
            width={1400}
            height={933}
            className="block h-[320px] w-full object-cover md:absolute md:inset-0 md:h-full"
          />
          <div className="bg-paper relative flex flex-col gap-3.5 p-8 md:absolute md:right-[var(--spacing-gutter)] md:bottom-12 md:w-[400px]">
            <span className="pw-eyebrow">The household routine</span>
            <h2 className="pw-title">Four essentials for two.</h2>
            <ul role="list" className="border-line flex flex-col border-t">
              {routine.map((item) => (
                <li key={item.handle} className="border-line flex justify-between border-b py-[9px]">
                  <Link to={`/products/${item.handle}`} className="pw-hover">
                    {item.label}
                  </Link>
                  <span className="text-muted">{wholePrice(item.price)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-4 pt-1.5">
              <span className="text-lg">{wholePrice(routineTotal)}</span>
              <Link to="/pages/routine" className="pw-btn pw-btn--primary h-11 px-[22px]">
                View the routine
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="pw-gutter flex flex-col gap-9 py-24 md:py-28">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="pw-section-label">Journal</h2>
          <Link to="/pages/journal" className="pw-link">
            All notes
          </Link>
        </div>
        <div className="grid gap-x-4 gap-y-12 md:grid-cols-2">
          <Link to="/pages/shared-bathroom-routine" className="group flex flex-col gap-[18px]">
            <div className="aspect-[3/2] overflow-hidden">
              <Media
                name="campaign-hands-detail"
                alt="Hands lathering under running water"
                sizes="(min-width: 48rem) 50vw, 100vw"
                width={1080}
                height={1080}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="pw-eyebrow">Shared spaces</span>
            <span className="text-2xl leading-tight tracking-[-0.015em]">A routine for the two of you</span>
            <span className="text-muted">Fewer decisions. A shelf that works for everyone.</span>
          </Link>
          <Link to="/pages/journal" className="group flex flex-col gap-[18px]">
            <div className="aspect-[3/2] overflow-hidden">
              <Media
                name="campaign-lemon-detail"
                alt="A halved lemon with leaves on wet stone"
                sizes="(min-width: 48rem) 50vw, 100vw"
                width={1080}
                height={750}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="pw-eyebrow">Small daily choices</span>
            <span className="text-2xl leading-tight tracking-[-0.015em]">Find your morning scent</span>
            <span className="text-muted">A little bright, a little warm, or nothing extra.</span>
          </Link>
        </div>
      </section>

      <section className="border-line border-y">
        <ul role="list" className="grid sm:grid-cols-2 lg:grid-cols-4">
          {BRAND_POINTS.map(([title, body]) => (
            <li
              key={title}
              className="border-line pw-gutter flex flex-col gap-1.5 border-b py-8 last:border-b-0 sm:border-r sm:even:border-r-0 lg:border-b-0 lg:even:border-r lg:last:border-r-0"
            >
              <span className="font-medium">{title}</span>
              <span className="text-muted">{body}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
