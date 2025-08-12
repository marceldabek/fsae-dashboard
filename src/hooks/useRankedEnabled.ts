import { useEffect, useState } from "react";
import { fetchRankedSettings, setRankedSettings } from "../lib/firestore";
import { isCurrentUserAdmin } from "../auth";

const KEY = "ranked:enabled";

export function useRankedEnabled() {
  const [enabled, setEnabled] = useState<boolean>(true);

  // Initialize from Firestore and localStorage
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const local = localStorage.getItem(KEY);
        if (local !== null) {
          if (mounted) setEnabled(local === "1");
        } else {
          const s = await fetchRankedSettings();
          if (mounted) setEnabled(!!s.enabled);
        }
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue != null) setEnabled(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    // Also listen for in-tab custom events so all instances update immediately
    const onCustom = (e: Event) => {
      try {
        const v = (e as CustomEvent).detail as boolean;
        setEnabled(!!v);
      } catch {}
    };
    window.addEventListener("ranked:enabledChanged", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ranked:enabledChanged", onCustom as EventListener);
    };
  }, []);

  const update = async (v: boolean) => {
    setEnabled(v);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {}
    // Only admins update the global Firestore flag; everyone else keeps it client-only
    try { if (isCurrentUserAdmin()) await setRankedSettings({ enabled: v }); } catch {}
  try { window.dispatchEvent(new CustomEvent("ranked:enabledChanged", { detail: v })); } catch {}
  };

  return [enabled, update] as const;
}
