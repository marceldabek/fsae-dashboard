
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ADMIN_UID } from "../admin";
import { signIn, signOutUser } from "../auth";
import { useEffect, useState } from "react";

export default function Layout() {
  const user = useAuth();
  const isAdmin = user?.uid === ADMIN_UID;
  const [showSignIn, setShowSignIn] = useState(false);

  // Press Alt+S to toggle sign-in button when logged out
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!user && (e.key === 's' || e.key === 'S') && e.altKey) {
        setShowSignIn(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [user]);
  return (
  <div className="min-h-screen bg-uconn-blue bg-app-gradient text-uconn-text">
      <header className="sticky top-0 z-40 bg-uconn-blue/90 backdrop-blur border-b border-uconn-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center h-10">
            {/* Replace this file with your 120x32 transparent PNG: /public/icons/team-logo-120x32.png */}
            <img src={`${import.meta.env.BASE_URL}icons/team-logo-120x32.png`} alt="Team Logo" className="h-8 w-[120px] object-contain" style={{maxHeight: 32, maxWidth: 120}} />
          </Link>
      <nav className="text-sm flex gap-4">
            <NavLink to="/" className={({isActive}) => isActive ? "underline" : ""}>Overview</NavLink>
            <NavLink to="/people" className={({isActive}) => isActive ? "underline" : ""}>People</NavLink>
            {isAdmin && <NavLink to="/admin" className={({isActive}) => isActive ? "underline" : ""}>Admin</NavLink>}
            {/* Sign in moved to bottom of Overview; hidden in header */}
            {user ? (
              <button onClick={signOutUser} className="text-xs border px-2 py-1 rounded">
                Sign out
              </button>
            ) : showSignIn && (
              <button onClick={signIn} className="text-xs border px-2 py-1 rounded bg-brand-teal/30 hover:bg-brand-teal/50 transition" title="Press Alt+S to hide">
                Sign in
              </button>
            )}
          </nav>
        </div>
      </header>
    <main className="max-w-6xl mx-auto px-4 py-6"><Outlet /></main>
      <footer className="py-6 text-center text-xs text-uconn-muted">© UConn FSAE</footer>
    </div>
  );
}
