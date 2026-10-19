import { Link } from "react-router";

import { mediaFile } from "~/components/Media";
import { NewsletterForm } from "~/components/NewsletterForm";
import { FOOTER_COLUMNS } from "~/lib/plainwell";

export function Footer({ shopName }: { shopName: string }) {
  return (
    <footer className="bg-ink text-paper mt-auto">
      <div className="pw-gutter flex flex-col gap-16 pt-20 pb-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-5">
          <div className="col-span-2">
            <NewsletterForm />
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title} className="flex flex-col gap-1 text-[13px]">
              <h2 className="text-on-ink-muted mb-2 font-normal">{column.title}</h2>
              {column.links.map((link) => (
                <Link key={link.href} to={link.href} className="pw-hover flex min-h-8 items-center">
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="border-rule-on-ink text-on-ink-muted flex flex-wrap items-end justify-between gap-6 border-t pt-7 text-xs">
          <img
            src={mediaFile("wordmark-white.webp")}
            alt={shopName}
            width={270}
            height={128}
            loading="lazy"
            className="h-16 w-auto"
          />
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span>© {new Date().getFullYear()} {shopName} · Demo storefront</span>
            <Link to="/policies/privacy-policy" className="pw-hover">
              Privacy
            </Link>
            <Link to="/pages/terms" className="pw-hover">
              Terms
            </Link>
            <Link to="/pages/data-sharing-opt-out" className="pw-hover">
              Your privacy choices
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
