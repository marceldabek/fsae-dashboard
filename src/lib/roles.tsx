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
  version?: string; // from server if present
};

export async function fetchRoles(): Promise<Roles> {
  try {
    const functions = getFunctions(undefined, "us-central1");
    const fn = httpsCallable(functions, "getAdminRoles");
    const res: any = await fn();
    const d: any = res?.data ?? {};
    console.log("[roles] raw", d); // helpful while debugging

    return {
      uid: typeof d.uid === "string" ? d.uid : "",
      isAdmin: !!d.isAdmin,
      isLead: !!d.isLead,
      adminUids: Array.isArray(d.adminUids) ? d.adminUids : [],
      leadUids: Array.isArray(d.leadUids) ? d.leadUids : [],
      version: typeof d.version === "string" ? d.version : undefined,
    };
  } catch (err: any) {
    console.warn("[roles] callable failed", err?.code || err, err?.message);
    // Surface "no roles" on failure
    return { uid: "", isAdmin: false, isLead: false, adminUids: [], leadUids: [] };
  }
}

// Lightweight cache so first paint can reuse last value
let last: Roles | null = null;

export function installRolesListener(onChange: (r: Roles | null) => void) {
  return onAuthStateChanged(auth, async (u: User | null) => {
    if (!u) { last = null; onChange(null); return; }
    last = await fetchRoles();
    onChange(last);
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
