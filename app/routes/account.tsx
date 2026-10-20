import { gql } from "@shopify/hydrogen/customer-account";
import { Link, useNavigation } from "react-router";

import { customerAccountContext } from "~/lib/customer-account";
import { formatPrice } from "~/lib/money";

import { rootSeo, seoMeta } from "~/lib/seo";
import { useText } from "~/lib/text";

import type { Route } from "./+types/account";

const ORDERS_PAGE_SIZE = 10;

const ACCOUNT_QUERY = gql(`
  query AccountPage($first: Int, $after: String, $last: Int, $before: String) {
    customer {
      firstName
      lastName
      emailAddress {
        emailAddress
      }
      orders(
        first: $first
        after: $after
        last: $last
        before: $before
        sortKey: PROCESSED_AT
        reverse: true
      ) {
        nodes {
          id
          name
          processedAt
          financialStatus
          statusPageUrl
          totalPrice {
            amount
            currencyCode
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  }
`);

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });


export function meta({ matches }: Route.MetaArgs) {
  const text = rootSeo(matches[0]).content?.text ?? {};
  return seoMeta(matches[0], {
    title: text["seo.account_title"] ?? "",
    description: text["seo.account_description"] ?? null,
    path: "/account",
    noindex: true,
  });
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const customerAccount = context.get(customerAccountContext);
  if (!customerAccount) return { status: "unavailable" } as const;

  const { client, session, sessionManager, requestContext } = customerAccount;
  // Reading the token marks the response as personalized, so it is never cached.
  const accessToken = await session.getOrRefreshAccessToken(sessionManager, requestContext);
  const searchParams = new URL(request.url).searchParams;
  if (!accessToken) {
    return { status: "signed-out", loginFailed: searchParams.get("login") === "failed" } as const;
  }

  const before = searchParams.get("before");
  const variables = before
    ? { last: ORDERS_PAGE_SIZE, before }
    : { first: ORDERS_PAGE_SIZE, after: searchParams.get("after") };

  try {
    const { data, errors } = await client.graphql(ACCOUNT_QUERY, { accessToken, variables });
    if (errors || !data.customer) {
      if (errors?.length) console.error(errors.map((e) => e.message).join("; "));
      return { status: "error" } as const;
    }
    return { status: "signed-in", customer: data.customer } as const;
  } catch (error) {
    console.error(error);
    return { status: "error" } as const;
  }
}

export default function AccountRoute({ loaderData }: Route.ComponentProps) {
  const t = useText();
  return (
    <main id="main-content" tabIndex={-1} className="flex-1">
      <section className="pw-gutter border-line flex flex-col gap-4 border-b pt-14 pb-10 md:pt-[72px]">
        <span className="pw-eyebrow">{t("account.eyebrow")}</span>
        <h1 className="pw-h1">{t(loaderData.status === "signed-in" ? "account.heading_signed_in" : "account.heading")}</h1>
      </section>
      <div className="pw-gutter pt-12 pb-28">
      {loaderData.status === "unavailable" ? <Unavailable /> : null}
      {loaderData.status === "signed-out" ? <SignIn loginFailed={loaderData.loginFailed} /> : null}
      {loaderData.status === "error" ? (
        <>
          <p role="alert" className="border-line bg-shelf border p-4">
            {t("account.error")}
          </p>
          <LogoutForm />
        </>
      ) : null}
      {loaderData.status === "signed-in" ? <Customer customer={loaderData.customer} /> : null}
      </div>
    </main>
  );
}

function Unavailable() {
  const t = useText();
  return (
    <section className="border-line max-w-[620px] border p-8" aria-labelledby="unavailable-heading">
      <h2 id="unavailable-heading" className="pw-section-label mb-3">
        {t("account.unavailable_heading")}
      </h2>
      <p className="text-muted max-w-xl">{t("account.unavailable_body")}</p>
    </section>
  );
}

