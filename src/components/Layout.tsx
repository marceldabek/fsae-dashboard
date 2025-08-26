import { Link, NavLink, Outlet, useLocation, useMatches } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { subscribeAdminRoleChanges } from "../admin";
import { useRoles, RequireLead } from "../lib/roles";
import { signIn, signOutUser } from "../auth";
import { useEffect, useState } from "react";
import TeamLogo from "./TeamLogo";
import { fetchRankedSettings, setRankedSettings } from "../lib/firestore";
import { useRankedEnabled } from "../hooks/useRankedEnabled";

import { ReactNode } from 'react';
import { useTheme } from "@/hooks/useTheme";

function Layout({ children }: { children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [rankedEnabled, updateRankedEnabled] = useRankedEnabled();
  const location = useLocation();
  const matches = useMatches();
  const fullBleedFromHandle = matches.some(m => (m.handle as any)?.fullBleed);
  const isTimeline = location.pathname.startsWith('/timeline');
  const fullBleed = fullBleedFromHandle || isTimeline;
  const { theme, toggle } = useTheme();

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load ranked setting once
  // rankedEnabled managed by hook; no manual effect needed
  // ...existing code...

  return (
  <div className="min-h-[100dvh] bg-background bg-app-gradient text-foreground">
      {/* iOS PWA safe area top spacer to avoid visual gap under the status bar */}
      <div style={{ height: 'env(safe-area-inset-top)' }} className="bg-black" />
  <header className="sticky top-0 z-50 w-full bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center h-10">
            <TeamLogo className="h-8 w-auto" />
          </Link>
          {/* ...existing code... */}
          {/* Hamburger button */}
          <button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border/60 bg-overlay-6 hover:bg-overlay-10 transition focus:outline-none focus:ring-2 focus:ring-accent/60"
          >
            {/* Icon */}
            <span className="sr-only">Menu</span>
            <span
              className={`absolute block h-0.5 w-5 bg-current transition-transform duration-300 ease-out ${menuOpen ? "translate-y-0 rotate-45" : "-translate-y-2 rotate-0"}`}
              style={{ color: "#E5E7EB" }}
            />
            <span
              className={`absolute block h-0.5 w-5 bg-current transition-opacity duration-300 ${menuOpen ? "opacity-0" : "opacity-100"}`}
              style={{ color: "#E5E7EB" }}
            />
            <span
              className={`absolute block h-0.5 w-5 bg-current transition-transform duration-300 ease-out ${menuOpen ? "translate-y-0 -rotate-45" : "translate-y-2 rotate-0"}`}
              style={{ color: "#E5E7EB" }}
            />
          </button>
        </div>
      </header>
      {/* Slide-over menu */}
      <div className={`fixed inset-0 z-50 ${menuOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuOpen(false)}
        />
        {/* Panel */}
        <aside
          className={`absolute right-0 top-0 h-full w-[18rem] max-w-[85vw] bg-background/95 border-l border-border shadow-xl transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="h-14 px-4 flex items-center justify-between border-b border-border/60">
            <span className="text-sm font-medium text-muted uppercase tracking-caps">Menu</span>
            <button
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-black/20"
            >
              <span className="sr-only">Close</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <nav className="px-2 py-3 text-base">
            <MenuLink to="/" label="Overview" />
            <MenuLink to="/members" label="Members" />
            <MenuLink to="/stats" label="Stats" />
            <MenuLink to="/timeline" label="Timeline" />
            {/* Show Ranked entry only when Ranked mode is enabled */}
            {rankedEnabled && <MenuLink to="/ranked" label="Ranked" />}
            <RequireLead>
              <MenuLink to="/admin" label="Admin" />
            </RequireLead>
            <div className="my-3 border-t border-border/60" />
            <label className="flex items-center gap-2 px-3 py-2 text-sm select-none cursor-pointer">
              <span className="text-sm text-muted-foreground tracking-caps">Ranked mode</span>
              {/* Toggle */}
              <span className="relative inline-flex h-6 w-11 select-none ml-auto">
                {/* hidden checkbox drives styles */}
                <input
                  type="checkbox"
                  checked={rankedEnabled}
                  onChange={(e)=>updateRankedEnabled(e.target.checked)}
                  className="peer sr-only"
                />

                {/* track */}
                <span
                  className="
                    pointer-events-none block h-6 w-11 rounded-full border border-border
                    bg-black/15 dark:bg-white/15
                    transition-colors
                    peer-checked:bg-accent/70
                    peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background
                  "
                />

                {/* knob (the moving dot) */}
                <span
                  className="
                    pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full
                    bg-white dark:bg-background shadow
                    transition-transform
                    peer-checked:translate-x-5
                  "
                />
              </span>
            </label>
            <label className="flex items-center gap-2 px-3 py-2 text-sm select-none cursor-pointer">
              <span className="text-sm text-muted-foreground tracking-caps">Dark mode</span>
              {/* Toggle */}
              <span className="relative inline-flex h-6 w-11 select-none ml-auto">
                {/* hidden checkbox drives styles */}
                <input
                  type="checkbox"
                  checked={theme === "dark"}
                  onChange={toggle}
                  className="peer sr-only"
                />

                {/* track */}
                <span
                  className="
                    pointer-events-none block h-6 w-11 rounded-full border border-border
                    bg-black/15 dark:bg-white/15
                    transition-colors
                    peer-checked:bg-accent/70
                    peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background
                  "
                />

                {/* knob (the moving dot) */}
                <span
                  className="
                    pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full
                    bg-white dark:bg-background shadow
                    transition-transform
                    peer-checked:translate-x-5
                  "
                />
              </span>
            </label>
            {useAuth() ? (
              <button onClick={signOutUser} className="w-full text-left px-3 py-2 rounded-md hover:bg-black/20 transition text-sm font-normal">
                Sign out
              </button>
            ) : (
              <button onClick={signIn} className="w-full text-left px-3 py-2 rounded-md bg-accent/30 hover:bg-accent/50 transition text-sm font-normal text-text">
                Sign in
              </button>
            )}
          </nav>
          <div className="mt-auto p-3 text-tick text-muted/80 border-t border-border/60">
            © UConn FSAE
          </div>
        </aside>
      </div>
      <main
        className={
          fullBleed
            ? 'w-full h-[calc(100vh-4rem)] p-0 m-0 overflow-hidden'
            : 'max-w-6xl mx-auto px-4 py-6'
        }
      >
        {fullBleed ? children ?? <Outlet /> : <Outlet />}
      </main>
      <footer className="py-6 text-center text-xs text-muted uppercase tracking-caps">© UConn FSAE</footer>
    </div>
  );
}

export default Layout;

// Slide-over menu link with subtle hover animation
function MenuLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-2 px-3 py-2 rounded-md transition border ${
          isActive
            // Keep active text white (avoid black on accent background)
            ? 'bg-accent/30 border-accent/60 text-white shadow-sm hover:bg-accent/40'
            : 'border-transparent hover:bg-black/15'
  } focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`
      }
    >
      <span className="relative">
        <span className="transition-transform duration-300 group-hover:translate-x-0.5">{label}</span>
        <span className="ml-2 inline-block opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">→</span>
      </span>
    </NavLink>
  );
}
