// roles.tsx
import { getFunctions, httpsCallable } from "firebase/functions";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export type Roles = {
  uid: string;
  isAdmin: boolean;
  isLead: boolean;
  isMember: boolean;
  adminUids: string[];
  leadUids: string[];
    version?: string; // read from server
};

export async function fetchRoles(): Promise<Roles> {
  const functions = getFunctions(undefined, "us-central1");
  const fn = httpsCallable(functions, "getAdminRoles");
  const res: any = await fn();
  const d: any = res?.data ?? {};

  // Require the new full shape
  if (typeof d.uid !== "string" ||
      typeof d.isAdmin !== "boolean" ||
      typeof d.isLead !== "boolean" ||
      !Array.isArray(d.adminUids) ||
      !Array.isArray(d.leadUids)) {
    throw new Error("Roles function did not return the full shape");
  }

  // Merge in Discord roles from custom claims OR Firestore fallback
  try {
    const tok = await auth.currentUser?.getIdTokenResult();
    let claimLead = Boolean((tok?.claims as any)?.roles?.team_lead);
    let claimMember = Boolean((tok?.claims as any)?.roles?.team_member);
    
    // If no custom claims but user is Discord user, check Firestore
    if (!claimLead && !claimMember && d.uid.startsWith('discord:')) {
      try {
        const userDoc = await getDoc(doc(db, 'users', d.uid));
        const userData = userDoc.data();
        claimLead = Boolean(userData?.roles?.team_lead);
        claimMember = Boolean(userData?.roles?.team_member);
      } catch (e) {
        // Firestore fallback failed
      }
    }
    
    const claimAdmin = false; // no admin via Discord; keep admin from config only
    const finalIsAdmin = d.isAdmin || claimAdmin;
    const finalIsLead = d.isLead || claimLead;
    const finalIsMember = claimMember || finalIsLead || finalIsAdmin; // members include leads/admins
    const finalRoles = {
      uid: d.uid,
      isAdmin: finalIsAdmin,
      isLead: finalIsLead,
      isMember: finalIsMember,
      adminUids: d.adminUids,
      leadUids: d.leadUids,
      version: d.version,
    };
    return finalRoles;
  } catch {
    const fallbackIsAdmin = d.isAdmin;
    const fallbackIsLead = d.isLead;
    const fallbackIsMember = fallbackIsLead || fallbackIsAdmin; // leads/admins are members
    return {
      uid: d.uid,
      isAdmin: fallbackIsAdmin,
      isLead: fallbackIsLead,
      isMember: fallbackIsMember,
      adminUids: d.adminUids,
      leadUids: d.leadUids,
      version: d.version,
    };
  }
}

// Lightweight cache so first paint can reuse last value
let last: Roles | null = null;

// Singleton listener + subscriber set to prevent duplicate getAdminRoles calls
const subscribers = new Set<(r: Roles | null) => void>();
let installed = false;
let authUnsub: (() => void) | null = null;
let inFlight: Promise<Roles> | null = null;

async function refreshRoles(u: User): Promise<Roles> {
  if (!inFlight) {
    inFlight = (async () => {
      try { await u.getIdToken(true); } catch {}
      const r = await fetchRoles();
      return r;
    })().finally(() => { inFlight = null; });
  }
  return inFlight;
}

function ensureInstalled() {
  if (installed) return;
  installed = true;
  authUnsub = onAuthStateChanged(auth, async (u: User | null) => {
    if (!u) {
      last = null;
      subscribers.forEach(cb => cb(last));
      return;
    }
    try {
      last = await refreshRoles(u);
      subscribers.forEach(cb => cb(last));
    } catch {
      // If role fetch fails, set minimal default
      last = { uid: u.uid, isAdmin: false, isLead: false, isMember: false, adminUids: [], leadUids: [] };
      subscribers.forEach(cb => cb(last));
    }
  });
}

export function installRolesListener(onChange: (r: Roles | null) => void) {
  ensureInstalled();
  subscribers.add(onChange);
  // emit current immediately
  onChange(last);
  return () => {
    subscribers.delete(onChange);
    if (subscribers.size === 0 && authUnsub) {
      // Keep auth listener alive to avoid churn; if you really want to clean up, uncomment:
      // authUnsub(); authUnsub = null; installed = false;
    }
  };
}

// Guards
import React from "react";

export function useRoles(): { role: 'admin'|'lead'|'member'|null, ready: boolean } {
  const [roles, setRoles] = React.useState<Roles | null>(last);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const unsub = installRolesListener((r) => {
      setRoles(r);
      setReady(true);
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  const role = React.useMemo(() => {
    if (!roles) return null;
    if (roles.isAdmin) return 'admin';
    if (roles.isLead) return 'lead';
    if (roles.isMember) return 'member';
    return null; // not a member
  }, [roles]);

  return { role, ready };
}

export function RequireLead({ children }: { children: React.ReactNode }) {
  const [r, setR] = React.useState<Roles | null>(last);
  React.useEffect(() => installRolesListener(setR), []);
  if (!r) return null; // or a spinner
  return (r.isAdmin || r.isLead) ? <>{children}</> : null;
}

export function RequireAdmin({ children }: React.PropsWithChildren<{}>) {
  const [r, setR] = React.useState<Roles | null>(last);
  React.useEffect(() => installRolesListener(setR), []);
  if (!r) return null;
  return r.isAdmin ? <>{children}</> : null;
}

export function RequireMember({ children }: { children: React.ReactNode }) {
  const [r, setR] = React.useState<Roles | null>(last);
  React.useEffect(() => installRolesListener(setR), []);
  if (!r) return null;
  // Member = has team_member role OR is lead/admin (leads/admins are also members)
  return (r.isAdmin || r.isLead || r.isMember) ? <>{children}</> : null;
}
