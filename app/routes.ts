import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("products/:handle", "routes/product.tsx"),
  route("collections/:handle", "routes/collection.tsx"),
  route("cart", "routes/cart.tsx"),
  route("search", "routes/search.tsx"),
  route("pages/:handle", "routes/page.tsx"),
  route("policies/:handle", "routes/policy.tsx"),
  route("newsletter", "routes/newsletter.tsx"),
  route("robots.txt", "routes/robots.tsx"),
  route("sitemap.xml", "routes/sitemap.tsx"),
  route("account", "routes/account.tsx"),
  route("*", "routes/catchall.tsx"),
] satisfies RouteConfig;
