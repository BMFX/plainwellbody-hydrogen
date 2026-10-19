import { FREE_SHIPPING_THRESHOLD } from "~/lib/plainwell";

// Keep in sync with the store's shipping profile: US standard is free at $50 and up.
export function AnnouncementBar() {
  return (
    <div role="region" aria-label="Announcement" className="bg-ink px-5 py-2.5 text-center text-xs tracking-[0.04em] text-white">
      Complimentary US shipping on orders over ${FREE_SHIPPING_THRESHOLD}.
    </div>
  );
}
