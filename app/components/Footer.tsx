import { Link } from "react-router";

import { Logo } from "~/components/Logo";
import { NewsletterForm } from "~/components/NewsletterForm";
import { useSiteContent, useText } from "~/lib/text";

// Columns from the footer menu (each top-level item is a column title, its children the
// links), legal links from the footer-legal menu, logo from Site settings.
export function Footer({ shopName }: { shopName: string }) {
  const content = useSiteContent();
  const t = useText();

  return (
    <footer className="bg-ink text-paper mt-auto">
      <div className="pw-gutter flex flex-col gap-16 pt-20 pb-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-5">
          <div className="col-span-2">
            <NewsletterForm />
          </div>
          {content?.menus.footer.map((column) => (
            <nav key={column.title} aria-label={column.title} className="flex flex-col gap-1 text-[13px]">
              <h2 className="text-on-ink-muted mb-2 font-normal">{column.title}</h2>
              {column.items.map((link) => (
                <Link key={link.url + link.title} to={link.url} className="pw-hover flex min-h-8 items-center">
                  {link.title}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="border-rule-on-ink text-on-ink-muted flex flex-wrap items-end justify-between gap-6 border-t pt-7 text-xs">
          <Logo image={content?.settings.logoOnDark ?? null} alt={shopName} height={64} lazy className="h-16 w-auto" />
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span>{t("footer.copyright", { year: new Date().getFullYear(), shop: shopName })}</span>
            {content?.menus.legal.map((link) => (
              <Link key={link.url + link.title} to={link.url} className="pw-hover">
                {link.title}
              </Link>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
