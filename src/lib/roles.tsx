// roles.tsx
import { getFunctions, httpsCallable } from "firebase/functions";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase";

export type Roles = {
  uid: string;
  isAdmin: boolean;
  isLead: boolean;
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
    console.error("[roles] BAD SHAPE from server:", d);
    throw new Error("Roles function did not return the full shape");
  }

  console.log("[roles] server", d.version, d);
  return {
    uid: d.uid,
    isAdmin: d.isAdmin,
    isLead: d.isLead,
    adminUids: d.adminUids,
    leadUids: d.leadUids,
    version: d.version, // read from server
  };
}

// Lightweight cache so first paint can reuse last value
let last: Roles | null = null;

export function installRolesListener(onChange: (r: Roles | null) => void) {
  return onAuthStateChanged(auth, async (u: User | null) => {
    if (!u) { last = null; onChange(null); return; }
    try {
      last = await fetchRoles();
      onChange(last);
    } catch (e) {
      console.warn("[roles] fetch failed; treating as no roles", e);
      last = { uid: u.uid, isAdmin: false, isLead: false, adminUids: [], leadUids: [] };
      onChange(last);
    }
  });
}

// Guards
import React from "react";

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
