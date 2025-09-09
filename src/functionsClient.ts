// Centralized Functions client (callables + emulator wiring)
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

// Always specify region explicitly to avoid multi-region latency surprises
export const functionsClient = getFunctions(app, 'us-central1');

// Connect emulator in dev (your firebase.json sets port 5002)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  try {
    const host = window.location.hostname;
    if ((host === 'localhost' || host === '127.0.0.1')) {
      const g: any = globalThis as any;
      if (!g.__FSAE_FN_EMULATOR__) {
        connectFunctionsEmulator(functionsClient, host, 5002);
        g.__FSAE_FN_EMULATOR__ = true;
      }
    }
  } catch (e) {
    // Emulator connection failed
  }
}

// Typed callable wrapper
interface AdminRolesFull { isAdmin: boolean; isLead: boolean; adminUids?: string[]; leadUids?: string[]; }
export const callGetAdminRoles = httpsCallable<undefined, unknown>(functionsClient, 'getAdminRoles');
