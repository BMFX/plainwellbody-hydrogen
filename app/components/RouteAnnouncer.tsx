import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

// Client-side navigations swap the page without a load event, so screen readers hear
// nothing and focus stays on a link that may be gone. On a new page (pathname change,
// not a filter or sort on the same page) this moves focus to <main> and announces the
// page title. Skips the first render: a full page load is announced by the browser.
export function RouteAnnouncer() {
  const { pathname, hash } = useLocation();
  // The path already announced; compared rather than a "first render" flag, which
  // StrictMode's double-run effects would defeat.
  const announced = useRef(pathname);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (announced.current === pathname) return;
    announced.current = pathname;
    if (hash) return; // in-page anchors keep their own focus
    const frame = requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus({ preventScroll: true });
      setMessage(document.title);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
