import { Link } from "react-router";

import { closeMobileNavDrawer, MOBILE_NAV_DRAWER_ID, openDialogFallback } from "~/lib/cart-drawer";
import { useSiteContent, useText } from "~/lib/text";

// The main menu, then the mobile-secondary menu (Shopify › Navigation).
export function MobileNav() {
  const content = useSiteContent();
  const t = useText();

  return (
    <dialog id={MOBILE_NAV_DRAWER_ID} className="drawer-left bg-paper text-ink" aria-labelledby="mobile-nav-title" data-testid="mobile-nav" closedby="any">
      <div className="flex h-full flex-col">
        <div className="border-line flex h-16 shrink-0 items-center justify-between border-b px-5">
          <span className="pw-eyebrow" id="mobile-nav-title">
            {t("nav.menu")}
          </span>
          <button type="button" commandfor={MOBILE_NAV_DRAWER_ID} command="close" className="button-icon -me-3" aria-label={t("nav.close")} onClick={() => closeMobileNavDrawer()}>
            <img src="/icons/icon-x.svg" alt="" className="size-5" aria-hidden="true" loading="lazy" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <nav aria-labelledby="mobile-nav-title">
            <ul role="list" className="flex flex-col">
              {content?.menus.main.map((link) => (
                <li key={link.url + link.title} className="border-line border-b">
                  <Link to={link.url} className="pw-heading flex min-h-14 items-center" onClick={() => closeMobileNavDrawer()}>
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
            <ul role="list" className="mt-8 flex flex-col gap-1 text-[13px]">
              {content?.menus.mobile.map((link) => (
                <li key={link.url + link.title}>
                  <Link to={link.url} className="flex min-h-11 items-center" onClick={() => closeMobileNavDrawer()}>
                    {link.title}
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
  const t = useText();
  return (
    <button
      type="button"
      commandfor={MOBILE_NAV_DRAWER_ID}
      command="show-modal"
      className="button-icon"
      aria-label={t("nav.menu")}
      aria-controls={MOBILE_NAV_DRAWER_ID}
      aria-haspopup="dialog"
      data-testid="nav-trigger"
      onClick={() => openDialogFallback(MOBILE_NAV_DRAWER_ID)}
    >
      <img src="/icons/icon-menu.svg" alt="" className="size-5" aria-hidden="true" />
    </button>
  );
}
