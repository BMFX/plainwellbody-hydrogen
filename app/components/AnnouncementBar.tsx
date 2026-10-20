import { useSiteContent, useText } from "~/lib/text";

// Site settings › Announcement bar. Nothing renders when it is empty.
export function AnnouncementBar() {
  const content = useSiteContent();
  const t = useText();
  const message = content?.settings.announcement;
  if (!message) return null;
  return (
    <div role="region" aria-label={t("a11y.announcement")} className="bg-ink px-5 py-2.5 text-center text-xs tracking-[0.04em] text-white">
      {message}
    </div>
  );
}
