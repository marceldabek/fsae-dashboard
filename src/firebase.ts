import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";

// If you later add App Check, import it here.

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Helpful runtime guard: fail fast with clear message if env is missing/misnamed
function assertFirebaseConfigPresent() {
  const missing = Object.entries(cfg)
    .filter(([_, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    const hint = `Missing Firebase env vars: ${missing.join(', ')}.\n` +
      `Create .env.local and set VITE_FIREBASE_* variables. See .env.example.`;
    throw new Error(hint);
  }
}

assertFirebaseConfigPresent();

export const app = getApps().length ? getApp() : initializeApp(cfg);

// Initialize Firestore with persistent local cache + multi-tab sync
// This dramatically reduces network reads by serving from IndexedDB
// and only syncing diffs periodically. Works on iOS Safari and modern browsers.
// Reuse the same Firestore instance across HMR reloads to avoid re-initializing
// with different options. If already set, use it; otherwise initialize once.
export const db = (globalThis as any).__FSAE_FIRESTORE__
  || ((globalThis as any).__FSAE_FIRESTORE__ = initializeFirestore(app, {
        // When using `localCache`, specify cache size within the cache object
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
          cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        }),
      }));

// Export Functions instance (default region). Adjust region if you deploy elsewhere.
export const functions = getFunctions(app, 'us-central1');

// In local development, automatically connect to the Functions emulator if running.
// This project uses a custom functions emulator port (5002) per firebase.json.
if (import.meta.env.DEV && typeof window !== "undefined") {
  try {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      // Avoid reconnecting on HMR (Firebase SDK will throw otherwise)
      const g: any = globalThis as any;
      if (!g.__FSAE_FN_EMULATOR__) {
        const port = Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT) || 5002; // firebase.json sets 5002
        connectFunctionsEmulator(functions, host, port);
        g.__FSAE_FN_EMULATOR__ = true;
        // eslint-disable-next-line no-console
        console.log("[firebase] Connected Functions emulator at", host, port);
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[firebase] Functions emulator connect failed", e);
  }
}

export const auth = getAuth(app);

// Connect Auth/Firestore emulators in local dev
if (import.meta.env.DEV && typeof window !== "undefined") {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    try {
      const g: any = globalThis as any;
      if (!g.__FSAE_AUTH_EMULATOR__) {
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
        g.__FSAE_AUTH_EMULATOR__ = true;
        console.log("[firebase] Connected Auth emulator at 127.0.0.1:9099");
      }
      if (!g.__FSAE_DB_EMULATOR__) {
        connectFirestoreEmulator(db as any, "127.0.0.1", 8080);
        g.__FSAE_DB_EMULATOR__ = true;
        console.log("[firebase] Connected Firestore emulator at 127.0.0.1:8080");
      }
    } catch (e) {
      console.warn("[firebase] Emulator connect failed", e);
    }
  }
}
