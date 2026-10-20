import { createContext } from "react-router";

export type Env = {
  PRIVATE_STOREFRONT_API_TOKEN?: string;
  PUBLIC_CHECKOUT_DOMAIN?: string;
  PUBLIC_STORE_DOMAIN?: string;
  PUBLIC_STOREFRONT_ID?: string;
  PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID?: string;
  SESSION_SECRET?: string;
  SHOP_ID?: string;
  /** Optional: the storefront's canonical origin, e.g. https://plainwellbody.com. */
  PUBLIC_CANONICAL_ORIGIN?: string;
  /** Dev Dashboard app credentials for the newsletter and contact forms. Server
   * only; exchanged for 24-hour Admin API tokens, renewed automatically. */
  SHOPIFY_ADMIN_CLIENT_ID?: string;
  SHOPIFY_ADMIN_CLIENT_SECRET?: string;
};

export const envContext = createContext<Env>();
