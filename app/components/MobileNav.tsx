import { Link } from "react-router";

import { closeMobileNavDrawer, MOBILE_NAV_DRAWER_ID, openDialogFallback } from "~/lib/cart-drawer";
import { FOOTER_COLUMNS, NAV_LINKS } from "~/lib/plainwell";

export function MobileNav() {
  const more = FOOTER_COLUMNS[1].links.filter((link) => !NAV_LINKS.some((n) => n.href === link.href));

  return (
    <dialog
      id={MOBILE_NAV_DRAWER_ID}
      className="drawer-left bg-paper text-ink"
      aria-labelledby="mobile-nav-title"
      data-testid="mobile-nav"
      closedby="any"
    >
      <div className="flex h-full flex-col">
        <div className="border-line flex h-16 shrink-0 items-center justify-between border-b px-5">
          <span className="pw-eyebrow" id="mobile-nav-title">
            Menu
          </span>
          <button
            type="button"
            commandfor={MOBILE_NAV_DRAWER_ID}
            command="close"
            className="button-icon -me-3"
            aria-label="Close"
            onClick={() => closeMobileNavDrawer()}
          >
            <img src="/icons/icon-x.svg" alt="" className="size-5" aria-hidden="true" loading="lazy" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <nav aria-label="Mobile navigation">
            <ul role="list" className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <li key={link.href} className="border-line border-b">
                  <Link
                    to={link.href}
                    className="pw-heading flex min-h-14 items-center"
                    onClick={() => closeMobileNavDrawer()}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul role="list" className="mt-8 flex flex-col gap-1 text-[13px]">
              {[...more, { label: "Account", href: "/account" }].map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="flex min-h-11 items-center" onClick={() => closeMobileNavDrawer()}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </dialog>
  );
}

export function MobileNavTrigger() {
  return (
    <button
      type="button"
      commandfor={MOBILE_NAV_DRAWER_ID}
      command="show-modal"
      className="button-icon"
      aria-label="Menu"
      aria-controls={MOBILE_NAV_DRAWER_ID}
      aria-haspopup="dialog"
      data-testid="nav-trigger"
      onClick={() => openDialogFallback(MOBILE_NAV_DRAWER_ID)}
    >
      <img src="/icons/icon-menu.svg" alt="" className="size-5" aria-hidden="true" />
    </button>
  );
}
