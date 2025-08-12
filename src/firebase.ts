
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
} from "firebase/firestore";

// If you later add App Check, import it here.

export const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });

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
