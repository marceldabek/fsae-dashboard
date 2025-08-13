
// Controls whether Admin UI appears (Firestore rules should still enforce writes)
// Support multiple admin UIDs.
export const ADMIN_UIDS = [
	"T7Nm42EBy0Y3tK6dLKDdclOPyX52", // primary admin
	"0VMXQhAk0Xe3SbpzKXKh67HFDbM2", // additional admin (friend)
];

// Back-compat for old imports comparing against a single constant (not used anymore by code we updated)
export const ADMIN_UID = ADMIN_UIDS[0];

export function isAdminUid(uid?: string | null): boolean {
	return !!uid && ADMIN_UIDS.includes(uid);
}