function SignIn({ loginFailed }: { loginFailed: boolean }) {
  const t = useText();
  return (
    <section className="flex max-w-[520px] flex-col items-start gap-5" aria-labelledby="sign-in-heading">
      <h2 id="sign-in-heading" className="pw-section-label">
        {t("account.sign_in_heading")}
      </h2>
      <p className="pw-lead">{t("account.sign_in_body")}</p>
      {loginFailed ? (
        <p role="alert" className="border-line bg-shelf border p-4">
          {t("account.login_failed")}
        </p>
      ) : null}
      {/* A plain <a>: the OAuth redirect needs a full page navigation. */}
      <a href="/account/login" className={"pw-btn pw-btn--primary"}>
        {t("account.sign_in")}
      </a>
    </section>
  );
}

function LogoutForm() {
  const t = useText();
  // A plain <form>: the logout redirect needs a full page navigation.
  return (
    <form method="post" action="/account/logout" className="mt-6">
      <button type="submit" className={"pw-btn pw-btn--secondary"}>
        {t("account.log_out")}
      </button>
    </form>
  );
}

type Customer = Extract<Route.ComponentProps["loaderData"], { status: "signed-in" }>["customer"];

function Customer({ customer }: { customer: Customer }) {
  const t = useText();
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
      <section aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="pw-section-label mb-3">
          {name || t("account.profile_heading")}
        </h2>
        {customer.emailAddress?.emailAddress ? (
          <p className="text-muted">{customer.emailAddress.emailAddress}</p>
        ) : null}
        <LogoutForm />
      </section>
      <Orders orders={customer.orders} />
    </div>
  );
}

function Orders({ orders }: { orders: Customer["orders"] }) {
  const t = useText();
  const navigation = useNavigation();
  const isPaging = navigation.state === "loading" && navigation.location?.pathname === "/account";
  const { pageInfo } = orders;

  return (
    <section aria-labelledby="orders-heading">
      <h2 id="orders-heading" className="pw-section-label mb-4">
        {t("account.orders_heading")}
      </h2>
      {orders.nodes.length === 0 ? (
        <div>
          <p className="text-on-surface font-medium">{t("account.no_orders")}</p>
          <Link to="/collections/all" className={"pw-btn pw-btn--primary mt-6"}>
            {t("account.no_orders_link")}
          </Link>
        </div>
      ) : (
        <ul
          role="list"
          aria-busy={isPaging}
          className={`divide-line divide-y ${isPaging ? "opacity-50" : ""}`}
        >
          {orders.nodes.map((order) => (
            <li key={order.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-4">
              <a
                href={order.statusPageUrl}
                className="text-on-surface font-medium underline-offset-4 hover:underline"
              >
                {t("account.order", { name: order.name })}
              </a>
              <time dateTime={order.processedAt} className="text-muted text-sm">
                {dateFormat.format(new Date(order.processedAt))}
              </time>
              <span className="text-muted text-sm">
                {order.financialStatus ? t(`account.status.${order.financialStatus.toLowerCase()}`) : null}
              </span>
              <span className="text-on-surface ms-auto font-medium">
                {formatPrice(order.totalPrice)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {pageInfo.hasPreviousPage || pageInfo.hasNextPage ? (
        <nav aria-label={t("account.pagination_label")} className="mt-6 flex justify-between gap-4">
          {pageInfo.hasPreviousPage && pageInfo.startCursor ? (
            <Link
              to={`?before=${encodeURIComponent(pageInfo.startCursor)}`}
              preventScrollReset
              className={"pw-btn pw-btn--secondary"}
            >
              {t("account.newer_orders")}
            </Link>
          ) : (
            <span />
          )}
          {pageInfo.hasNextPage && pageInfo.endCursor ? (
            <Link
              to={`?after=${encodeURIComponent(pageInfo.endCursor)}`}
              preventScrollReset
              className={"pw-btn pw-btn--secondary"}
            >
              {t("account.older_orders")}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
