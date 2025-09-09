
import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from "react-router-dom";
import router from "./router";
import './index.css'
import { installViewportVhFix } from './utils/viewportVhFix';
import { recordAnonymousVisit } from "./lib/firestore";
import { setRuntimeAdmins } from './admin';
import { listenAuth } from './auth';

installViewportVhFix();

// Register SW only in production (original simpler behavior)
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

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

// Initialize auth and roles
(async () => {
  try { await recordAnonymousVisit(); } catch (e) { /* ignore anonymous visit errors */ }
  // Listen for auth and load roles (callable function first, then fallback to direct doc)
  listenAuth(async (u) => {
    if (!u) { setRuntimeAdmins([], []); return; }
    // Rely solely on backend callable for role population (no Firestore doc fallback)
  // ...existing code...
  });
})();

