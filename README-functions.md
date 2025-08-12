# Cloud Functions for Ranked Auto-Apply

This project adds a scheduled Firebase Cloud Function that recalculates and applies ranked promotions/demotions every 15 minutes.

## What it does
- Reads `ranked/settings` to honor `enabled` and `autoApply` flags and percentage tables.
- Aggregates points from `tasks` for `people` who opted into ranked via `ranked_opt_in`.
- Promotes the top X% and relegates the bottom Y% per rank tier, with guard rails: no promotion from Diamond, no demotion from Bronze.
- Appends to `people.rank_history` when a rank change occurs.

## Deploy
1. Ensure you have the Firebase CLI installed and are logged in.
2. Set your Firebase project:
   - Update `.firebaserc` to your project ID or run `firebase use YOUR_PROJECT_ID`.
3. Deploy functions:
   - From repo root:
     - `npm --prefix functions install`
     - `npm --prefix functions run build`
     - `firebase deploy --only functions`

The function name is `applyRankedEvery15m` and will execute every 15 minutes.

## Notes
- The function uses Node.js 20 runtime.
- Security: It runs with Admin privileges; Firestore rules don’t apply.
- If you prefer a different cadence, tweak the schedule string in `functions/src/index.ts`.
