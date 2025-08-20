import { getFunctions, httpsCallable } from "firebase/functions";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase";

export type Roles = {
  uid: string;
  isAdmin: boolean;
  isLead: boolean;
  adminUids: string[];
  leadUids: string[];
};

export async function fetchRoles(): Promise<Roles> {
  const functions = getFunctions(undefined, "us-central1");
  const fn = httpsCallable(functions, "getAdminRoles");
  const res: any = await fn();
  const d: any = res.data || {};
  // Defensive defaults + console for debugging
  const out: Roles = {
    uid: String(d.uid || ""),
    isAdmin: !!d.isAdmin,
    isLead: !!d.isLead,
    adminUids: Array.isArray(d.adminUids) ? d.adminUids : [],
    leadUids: Array.isArray(d.leadUids) ? d.leadUids : [],
  };
  console.log("[roles] result", out);
  return out;
}

// Simple reactive cache (optional)
let last: Roles | null = null;
export function installRolesListener(onChange: (r: Roles | null) => void) {
  return onAuthStateChanged(auth, async (u: User | null) => {
    if (!u) { last = null; onChange(null); return; }
    last = await fetchRoles();
    onChange(last);
  });
}

// Guards for components (example usage)
import React from "react";
export function RequireLead({ children }: { children: React.ReactNode }) {
  const [r, setR] = React.useState<Roles | null>(last);
  React.useEffect(() => installRolesListener(setR), []);
  if (!r) return null; // or spinner
  return (r.isAdmin || r.isLead) ? <>{children}</> : null;
}

export function RequireAdmin({ children }: React.PropsWithChildren<{}>) {
  const [r, setR] = React.useState<Roles | null>(last);
  React.useEffect(() => installRolesListener(setR), []);
  if (!r) return null;
  return r.isAdmin ? <>{children}</> : null;
}
