
// Role configuration
// Full admins have unrestricted access to all admin tabs and privileged actions.
// NOTE: Admin UIDs are seeded at runtime from Firestore `config/admins`.
// The functions repo includes a seed helper at `functions/scripts/seedAdmins.ts`.
export const ADMIN_UIDS: string[] = [];

// Leads have limited access (People + Projects & Tasks tabs only). Add up to ~10 user UIDs here.
// NOTE: Keeping this list in code means a redeploy is required to modify roles.
// For a more dynamic approach consider Firebase Auth custom claims or a Firestore roles doc.
export const LEAD_UIDS: string[] = [];

// Back-compat: keep original constant meaning "first full admin"
export const ADMIN_UID = ADMIN_UIDS[0];

export function isAdminUid(uid?: string | null): boolean {
	return !!uid && ADMIN_UIDS.includes(uid);
}

export function isLeadUid(uid?: string | null): boolean {
	return !!uid && (LEAD_UIDS.includes(uid) || isAdminUid(uid)); // full admins implicitly count as leads
}

// Any elevated role (lead OR full admin)
export function hasAdminPageAccess(uid?: string | null): boolean {
	return isLeadUid(uid) || isAdminUid(uid);
}

// Utility to test tab visibility
export type AdminTab = "people" | "projects" | "settings" | "ranked";
export function canViewAdminTab(uid: string | null | undefined, tab: AdminTab): boolean {
	if (isAdminUid(uid)) return true; // full admins see all tabs
	if (!isLeadUid(uid)) return false; // no access
	// Leads: hide only settings & ranked tabs
	return tab === "people" || tab === "projects";
}

// Runtime setter used by the app shell to populate roles from Firestore at startup.
export function setRuntimeAdmins(uids: string[], leads: string[]) {
	ADMIN_UIDS.length = 0; ADMIN_UIDS.push(...(uids || []));
	LEAD_UIDS.length = 0; LEAD_UIDS.push(...(leads || []));
	// Notify listeners so UI can re-render immediately
	roleListeners.forEach(l => {
		try { l(); } catch {}
	});
}

// Lightweight subscription so components can re-render when roles change
const roleListeners = new Set<() => void>();
export function subscribeAdminRoleChanges(listener: () => void) {
 	roleListeners.add(listener);
 	return () => roleListeners.delete(listener);
}

// Fetch roles via callable function and update runtime lists.
// Falls back to Firestore doc read if full lists not returned (non-admin caller).
import { getAuth } from 'firebase/auth';
import { loadAdminRoles } from './functionsClient';

// Fetch roles via callable function and update runtime lists (static imports to avoid chunk warning).
export async function loadRuntimeAdminsViaFunctions() {
	try {
		const data: any = await loadAdminRoles();
		if (!data) return;
		if (Array.isArray(data.adminUids) || Array.isArray(data.leadUids)) {
			setRuntimeAdmins(data.adminUids || [], data.leadUids || []);
			return;
		}
		const auth = getAuth();
		const uid = auth.currentUser?.uid;
		if (uid) {
			const admins = data.isAdmin ? [uid] : [];
			const leads = data.isLead ? [uid] : [];
			setRuntimeAdmins(admins, leads);
		}
	} catch (e) {
		console.warn('[roles] loadRuntimeAdminsViaFunctions failed', e);
	}
}
