"use client";

// The authed-app shell: left sidebar rail on >=md, bottom tab bar on mobile.
// Wraps every route under (app). Handles the client-side auth guard (redirect to
// /auth when signed out) since this is a static export with no middleware.

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "../../lib/session";

type Tab = { href: string; label: string; icon: React.ReactNode; match?: string[] };

// Five primary destinations, ordered by the core loop: build → train → review → ask.
// "Workouts" spans /workouts + /plan and "Progress" spans /history + /insights;
// each pair is one nav entry with in-page SectionTabs between the siblings.
const PRIMARY: Tab[] = [
  { href: "/hub", label: "Home", icon: <IconHub /> },
  { href: "/workouts", label: "Workouts", icon: <IconStack />, match: ["/workouts", "/plan"] },
  { href: "/train", label: "Train", icon: <IconCamera /> },
  { href: "/history", label: "Progress", icon: <IconChart />, match: ["/history", "/insights"] },
  { href: "/coach", label: "Coach", icon: <IconCoach /> },
];

// Utility destinations: rail footer on desktop, top-bar icons on mobile.
const UTILITY: Tab[] = [
  { href: "/exercises", label: "Exercise library", icon: <IconLibrary /> },
  { href: "/settings", label: "Settings", icon: <IconGear /> },
];

function isActive(pathname: string, tab: Tab): boolean {
  return (tab.match ?? [tab.href]).some(
    (h) => pathname === h || pathname.startsWith(`${h}/`) || pathname.startsWith(`${h}?`)
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, configured } = useSession();

  useEffect(() => {
    if (!loading && configured && !user) {
      router.replace("/auth");
    }
  }, [loading, configured, user, router]);

  if (loading) {
    return (
      <div className="shell-boot">
        <div className="shell-boot-mark">R</div>
        <span>Loading RepMint…</span>
      </div>
    );
  }

  // If Supabase isn't configured we still render (guest-friendly build).
  if (configured && !user) {
    return (
      <div className="shell-boot">
        <div className="shell-boot-mark">R</div>
        <span>Redirecting to sign in…</span>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="shell-rail" aria-label="Primary">
        <Link href="/hub" className="shell-brand" aria-label="RepMint hub">
          <span className="shell-brand-mark">R</span>
          <strong>RepMint</strong>
        </Link>
        <nav className="shell-rail-nav">
          {PRIMARY.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`shell-rail-item${isActive(pathname, t) ? " active" : ""}`}
            >
              <span className="shell-icon" aria-hidden>
                {t.icon}
              </span>
              <span>{t.label}</span>
            </Link>
          ))}
          <div className="shell-rail-sep" role="presentation" />
          {UTILITY.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`shell-rail-item shell-rail-item-utility${isActive(pathname, t) ? " active" : ""}`}
            >
              <span className="shell-icon" aria-hidden>
                {t.icon}
              </span>
              <span>{t.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <header className="shell-mobile-top">
        <Link href="/hub" className="shell-brand" aria-label="RepMint hub">
          <span className="shell-brand-mark">R</span>
          <strong>RepMint</strong>
        </Link>
        <div className="shell-mobile-actions">
          {UTILITY.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`shell-mobile-action${isActive(pathname, t) ? " active" : ""}`}
              aria-label={t.label}
            >
              <span className="shell-icon" aria-hidden>
                {t.icon}
              </span>
            </Link>
          ))}
        </div>
      </header>

      <main className="shell-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="shell-page"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="shell-tabbar" aria-label="Primary">
        {PRIMARY.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`shell-tab${isActive(pathname, t) ? " active" : ""}`}
            aria-current={isActive(pathname, t) ? "page" : undefined}
          >
            <span className="shell-icon" aria-hidden>
              {t.icon}
            </span>
            <small>{t.label}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/* ---- Inline stroke icons (currentColor, 24px grid) ---- */

function IconHub() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}
function IconLibrary() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" />
      <path d="M6.5 8h0M17.5 8h0" />
    </svg>
  );
}
function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function IconCoach() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}
function IconStack() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5M3 18l9 5 9-5" opacity="0.55" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}
