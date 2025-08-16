/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

// Initialize the Admin SDK once. If already initialized reuse it.
try { admin.app(); } catch (e) { admin.initializeApp(); }

interface RolesDoc { uids?: string[]; leads?: string[]; }

// Domain model minimal shapes (only fields we read/write).
type RankLevel = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";
interface Person {
	id: string;
	ranked_opt_in?: boolean;
	rank?: RankLevel;
	ranked_points?: number;
}
interface Task {
	id: string;
	assignee_id?: string;
	ranked_points?: number;
	status?: string;
	completed_at?: number;
	created_at?: number;
}
interface AttendanceRec {
	id: string;
	person_id?: string;
	points?: number;
	created_at?: number;
}

/**
 * Callable: getAdminRoles
 * Returns role booleans for caller. If caller is a full admin, also returns
 * the full admin + lead UID arrays. Non‑admins/leads do not see the lists.
 */
export const getAdminRoles = onCall(async (request) => {
	const auth = request.auth;
	if (!auth) {
		throw new HttpsError("unauthenticated", "Must be signed in");
	}

	const snap = await admin
		.firestore()
		.collection("config")
		.doc("admins")
		.get();
	const data: RolesDoc = snap.exists ? (snap.data() as RolesDoc) : {};

	const adminUids = Array.isArray(data.uids) ? data.uids : [];
	const leadUids = Array.isArray(data.leads) ? data.leads : [];
	const uid = auth.uid;
	const isAdmin = adminUids.includes(uid);
	const isLead = isAdmin || leadUids.includes(uid);

	if (isAdmin) {
		return { isAdmin, isLead, adminUids, leadUids };
	}
	return { isAdmin, isLead };
});

// ---------- Ranked mode server-side automation ----------

interface RankedSettings {
	enabled?: boolean;
	autoApply?: boolean;
	applyEvery?: "hourly" | "weekly"; // we only automate weekly here
	promotion_pct?: Partial<Record<Lowercase<RankLevel>, number>>;
	demotion_pct?: Partial<Record<Lowercase<RankLevel>, number>>;
	default_task_points?: number;
	last_reset_at?: number; // boundary timestamp
}

// Load ranked settings (with defaults) from Firestore
async function loadRankedSettings(): Promise<RankedSettings> {
	const snap = await admin.firestore().collection("ranked").doc("settings").get();
	const defaults: RankedSettings = {
		enabled: true,
		autoApply: true,
		applyEvery: "weekly",
		promotion_pct: { bronze: 40, silver: 30, gold: 20, platinum: 10, diamond: 0 },
		demotion_pct: { bronze: 0, silver: 10, gold: 15, platinum: 20, diamond: 0 },
		default_task_points: 10,
	};
	return snap.exists ? { ...defaults, ...(snap.data() as Partial<RankedSettings>) } : defaults;
}

async function setRankedSettings(data: Partial<RankedSettings>) {
	await admin.firestore().collection("ranked").doc("settings").set(data, { merge: true });
}

// Compute task points mirroring client logic
function taskPoints(t: Task, settings: RankedSettings): number {
	if (typeof t.ranked_points === "number") return t.ranked_points;
	const base = settings.default_task_points ?? 10;
	if (t.status === "Complete") return 35;
	if (t.status === "In Progress") return base;
	return base;
}

