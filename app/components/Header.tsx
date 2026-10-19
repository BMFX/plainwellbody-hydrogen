import { Link, NavLink } from "react-router";

import { mediaFile } from "~/components/Media";
import { useCart } from "~/lib/cart";
import { CART_DRAWER_ID, SEARCH_DRAWER_ID, openDialogFromLinkClick } from "~/lib/cart-drawer";
import { NAV_LINKS } from "~/lib/plainwell";

import { MobileNav, MobileNavTrigger } from "./MobileNav";

function liveCartCountLabel(count: number) {
  return count === 1 ? "1 item in bag" : `${count} items in bag`;
}

function displayCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

// Three columns: navigation, the centred wordmark, then Search · Account · Bag in words.
// Phones keep the wordmark centred between a menu button and Search/Bag icons.
export function Header({ shopName }: { shopName: string }) {
  const totalQuantity = useCart((state) => state.data.totalQuantity);

  return (
    <header className="bg-paper border-line sticky top-0 z-40 border-b">
      <div className="pw-gutter grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-6 text-[13px] md:h-[var(--spacing-header)]">
        <div className="flex items-center">
          <div className="-ms-3 lg:hidden">
            <MobileNavTrigger />
          </div>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                prefetch="intent"
                className="pw-hover aria-[current=page]:underline aria-[current=page]:underline-offset-[6px]"
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <Link to="/" aria-label={`${shopName} home`} className="justify-self-center">
          <img
            src={mediaFile("wordmark-black.webp")}
            alt={shopName}
            width={194}
            height={92}
            className="h-9 w-auto md:h-[46px]"
            fetchPriority="high"
          />
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
            <span className="hidden md:inline">Search</span>
            <img src="/icons/icon-search.svg" alt="Search" className="size-5 md:hidden" />
          </Link>
          <Link to="/account" className="pw-hover hidden min-h-11 items-center md:inline-flex">
            Account
          </Link>
          <Link
            to="/cart"
            className="pw-hover inline-flex min-h-11 items-center"
            aria-controls={CART_DRAWER_ID}
            aria-haspopup="dialog"
            data-testid="cart-trigger"
            onClick={(event) => openDialogFromLinkClick(event, CART_DRAWER_ID)}
          >
            Bag ({displayCount(totalQuantity)})
          </Link>
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {liveCartCountLabel(totalQuantity)}
          </span>
        </div>
      </div>
      <MobileNav />
    </header>
  );
}
