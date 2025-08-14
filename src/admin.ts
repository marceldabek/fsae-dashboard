
// Role configuration
// Full admins have unrestricted access to all admin tabs and privileged actions.
export const ADMIN_UIDS = [
	"T7Nm42EBy0Y3tK6dLKDdclOPyX52", // primary admin (Marcel)
	"0VMXQhAk0Xe3SbpzKXKh67HFDbM2", // additional full admin (Brandon)
];

// Leads have limited access (People + Projects & Tasks tabs only). Add up to ~10 user UIDs here.
// NOTE: Keeping this list in code means a redeploy is required to modify roles.
// For a more dynamic approach consider Firebase Auth custom claims or a Firestore roles doc.
export const LEAD_UIDS: string[] = [
	// "someLeadUserUid1",
];

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
	if (isAdminUid(uid)) return true; // full access
	if (!isLeadUid(uid)) return false; // no access at all
	// Lead limitations
	return tab === "people" || tab === "projects"; // only these two for leads
}
