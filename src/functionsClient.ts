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
        console.log('[functions] Connected emulator at', host, 5002);
      }
    }
  } catch (e) {
    console.warn('[functions] emulator connect failed', e);
  }
}

// Typed callable wrapper
interface AdminRolesFull { isAdmin: boolean; isLead: boolean; adminUids?: string[]; leadUids?: string[]; }
export const callGetAdminRoles = httpsCallable<undefined, AdminRolesFull>(functionsClient, 'getAdminRoles');

export async function loadAdminRoles(): Promise<AdminRolesFull | null> {
  try {
    const res = await callGetAdminRoles();
    return res?.data || null;
  } catch (e) {
    console.warn('[functions] getAdminRoles failed', e);
    return null;
  }
}
