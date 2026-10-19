import { gql } from "@shopify/hydrogen/customer-account";
import { Link, useNavigation } from "react-router";

import { customerAccountContext } from "~/lib/customer-account";
import { formatPrice } from "~/lib/money";

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


export function meta({}: Route.MetaArgs) {
  return [{ title: "Account · CORE" }];
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
      return { status: "error", message: errors?.[0]?.message ?? "Customer not found." } as const;
    }
    return { status: "signed-in", customer: data.customer } as const;
  } catch {
    return {
      status: "error",
      message: "We couldn't load your account. Try again later.",
    } as const;
  }
}

export default function AccountRoute({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main-content" tabIndex={-1} className="flex-1">
      <section className="pw-gutter border-line flex flex-col gap-4 border-b pt-14 pb-10 md:pt-[72px]">
        <span className="pw-eyebrow">Account</span>
        <h1 className="pw-h1">{loaderData.status === "signed-in" ? "Your everyday orders." : "Welcome back"}</h1>
      </section>
      <div className="pw-gutter pt-12 pb-28">
      {loaderData.status === "unavailable" ? <Unavailable /> : null}
      {loaderData.status === "signed-out" ? <SignIn loginFailed={loaderData.loginFailed} /> : null}
      {loaderData.status === "error" ? (
        <>
          <p role="alert" className="border-line bg-shelf border p-4">
            {loaderData.message}
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
  return (
    <section className="border-line max-w-[620px] border p-8" aria-labelledby="unavailable-heading">
      <h2 id="unavailable-heading" className="pw-section-label mb-3">
        Customer Accounts aren&apos;t set up
      </h2>
      <p className="text-muted max-w-xl">
        Customer Accounts need a real store, <code>SHOP_ID</code>,{" "}
        <code>PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID</code>, <code>SESSION_SECRET</code>, and HTTPS
        (use <code>npm run dev:https</code> locally).
      </p>
    </section>
  );
}

function SignIn({ loginFailed }: { loginFailed: boolean }) {
  return (
    <section className="flex max-w-[520px] flex-col items-start gap-5" aria-labelledby="sign-in-heading">
      <h2 id="sign-in-heading" className="pw-section-label">
        Sign in or create an account
      </h2>
      <p className="pw-lead">See your orders in one place. We’ll email you a code; there’s no password to remember.</p>
      {loginFailed ? (
        <p role="alert" className="border-line bg-shelf border p-4">
          We couldn&apos;t sign you in. Try again.
        </p>
      ) : null}
      {/* A plain <a>: the OAuth redirect needs a full page navigation. */}
      <a href="/account/login" className={"pw-btn pw-btn--primary"}>
        Sign in
      </a>
    </section>
  );
}

function LogoutForm() {
  // A plain <form>: the logout redirect needs a full page navigation.
  return (
    <form method="post" action="/account/logout" className="mt-6">
      <button type="submit" className={"pw-btn pw-btn--secondary"}>
        Log out
      </button>
    </form>
  );
}

type Customer = Extract<Route.ComponentProps["loaderData"], { status: "signed-in" }>["customer"];

function Customer({ customer }: { customer: Customer }) {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
      <section aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="pw-section-label mb-3">
          {name || "Your account"}
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
  const navigation = useNavigation();
  const isPaging = navigation.state === "loading" && navigation.location?.pathname === "/account";
  const { pageInfo } = orders;

  return (
    <section aria-labelledby="orders-heading">
      <h2 id="orders-heading" className="pw-section-label mb-4">
        Orders
      </h2>
      {orders.nodes.length === 0 ? (
        <div>
          <p className="text-on-surface font-medium">You haven&apos;t placed any orders yet.</p>
          <Link to="/collections" className={"pw-btn pw-btn--primary mt-6"}>
            Start shopping
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
                Order {order.name}
              </a>
              <time dateTime={order.processedAt} className="text-muted text-sm">
                {dateFormat.format(new Date(order.processedAt))}
              </time>
              <span className="text-muted text-sm">
                {formatStatus(order.financialStatus)}
              </span>
              <span className="text-on-surface ms-auto font-medium">
                {formatPrice(order.totalPrice)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {pageInfo.hasPreviousPage || pageInfo.hasNextPage ? (
        <nav aria-label="Orders pagination" className="mt-6 flex justify-between gap-4">
          {pageInfo.hasPreviousPage && pageInfo.startCursor ? (
            <Link
              to={`?before=${encodeURIComponent(pageInfo.startCursor)}`}
              preventScrollReset
              className={"pw-btn pw-btn--secondary"}
            >
              Newer orders
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
              Older orders
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}

function formatStatus(status: string | null | undefined) {
  if (!status) return "";
  const text = status.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
