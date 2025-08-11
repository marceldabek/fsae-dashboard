
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ADMIN_UID } from "../admin";
import { signIn, signOutUser } from "../auth";

export default function Layout() {
  const user = useAuth();
  const isAdmin = user?.uid === ADMIN_UID;
  return (
    <div className="min-h-screen bg-uconn-blue text-uconn-text">
      <header className="sticky top-0 z-40 bg-uconn-blue/90 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold">FSAE EV Powertrain</Link>
          <nav className="text-sm flex gap-4">
            <NavLink to="/" className={({isActive}) => isActive ? "underline" : ""}>Dashboard</NavLink>
            <NavLink to="/overview" className={({isActive}) => isActive ? "underline" : ""}>Overview</NavLink>
            <NavLink to="/people" className={({isActive}) => isActive ? "underline" : ""}>People</NavLink>
            {isAdmin && <NavLink to="/admin" className={({isActive}) => isActive ? "underline" : ""}>Admin</NavLink>}
            {!user && (
              <button onClick={signIn} className="text-xs border px-2 py-1 rounded">
                Sign in
              </button>
            )}
            {user && (
              <button onClick={signOutUser} className="text-xs border px-2 py-1 rounded">
                Sign out
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
