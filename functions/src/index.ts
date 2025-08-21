// functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2/options";
import * as admin from "firebase-admin";

// Initialize Admin once
try {
  admin.app();
} catch {
  admin.initializeApp();
}

// Global defaults
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// ---------- Roles ----------

// ALWAYS return uid, isAdmin, isLead, adminUids, leadUids, version
export const getAdminRoles = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Must be signed in");

  type RoleDoc = { uids?: unknown; leads?: unknown };
  const toUidArray = (v: unknown) =>
    Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : [];

  const db = admin.firestore();
  const [asnap, lsnap] = await Promise.all([
    db.doc("config/admins").get(),
    db.doc("config/leads").get(),
  ]);

  const adminData = (asnap.data() as RoleDoc) ?? {};
  const leadData = (lsnap.data() as RoleDoc) ?? {};

  const adminUids = toUidArray(adminData.uids ?? adminData.leads);
  const leadUids = toUidArray(leadData.uids ?? leadData.leads);

  const me = uid.trim();
  const isAdmin = adminUids.includes(me);
  const isLead = isAdmin || leadUids.includes(me);

  // ...removed roles-debug log...

  return { uid: me, isAdmin, isLead, adminUids, leadUids, version: "cf-roles-v2" };
});

// ---------- Ranked mode server-side automation ----------

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

interface RankedSettings {
  enabled?: boolean;
  autoApply?: boolean;
  applyEvery?: "hourly" | "weekly";
  promotion_pct?: Partial<Record<Lowercase<RankLevel>, number>>;
  demotion_pct?: Partial<Record<Lowercase<RankLevel>, number>>;
  default_task_points?: number;
  last_reset_at?: number;
}

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

function computeScores(
  people: Person[],
  tasks: Task[],
  settings: RankedSettings,
  attendance: AttendanceRec[],
): Map<string, number> {
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

async function fetchCollections(): Promise<{
  people: Person[];
  tasks: Task[];
  attendance: AttendanceRec[];
}> {
  const db = admin.firestore();
  const [peopleSnap, tasksSnap, attendanceSnap] = await Promise.all([
    db.collection("people").get(),
    db.collection("tasks").get(),
    db.collection("attendance").get().catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
  ]);

  const people = peopleSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<Person>) })) as Person[];
  const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<Task>) })) as Task[];
  const attendance = attendanceSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<AttendanceRec>) })) as AttendanceRec[];

  return { people, tasks, attendance };
}

function computeRankUpdates(people: Person[], scores: Map<string, number>, settings: RankedSettings) {
  const participants = people.filter((p) => p.ranked_opt_in);
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

  return updates.filter((u) => u.from !== u.to);
}

async function applyRankUpdates(updates: Array<{ id: string; from: RankLevel; to: RankLevel }>) {
  if (!updates.length) return;

  const db = admin.firestore();
  const now = Date.now();
  const batch = db.batch();

  const fieldValue = (admin.firestore as unknown as { FieldValue?: typeof admin.firestore.FieldValue }).FieldValue;

  for (const u of updates) {
    const ref = db.collection("people").doc(u.id);
    if (fieldValue?.arrayUnion) {
      batch.update(ref, {
        rank: u.to,
        rank_history: fieldValue.arrayUnion({ ts: now, from: u.from, to: u.to }),
      });
    } else {
      batch.update(ref, { rank: u.to });
    }
  }

  await batch.commit();

  if (!fieldValue?.arrayUnion) {
    for (const u of updates) {
      const ref = db.collection("people").doc(u.id);
      try {
        await ref.set(
          {
            rank_history: admin.firestore.FieldValue?.arrayUnion
              ? admin.firestore.FieldValue.arrayUnion({ ts: now, from: u.from, to: u.to })
              : [{ ts: now, from: u.from, to: u.to }],
          },
          { merge: true },
        );
      } catch (e) {
        console.error("[rank] history append fallback failed", u.id, e);
      }
    }
  }

  try {
    await db.collection("logs").add({ ts: now, type: "rank_apply", note: `Applied ${updates.length} rank changes` });
  } catch {
    // no-op
  }
}

async function writeBaseline(scores: Map<string, number>, people: Person[]) {
  const db = admin.firestore();
  const participants = people.filter((p) => p.ranked_opt_in);
  const orderedParticipants = [...participants].sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
  const ordered = orderedParticipants.map((p) => p.id);

  const ranks: RankLevel[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
  const tiers: Record<string, string[]> = {};

  for (const r of ranks) {
    const tierList = orderedParticipants
      .filter((p) => (p.rank || "Bronze") === r)
      .sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
    tiers[r] = tierList.map((p) => p.id);
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

  try {
    const adminDoc = await admin.firestore().collection("config").doc("admins").get();
    const adminUids: string[] = adminDoc.exists ? (adminDoc.data()?.uids || []) : [];
    if (!adminUids.includes(uid)) throw new HttpsError("permission-denied", "Admin only");

    const settings = await loadRankedSettings();
    const { people, tasks, attendance } = await fetchCollections();
    const scores = computeScores(people, tasks, settings, attendance);
    const updates = computeRankUpdates(people, scores, settings);

    await applyRankUpdates(updates);
    const now = Date.now();
    await setRankedSettings({ last_reset_at: now });
    await writeBaseline(scores, people);

    return { applied: updates.length, ms: Date.now() - start };
  } catch (err: unknown) {
    console.error("[rank] applyRankedChanges error", err);
    if (err instanceof HttpsError) throw err;
    if (err instanceof Error) throw new HttpsError("internal", "apply failed: " + err.message);
    throw new HttpsError("internal", "apply failed");
  }
});

// Nightly baseline snapshot
export const nightlyRankBaseline = onSchedule(
  { schedule: "every day 00:05", timeZone: "America/New_York" },
  async () => {
    const settings = await loadRankedSettings();
    if (!settings.enabled) return;
    const { people, tasks, attendance } = await fetchCollections();
    const scores = computeScores(people, tasks, settings, attendance);
    await writeBaseline(scores, people);
  },
);

// Weekly promotions
export const weeklyRankApply = onSchedule(
  { schedule: "every monday 00:10", timeZone: "America/New_York" },
  async () => {
    const settings = await loadRankedSettings();
    if (!settings.enabled || !settings.autoApply || settings.applyEvery !== "weekly") return;
    const { people, tasks, attendance } = await fetchCollections();
    const scores = computeScores(people, tasks, settings, attendance);
    const updates = computeRankUpdates(people, scores, settings);
    if (updates.length) await applyRankUpdates(updates);
    const now = Date.now();
    await setRankedSettings({ last_reset_at: now });
    await writeBaseline(scores, people);
  },
);
