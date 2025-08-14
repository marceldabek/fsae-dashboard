
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from "react-router-dom";
import router from "./router";
import './index.css'
import { refreshAllCaches, recordAnonymousVisit } from "./lib/firestore";

// Register SW using Vite base URL in production
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const url = (import.meta.env.BASE_URL || "/") + "sw.js";
    navigator.serviceWorker.register(url).catch(() => {});
  });
}

// Prevent the browser from showing an install (A2HS/PWA) prompt.
// Scope to production so dev consoles don't show the info message.
if (import.meta.env.PROD) {
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    // Optionally store the event if you ever want a manual "Install" button:
    // (window as any).deferredPrompt = e;
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)

// Background refresh: on load, on focus, and every 10 minutes
try {
  refreshAllCaches();
  // Anonymous daily visit tracking (counts once per client per day)
  recordAnonymousVisit();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshAllCaches();
  });
  setInterval(() => refreshAllCaches(), 10 * 60 * 1000);
} catch {}

