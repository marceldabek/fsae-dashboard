import * as admin from "firebase-admin";

// Usage:
//   npm run build --prefix functions
//   node lib/scripts/seedAdmins.js
// Writes/merges Firestore doc: config/admins
// Adjust arrays below as needed.

const ADMIN_UIDS = [
  "T7Nm42EBy0Y3tK6dLKDdclOPyX52", // Marcel
  "0VMXQhAk0Xe3SbpzKXKh67HFDbM2", // Brandon
];
const LEAD_UIDS: string[] = [
  // Add lead UIDs here if desired
];

async function main(): Promise<void> {
  admin.initializeApp();
  const db = admin.firestore();
  await db
    .collection("config")
    .doc("admins")
  .set({ uids: ADMIN_UIDS, leads: LEAD_UIDS }, { merge: true });
  // eslint-disable-next-line no-console
  console.log("Wrote config/admins", {
    uids: ADMIN_UIDS.length,
    leads: LEAD_UIDS.length,
  });
  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
