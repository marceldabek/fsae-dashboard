import { Link, NavLink, Outlet, useLocation, useMatches } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { subscribeAdminRoleChanges } from "../admin";
import { useRoles, RequireLead, RequireMember } from "../lib/roles";
import { signIn, signOutUser, signInWithDiscord } from "../auth";
import { useEffect, useMemo, useState } from "react";
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
  const user = useAuth();
  const base = (import.meta as any).env?.BASE_URL || import.meta.env.BASE_URL || "/";

  // If signed in with Discord custom token, uid is "discord:{discordId}".
  const myPersonId = useMemo(() => {
    if (!user) return null;
    const uid = user.uid || "";
    if (uid.startsWith("discord:")) return uid.slice("discord:".length);
    return null; // Unknown mapping for non-Discord accounts
  }, [user]);

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
  <div className={`min-h-[100dvh] bg-background bg-app-gradient text-foreground ${fullBleed ? 'h-[100dvh] overflow-hidden' : ''}`}> 
      {/* iOS PWA safe area top spacer to avoid visual gap under the status bar */}
      <div style={{ height: 'env(safe-area-inset-top)' }} className="bg-background" />
  <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center h-10">
            {/* Invert the white logo in light mode so it appears black; keep white in dark mode */}
            <TeamLogo className="h-8 w-auto invert dark:invert-0" />
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
            <span className={`absolute block h-0.5 w-5 bg-current transition-transform duration-300 ease-out ${menuOpen ? "translate-y-0 rotate-45" : "-translate-y-2 rotate-0"}`} />
            <span className={`absolute block h-0.5 w-5 bg-current transition-opacity duration-300 ${menuOpen ? "opacity-0" : "opacity-100"}`} />
            <span className={`absolute block h-0.5 w-5 bg-current transition-transform duration-300 ease-out ${menuOpen ? "translate-y-0 -rotate-45" : "translate-y-2 rotate-0"}`} />
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
          className={`absolute right-0 top-0 h-full w-[18rem] max-w-[85vw] bg-background/95 border-l border-border shadow-[0_12px_40px_rgba(0,0,0,0.20)] dark:shadow-xl transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
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
            {myPersonId && (
              <RequireMember>
                <MenuLink to={`/person/${myPersonId}`} label="My Dashboard" />
              </RequireMember>
            )}
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
              <span className="text-sm text-muted-foreground tracking-caps uppercase">RANKED MODE</span>
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
                    peer-checked:bg-[#64C7C9]
                    peer-focus-visible:ring-2 peer-focus-visible:ring-[#64C7C9]/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background
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
              <span className="text-sm text-muted-foreground tracking-caps uppercase">DARK MODE</span>
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
                    peer-checked:bg-[#64C7C9]
                    peer-focus-visible:ring-2 peer-focus-visible:ring-[#64C7C9]/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background
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
            {user ? (
              <div className="px-2 flex items-center gap-2">
                {user.uid?.startsWith("discord:") ? (
                  <>
                    <img
                      src={`${base}icons/Discord-Symbol-Black.svg`}
                      alt=""
                      aria-hidden="true"
                      className="h-5 w-5 block dark:hidden"
                    />
                    <img
                      src={`${base}icons/Discord-Symbol-White.svg`}
                      alt=""
                      aria-hidden="true"
                      className="h-5 w-5 hidden dark:block"
                    />
                  </>
                ) : (
                  // Google multi-color mark (inline, small)
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                    className="w-5 h-5"
                  >
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                )}
                <button onClick={signOutUser} className="flex-1 text-left px-3 py-2 rounded-md hover:bg-black/20 transition text-sm font-normal">
                  Sign out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 px-2">
                {/* Google sign-in button (provided markup), adapted to JSX and wired to signIn */}
                <button
                  onClick={signIn}
                  className="gsi-material-button w-full h-10 border border-border rounded-md bg-white text-black dark:bg-transparent dark:text-white dark:hover:bg-white/10 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <div className="gsi-material-button-state"></div>
                  <div className="gsi-material-button-content-wrapper flex items-center justify-center gap-2 h-full">
                    <div className="gsi-material-button-icon">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                        style={{ display: 'block' }}
                        className="w-4 h-4"
                      >
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents text-sm">Sign in</span>
                    <span style={{ display: 'none' }}>Sign in with Google</span>
                  </div>
                </button>

                {/* Discord icon-only button, same width */}
                <button
                  type="button"
                  aria-label="Sign in with Discord"
                  onClick={async () => {
                    try {
                      await signInWithDiscord();
                      setMenuOpen(false);
                    } catch (e) {
                      // Discord sign-in failed
                    }
                  }}
                  className="w-full h-10 border border-border rounded-md bg-white dark:bg-transparent hover:bg-black/10 dark:hover:bg-white/10 transition flex items-center justify-center"
                >
                  {/* Light theme: black logo */}
                  <img
                    src={`${base}icons/Discord-Symbol-Black.svg`}
                    alt=""
                    aria-hidden="true"
                    className="h-5 w-5 block dark:hidden"
                  />
                  {/* Dark theme: white logo */}
                  <img
                    src={`${base}icons/Discord-Symbol-White.svg`}
                    alt=""
                    aria-hidden="true"
                    className="h-5 w-5 hidden dark:block"
                  />
                  <span className="sr-only">Sign in with Discord</span>
                </button>
              </div>
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
      {!fullBleed && (
        <footer className="py-6 text-center text-xs text-muted uppercase tracking-caps">© UConn FSAE</footer>
      )}
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
            ? 'bg-accent/20 dark:bg-accent/30 border-accent/50 text-foreground dark:text-white shadow-sm'
            : 'border-transparent hover:bg-black/10 dark:hover:bg-white/10'
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
