import { Link, NavLink } from "react-router";

import { Logo } from "~/components/Logo";
import { useCart } from "~/lib/cart";
import { CART_DRAWER_ID, SEARCH_DRAWER_ID, openDialogFromLinkClick } from "~/lib/cart-drawer";
import { useSiteContent, useText } from "~/lib/text";

import { MobileNav, MobileNavTrigger } from "./MobileNav";

function displayCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

// Three columns: the main menu (Shopify › Navigation › main-menu), the centred logo, then
// Search · Account · Bag. Phones keep the logo centred between a menu button and Search/Bag.
export function Header({ shopName }: { shopName: string }) {
  const totalQuantity = useCart((state) => state.data.totalQuantity);
  const content = useSiteContent();
  const t = useText();

  return (
    <header className="bg-paper border-line sticky top-0 z-40 border-b">
      <div className="pw-gutter grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-6 text-[13px] md:h-[var(--spacing-header)]">
        <div className="flex items-center">
          <div className="-ms-3 lg:hidden">
            <MobileNavTrigger />
          </div>
          <nav aria-label={t("nav.main_label")} className="hidden items-center gap-7 lg:flex">
            {content?.menus.main.map((link) => (
              <NavLink
                key={link.url + link.title}
                to={link.url}
                prefetch="intent"
                className="pw-hover aria-[current=page]:underline aria-[current=page]:underline-offset-[6px]"
              >
                {link.title}
              </NavLink>
            ))}
          </nav>
        </div>

        <Link to="/" aria-label={t("nav.home_label", { shop: shopName })} className="justify-self-center">
          <Logo image={content?.settings.logo ?? null} alt={shopName} height={46} className="h-9 w-auto md:h-[46px]" />
        </Link>

        <div className="flex items-center justify-self-end gap-6">
          <Link
            to="/search"
            className="pw-hover inline-flex min-h-11 items-center"
            aria-controls={SEARCH_DRAWER_ID}
            aria-haspopup="dialog"
            data-testid="search-trigger"
            onClick={(event) => openDialogFromLinkClick(event, SEARCH_DRAWER_ID)}
          >
            <span className="hidden md:inline">{t("nav.search")}</span>
            <img src="/icons/icon-search.svg" alt={t("nav.search")} className="size-5 md:hidden" />
          </Link>
          <Link to="/account" className="pw-hover hidden min-h-11 items-center md:inline-flex">
            {t("nav.account")}
          </Link>
          <Link
            to="/cart"
            className="pw-hover inline-flex min-h-11 items-center"
            aria-controls={CART_DRAWER_ID}
            aria-haspopup="dialog"
            data-testid="cart-trigger"
            onClick={(event) => openDialogFromLinkClick(event, CART_DRAWER_ID)}
          >
            {t("nav.bag", { count: displayCount(totalQuantity) })}
          </Link>
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {t(totalQuantity === 1 ? "nav.bag_count_one" : "nav.bag_count_other", { count: totalQuantity })}
          </span>
        </div>
      </div>
      <MobileNav />
    </header>
  );
}