function nextRank(level: RankLevel): RankLevel {
	const order: RankLevel[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
	return order[Math.min(order.indexOf(level) + 1, order.length - 1)];
}
function prevRank(level: RankLevel): RankLevel {
	const order: RankLevel[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
	return order[Math.max(order.indexOf(level) - 1, 0)];
}

// Compute scores since last boundary
function computeScores(people: Person[], tasks: Task[], settings: RankedSettings, attendance: AttendanceRec[]): Map<string, number> {
	const scores = new Map<string, number>();
	const boundary = settings.last_reset_at || 0;
	for (const p of people) {
		if (!p.ranked_opt_in) continue;
		scores.set(p.id, 0);
	}
	for (const t of tasks) {
		if (!t.assignee_id || !scores.has(t.assignee_id)) continue;
		const ts = t.completed_at || t.created_at || 0;
		if (ts < boundary) continue;
		scores.set(t.assignee_id, (scores.get(t.assignee_id) || 0) + taskPoints(t, settings));
	}
	for (const a of attendance) {
		if (!a.person_id || !scores.has(a.person_id)) continue;
		const ats = a.created_at || 0;
		if (ats < boundary) continue;
		const pts = Math.max(0, Number(a.points || 0));
		if (pts) scores.set(a.person_id, (scores.get(a.person_id) || 0) + pts);
	}
	return scores;
}

async function fetchCollections(): Promise<{ people: Person[]; tasks: Task[]; attendance: AttendanceRec[] }> {
	const db = admin.firestore();
	const [peopleSnap, tasksSnap, attendanceSnap] = await Promise.all([
		db.collection("people").get(),
		db.collection("tasks").get(),
		db.collection("attendance").get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
	]);
	const people = peopleSnap.docs.map(d => ({ id: d.id, ...(d.data() as Partial<Person>) })) as Person[];
	const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...(d.data() as Partial<Task>) })) as Task[];
	const attendance = attendanceSnap.docs.map(d => ({ id: d.id, ...(d.data() as Partial<AttendanceRec>) })) as AttendanceRec[];
	return { people, tasks, attendance };
}

