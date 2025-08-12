import { useEffect, useState } from "react";

const KEY = "admin:viewEnabled";

export function useAdminView() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === null) return true; // default: admin view on
      return v === "1";
    } catch {
      return true;
    }
  });

  // Persist and sync across tabs
  useEffect(() => {
    try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch { /* ignore */ }
  }, [enabled]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue != null) {
        setEnabled(e.newValue === "1");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [enabled, setEnabled] as const;
}