// Promotion/demotion algorithm (server copy of client logic)
function computeRankUpdates(people: Person[], scores: Map<string, number>, settings: RankedSettings) {
	const participants = people.filter(p => p.ranked_opt_in);
	const ranks: RankLevel[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
	const byRank: Record<RankLevel, Person[]> = { Bronze: [], Silver: [], Gold: [], Platinum: [], Diamond: [] };
	for (const p of participants) byRank[(p.rank || "Bronze") as RankLevel].push(p);
	const pct = (n?: number) => Math.max(0, Math.min(100, n ?? 0));
	const updates: Array<{ id: string; to: RankLevel; from: RankLevel }> = [];
	for (const level of ranks) {
		const arr = byRank[level];
		if (!arr.length) continue;
		const sorted = [...arr].sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
		const key = level.toLowerCase() as Lowercase<RankLevel>;
		const promoPct = pct(settings.promotion_pct?.[key]);
		const demoPct = pct(settings.demotion_pct?.[key]);
		const promos = Math.floor((promoPct / 100) * sorted.length);
		const demos = Math.floor((demoPct / 100) * sorted.length);
		if (level !== "Diamond") {
			for (let i = 0; i < promos; i++) {
				const p = sorted[i];
				updates.push({ id: p.id, from: level, to: nextRank(level) });
			}
		}
		if (level !== "Bronze") {
			for (let i = 0; i < demos; i++) {
				const p = sorted[sorted.length - 1 - i];
				updates.push({ id: p.id, from: level, to: prevRank(level) });
			}
		}
	}
	return updates.filter(u => u.from !== u.to);
}

async function applyRankUpdates(updates: Array<{ id: string; from: RankLevel; to: RankLevel }>) {
	if (!updates.length) return;
	const db = admin.firestore();
	const now = Date.now();
	const batch = db.batch();
	// Some environments (emulator / future SDK changes) may not expose FieldValue on admin.firestore
	// Guard it so we fail gracefully instead of throwing undefined.errors
	const fieldValue = (admin.firestore as unknown as { FieldValue?: typeof admin.firestore.FieldValue }).FieldValue;
	for (const u of updates) {
		const ref = db.collection("people").doc(u.id);
		if (fieldValue?.arrayUnion) {
			batch.update(ref, {
				rank: u.to,
				rank_history: fieldValue.arrayUnion({ ts: now, from: u.from, to: u.to }),
			});
		} else {
			// Fallback: append by reading existing history later (less efficient but avoids failure)
			batch.update(ref, { rank: u.to });
			// Queue a separate write for history after commit (collected)
		}
	}
	await batch.commit();
	// If FieldValue missing, do a follow-up append (rare path)
	if (!fieldValue?.arrayUnion) {
		for (const u of updates) {
			const ref = db.collection("people").doc(u.id);
			try {
				await ref.set({
					rank_history: admin.firestore.FieldValue?.arrayUnion
						? admin.firestore.FieldValue.arrayUnion({ ts: now, from: u.from, to: u.to })
						: [{ ts: now, from: u.from, to: u.to }],
				}, { merge: true });
			} catch (e) {
				console.error("[rank] history append fallback failed", u.id, e);
			}
		}
	}
	try {
		await db.collection("logs").add({ ts: now, type: "rank_apply", note: `Applied ${updates.length} rank changes` });
	} catch { /* no-op */ }
}

async function writeBaseline(scores: Map<string, number>, people: Person[]) {
	const db = admin.firestore();
	const participants = people.filter(p => p.ranked_opt_in);
	const orderedParticipants = [...participants].sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
	const ordered = orderedParticipants.map(p => p.id);
	// Also capture per-tier ordering for richer client deltas (tiers.<Rank> = [ids])
	const ranks: RankLevel[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
	const tiers: Record<string, string[]> = {};
	for (const r of ranks) {
		const tierList = orderedParticipants.filter(p => (p.rank || "Bronze") === r).sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
		tiers[r] = tierList.map(p => p.id);
	}
	const now = Date.now();
	const rankedCol = db.collection("ranked");
	const prevSnap = await rankedCol.doc("baseline_today").get();
	const prevData = prevSnap.exists ? prevSnap.data() : null;
	if (prevData) {
		await rankedCol.doc("baseline_prev").set(prevData, { merge: true });
	}
	await rankedCol.doc("baseline_today").set({ ts: now, people: ordered, tiers }, { merge: true });
}

// Callable manual apply (admin only)
export const applyRankedChanges = onCall(async (request) => {
	if (!request.auth) throw new HttpsError("unauthenticated", "Must sign in");
	const uid = request.auth.uid;
	const start = Date.now();
	console.log("[rank] applyRankedChanges invoked by", uid);
	try {
		// Admin check by reading config/admins
		const adminDoc = await admin.firestore().collection("config").doc("admins").get();
		const adminUids: string[] = adminDoc.exists ? (adminDoc.data()?.uids || []) : [];
		if (!adminUids.includes(uid)) throw new HttpsError("permission-denied", "Admin only");
		const settings = await loadRankedSettings();
		const { people, tasks, attendance } = await fetchCollections();
		console.log("[rank] fetched collections", { people: people.length, tasks: tasks.length, attendance: attendance.length });
		const scores = computeScores(people, tasks, settings, attendance);
		const updates = computeRankUpdates(people, scores, settings);
		console.log("[rank] computed updates", { updates: updates.length });
		await applyRankUpdates(updates);
		// Reset boundary and baseline after apply
		const now = Date.now();
		await setRankedSettings({ last_reset_at: now });
		await writeBaseline(scores, people);
		console.log("[rank] applyRankedChanges success", { applied: updates.length, ms: Date.now() - start });
		return { applied: updates.length };
	} catch (err: unknown) {
		console.error("[rank] applyRankedChanges error", err);
		if (err instanceof HttpsError) throw err; // preserve explicit errors
		if (err instanceof Error) {
			throw new HttpsError("internal", "apply failed: " + err.message);
		}
		throw new HttpsError("internal", "apply failed");
	}
});

// Nightly baseline snapshot (America/New_York) at 00:05 local time
export const nightlyRankBaseline = onSchedule({ schedule: "every day 00:05", timeZone: "America/New_York" }, async () => {
	const settings = await loadRankedSettings();
	if (!settings.enabled) return;
	const { people, tasks, attendance } = await fetchCollections();
	const scores = computeScores(people, tasks, settings, attendance);
	await writeBaseline(scores, people);
});

// Weekly promotions (Monday 00:10 America/New_York treated as end-of-week apply)
export const weeklyRankApply = onSchedule({ schedule: "every monday 00:10", timeZone: "America/New_York" }, async () => {
	const settings = await loadRankedSettings();
	if (!settings.enabled || !settings.autoApply || settings.applyEvery !== "weekly") return;
	const { people, tasks, attendance } = await fetchCollections();
	const scores = computeScores(people, tasks, settings, attendance);
	const updates = computeRankUpdates(people, scores, settings);
	if (updates.length) await applyRankUpdates(updates);
	const now = Date.now();
	await setRankedSettings({ last_reset_at: now });
	await writeBaseline(scores, people);
});

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Removed temporary ping function.

// (Other function exports can be added above.)
