
import { collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, increment } from "firebase/firestore";
import { db } from "../firebase";
import type { Person, Project, Task, RankedSettings, RankLevel, Attendance, LogEvent, DailyAnalytics } from "../types";
import { isCurrentUserAdmin } from "../auth";

// ---- Simple client-side cache with TTL ----
type CacheKey = "people" | "projects" | "tasks" | `tasks:project:${string}` | "settings" | "ranked:settings";
const CACHE_PREFIX = "fsae:";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes; tweak as desired

function makeKey(key: CacheKey) { return `${CACHE_PREFIX}${key}`; }

function readCache<T>(key: CacheKey): T | null {
  // Admins should always see fresh data
  if (isCurrentUserAdmin()) return null;
  try {
    const raw = localStorage.getItem(makeKey(key));
    if (!raw) return null;
    const { exp, data } = JSON.parse(raw);
    if (exp && Date.now() < exp) return data as T;
    // expired
    localStorage.removeItem(makeKey(key));
    return null;
  } catch { return null; }
}

function writeCache<T>(key: CacheKey, data: T, ttlMs = DEFAULT_TTL_MS) {
  if (isCurrentUserAdmin()) return; // don't persist admin views
  try {
    const payload = JSON.stringify({ exp: Date.now() + ttlMs, data });
    localStorage.setItem(makeKey(key), payload);
  } catch { /* storage full or unavailable */ }
}

function bustCache(keys: CacheKey[]) {
  for (const k of keys) try { localStorage.removeItem(makeKey(k)); } catch {}
}

function bustCacheByPrefix(prefix: string) {
  try {
    const full = CACHE_PREFIX + prefix;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      if (key.startsWith(full)) localStorage.removeItem(key);
    }
  } catch {}
}

// Proactively refresh caches in the background (called from app shell)
export async function refreshAllCaches() {
  if (isCurrentUserAdmin()) return; // skip admin
  try {
    const [pplSnap, projSnap, taskSnap, settingsSnap, rankedSnap] = await Promise.all([
      getDocs(collection(db, "people")),
      getDocs(collection(db, "projects")),
      getDocs(collection(db, "tasks")),
      getDocs(collection(db, "settings")),
      getDocs(collection(db, "ranked")),
    ]);
    writeCache("people", pplSnap.docs.map(d => d.data() as Person));
    writeCache("projects", projSnap.docs.map(d => d.data() as Project));
    writeCache("tasks", taskSnap.docs.map(d => d.data() as Task));
  const d = settingsSnap.docs.find(x => x.id === "global");
    if (d) writeCache("settings", d.data() as any);
  const r = rankedSnap.docs.find(x => x.id === "settings");
  if (r) writeCache("ranked:settings", r.data() as any);
  } catch {
    // ignore background refresh errors
  }
}

// Clear all app-managed localStorage caches (does not affect Firestore IndexedDB)
export function clearAllLocalCaches() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      if (key.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {}
}

// Utility to remove keys whose value is strictly undefined (Firestore disallows them)
function pruneUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean;
}

export async function fetchPeople(): Promise<Person[]> {
  const cached = readCache<Person[]>("people");
  if (cached) return cached;
  const snap = await getDocs(collection(db, "people"));
  const data = snap.docs.map(d => d.data() as Person);
  writeCache("people", data);
  return data;
}

export async function fetchProjects(): Promise<Project[]> {
  const cached = readCache<Project[]>("projects");
  if (cached) return cached;
  const snap = await getDocs(collection(db, "projects"));
  const data = snap.docs.map(d => d.data() as Project);
  writeCache("projects", data);
  return data;
}

export async function fetchTasks(): Promise<Task[]> {
  const cached = readCache<Task[]>("tasks");
  if (cached) return cached;
  const snap = await getDocs(collection(db, "tasks"));
  const data = snap.docs.map(d => d.data() as Task);
  writeCache("tasks", data);
  return data;
}

export async function fetchTasksForProject(projectId: string): Promise<Task[]> {
  const key = `tasks:project:${projectId}` as CacheKey;
  const cached = readCache<Task[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "tasks"), where("project_id", "==", projectId));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => d.data() as Task);
  writeCache(key, data);
  return data;
}

// Admin-only ops (security enforced by Firestore Rules)
export async function addTask(t: Omit<Task, "id">) {
  const now = Date.now();
  const payload: Omit<Task, "id"> = { ...t, created_at: t.created_at ?? now } as any;
  const ref = await addDoc(collection(db, "tasks"), pruneUndefined(payload));
  await updateDoc(ref, { id: ref.id });
  bustCache(["tasks"]);
  bustCacheByPrefix("tasks:project:");
  return ref.id;
}

export async function updateTask(id: string, data: Partial<Task>) {
  const ref = doc(db, "tasks", id);
  // read current to detect transitions
  let prev: Task | null = null;
  try {
    const snap = await getDoc(ref);
    prev = (snap.exists() ? (snap.data() as Task) : null);
  } catch {}
  // auto-stamp completed_at if moving to Complete and not set
  const patch = { ...data } as Partial<Task> & { completed_at?: number };
  if (data.status === "Complete" && (data as any).completed_at === undefined) {
    patch.completed_at = Date.now();
  }
  await updateDoc(ref, pruneUndefined(patch as any));
  bustCache(["tasks"]);
  bustCacheByPrefix("tasks:project:");

  // If newly completed, log task points for the assignee
  try {
    const wasComplete = prev?.status === "Complete";
    const nowComplete = data.status === "Complete";
    if (!wasComplete && nowComplete) {
      const settings = await fetchRankedSettings();
      const effectiveAssignee = (data.assignee_id ?? prev?.assignee_id) || undefined;
      const pts = taskPoints({ ...(prev || {} as any), status: "Complete" } as Task, settings);
      await addLogEvent({
        ts: Date.now(),
        type: "task_points",
        person_id: effectiveAssignee,
        points: pts,
        note: `Task complete: ${(prev?.description || id)}`,
      });
    }
  } catch {}
}

export async function deleteTaskById(id: string) {
  const ref = doc(db, "tasks", id);
  await deleteDoc(ref);
  bustCache(["tasks"]);
  bustCacheByPrefix("tasks:project:");
}

// Attendance helpers
export async function addAttendance(a: Omit<Attendance, "id">) {
  const now = Date.now();
  // Prevent duplicate attendance for the same person and date (best-effort client check)
  if (a.person_id && a.date) {
    const qDup = query(
      collection(db, "attendance"),
      where("person_id", "==", a.person_id),
      where("date", "==", a.date)
    );
    const dupSnap = await getDocs(qDup);
    if (!dupSnap.empty) {
      const err: any = new Error("DUPLICATE_ATTENDANCE");
      err.code = "DUPLICATE_ATTENDANCE";
      throw err;
    }
  }
  const payload: Omit<Attendance, "id"> = { ...a, created_at: a.created_at ?? now };
  const ref = await addDoc(collection(db, "attendance"), pruneUndefined(payload as any));
  await updateDoc(ref, { id: ref.id });
  // Log the event
  try {
    await addLogEvent({
      ts: now,
      type: "attendance",
      person_id: a.person_id,
      points: a.points,
      note: `Attendance ${a.points} pts on ${a.date}`,
    });
  } catch {}
  return ref.id;
}

export async function fetchAttendance(): Promise<Attendance[]> {
  const snap = await getDocs(collection(db, "attendance"));
  return snap.docs.map(d => d.data() as Attendance);
}

// ---- Ranked/Activity log helpers ----
export async function addLogEvent(e: Omit<LogEvent, "id">) {
  const ref = await addDoc(collection(db, "logs"), pruneUndefined(e as any));
  await updateDoc(ref, { id: ref.id });
  return ref.id;
}

export async function fetchRecentLogs(limit: number = 50): Promise<LogEvent[]> {
  // Using getDocs(collection) then sort client-side since we didn't add an index/orderBy to keep it simple client-only.
  const snap = await getDocs(collection(db, "logs"));
  const rows = snap.docs.map(d => d.data() as LogEvent).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return rows.slice(0, Math.max(1, limit));
}

// Fetch all log events for a specific person (no limit) and sort newest first.
// This is client-filtered; for large datasets consider adding a Firestore index + query.
export async function fetchLogsForPerson(personId: string): Promise<LogEvent[]> {
  const snap = await getDocs(collection(db, "logs"));
  return snap.docs
    .map(d => d.data() as LogEvent)
    .filter(l => l.person_id === personId)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

// Simple color palette for charts
export function palette(i: number) {
  const colors = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#f87171", "#22d3ee", "#84cc16", "#fb7185", "#f59e0b"];
  return colors[i % colors.length];
}


export async function updateProjectOwners(projectId: string, owner_ids: string[]) {
  const ref = doc(db, "projects", projectId);
  await updateDoc(ref, { owner_ids });
  bustCache(["projects", "people"]);
}


export async function addPerson(p: Omit<Person, "id"> & { id?: string }) {
  if (p.id) {
    const ref = doc(db, "people", p.id);
  await setDoc(ref, pruneUndefined({ ...p, id: p.id }), { merge: true }); // create-or-merge
  bustCache(["people"]);
    return p.id;
  } else {
  const ref = await addDoc(collection(db, "people"), pruneUndefined(p as any)); // auto-id
    await updateDoc(ref, { id: ref.id });
  bustCache(["people"]);
    return ref.id;
  }
}

export async function addProject(pr: Omit<Project, "id"> & { id?: string }) {
  const now = Date.now();
  if (pr.id) {
    const ref = doc(db, "projects", pr.id);
    await setDoc(ref, pruneUndefined({ ...pr, id: pr.id, created_at: pr.created_at ?? now }), { merge: true }); // create-or-merge
    bustCache(["projects"]);
    return pr.id;
  } else {
    const ref = await addDoc(collection(db, "projects"), pruneUndefined({ ...pr, created_at: now } as any));
    await updateDoc(ref, { id: ref.id });
    bustCache(["projects"]);
    return ref.id;
  }
}

// Simple settings doc: settings/global => { rulebook_url?: string }
export async function updatePerson(id: string, patch: Partial<Person>) {
  const ref = doc(db, "people", id);
  await updateDoc(ref, pruneUndefined(patch as any));
  bustCache(["people"]);
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const ref = doc(db, "projects", id);
  await updateDoc(ref, pruneUndefined(patch as any));
  bustCache(["projects"]);
}

// Soft archive a project (sets archived: true). UI should hide archived projects unless explicitly requested.
export async function archiveProject(id: string) {
  const ref = doc(db, "projects", id);
  await updateDoc(ref, { archived: true } as any);
  bustCache(["projects"]);
}

export async function deleteProject(id: string) {
  // Best-effort: delete tasks under this project first
  try {
    const qTasks = query(collection(db, "tasks"), where("project_id", "==", id));
    const snap = await getDocs(qTasks);
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "tasks", d.id))));
  } catch {}
  await deleteDoc(doc(db, "projects", id));
  bustCache(["projects", "tasks"]);
}

export async function fetchSettings(): Promise<{ rulebook_url?: string; sharepoint_url?: string } | null> {
  const cached = readCache<any>("settings");
  if (cached) return cached;
  const snap = await getDocs(collection(db, "settings"));
  const d = snap.docs.find(x => x.id === "global");
  const data = d ? (d.data() as any) : null;
  if (data) writeCache("settings", data, DEFAULT_TTL_MS);
  return data;
}

export async function setSettings(data: { rulebook_url?: string; sharepoint_url?: string }) {
  const ref = doc(db, "settings", "global");
  await setDoc(ref, { ...(data || {}) }, { merge: true });
  bustCache(["settings"]);
}

// Ranked settings
export async function fetchRankedSettings(): Promise<RankedSettings> {
  const cached = readCache<RankedSettings>("ranked:settings");
  if (cached) return cached;
  const snap = await getDocs(collection(db, "ranked"));
  const d = snap.docs.find(x => x.id === "settings");
  const defaults: RankedSettings = {
    enabled: true,
    autoApply: true,
    applyEvery: "hourly",
    promotion_pct: { bronze: 40, silver: 30, gold: 20, platinum: 10, diamond: 0 },
    demotion_pct: { bronze: 0, silver: 10, gold: 15, platinum: 20, diamond: 0 },
  default_task_points: 10,
  };
  const data = d ? ({ ...defaults, ...(d.data() as any) } as RankedSettings) : defaults;
  writeCache("ranked:settings", data, DEFAULT_TTL_MS);
  return data;
}

export async function setRankedSettings(s: Partial<RankedSettings>) {
  const ref = doc(db, "ranked", "settings");
  await setDoc(ref, pruneUndefined(s as any), { merge: true });
  bustCache(["ranked:settings"]);
}

// Helper to stamp the boundary (used after weekly/hourly apply). Consumers use this to know when a new period starts.
export async function markRankedResetBoundary(ts: number = Date.now()) {
  await setRankedSettings({ last_reset_at: ts });
}

// Helpers for ranked mode
export function rankOrder(level: RankLevel): number {
  return ("Bronze Silver Gold Platinum Diamond" as const).split(" ").indexOf(level);
}

export function nextRank(level: RankLevel): RankLevel {
  const order: RankLevel[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
  return order[Math.min(order.indexOf(level) + 1, order.length - 1)];
}

export function prevRank(level: RankLevel): RankLevel {
  const order: RankLevel[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
  return order[Math.max(order.indexOf(level) - 1, 0)];
}

export function taskPoints(t: Task, settings?: RankedSettings): number {
  if (t.ranked_points) return t.ranked_points;
  // fallback: heavier weight to Completed vs Todo/In Progress
  const base = settings?.default_task_points ?? 10;
  if (t.status === "Complete") return 35; // medium by default
  if (t.status === "In Progress") return base;
  return base; // Todo
}

// Compute total points for each person for the period
export function computeRankedScores(people: Person[], tasks: Task[], settings: RankedSettings, attendance?: Attendance[]): Map<string, number> {
  const scores = new Map<string, number>();
  const optIn = (p: Person) => !!p.ranked_opt_in; // opt-in only
  const boundary = settings.last_reset_at || 0; // only count activity on/after boundary
  for (const p of people) {
    if (!optIn(p)) continue;
    scores.set(p.id, 0);
  }
  for (const t of tasks) {
    if (!t.assignee_id) continue;
    if (!scores.has(t.assignee_id)) continue;
    const ts = (t.completed_at || t.created_at || 0);
    if (ts < boundary) continue; // outside current period
    const pts = taskPoints(t, settings);
    scores.set(t.assignee_id, (scores.get(t.assignee_id) || 0) + pts);
  }
  if (attendance && attendance.length) {
    for (const a of attendance) {
      if (!a.person_id) continue;
      if (!scores.has(a.person_id)) continue;
      const ats = (a as any).created_at || 0;
      if (ats < boundary) continue;
      const pts = Math.max(0, Number(a.points || 0));
      if (!pts) continue;
      scores.set(a.person_id, (scores.get(a.person_id) || 0) + pts);
    }
  }
  return scores;
}

// Apply promotion/relegation tables based on percentages and funneling rules
export async function applyRankedPromotionsDemotions(people: Person[], tasks: Task[], settings: RankedSettings, attendance?: Attendance[]) {
  // Group participants by rank
  const participants = people.filter(p => !!p.ranked_opt_in); // opt-in only
  const byRank: Record<RankLevel, Person[]> = {
    Bronze: [], Silver: [], Gold: [], Platinum: [], Diamond: [],
  } as any;
  for (const p of participants) byRank[(p.rank || "Bronze") as RankLevel].push(p);

  const scores = computeRankedScores(participants, tasks, settings, attendance);

  const updates: Array<{ id: string; rank: RankLevel }> = [];
  const pct = (n?: number) => Math.max(0, Math.min(100, n ?? 0));

  const ranks: RankLevel[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
  for (const level of ranks) {
    const arr = byRank[level];
    if (arr.length === 0) continue;
    // Sort by score desc
    const sorted = [...arr].sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
    const key = (level.toLowerCase() as "bronze" | "silver" | "gold" | "platinum" | "diamond");
    const promoPct = pct(settings.promotion_pct?.[key]);
    const demoPct = pct(settings.demotion_pct?.[key]);
    const promos = Math.floor((promoPct / 100) * sorted.length);
    const demos = Math.floor((demoPct / 100) * sorted.length);

    // Apply fixed boundaries: no promotion from Diamond, no demotion from Bronze
    if (level !== "Diamond") {
      for (let i = 0; i < promos; i++) {
        const p = sorted[i];
        const newRank = nextRank(level);
        updates.push({ id: p.id, rank: newRank });
      }
    }
    if (level !== "Bronze") {
      for (let i = 0; i < demos; i++) {
        const p = sorted[sorted.length - 1 - i];
        const newRank = prevRank(level);
        updates.push({ id: p.id, rank: newRank });
      }
    }
  }

  // Persist updates (+ append rank history)
  const ops: Promise<any>[] = [];
  const now = Date.now();
  for (const u of updates) {
    const person = people.find(p => p.id === u.id);
    const fromRank = (person?.rank || "Bronze") as RankLevel;
    const toRank = u.rank;
    // Only write history if there is an actual change
    if (fromRank === toRank) {
      ops.push(updateDoc(doc(db, "people", u.id), { rank: toRank }));
    } else {
      const prevHist = Array.isArray((person as any)?.rank_history) ? (person as any).rank_history : [];
      const nextHist = [...prevHist, { ts: now, from: fromRank, to: toRank }];
      ops.push(updateDoc(doc(db, "people", u.id), { rank: toRank, rank_history: nextHist } as any));
      // log event per person rank change
      ops.push(addLogEvent({ ts: now, type: "rank_change", person_id: u.id, from_rank: fromRank, to_rank: toRank }));
    }
  }
  await Promise.all(ops);
  const now2 = Date.now();
  // One aggregate entry for apply action
  try { await addLogEvent({ ts: now2, type: "rank_apply", note: `Applied promotions/demotions to ${updates.length} person(s)` }); } catch {}
  // Mark new period boundary so UI resets "Change Today" and timers; this is effectively the weekly reset anchor
  try { await markRankedResetBoundary(now2); } catch {}
  bustCache(["people"]);
  return updates.length;
}

// Danger zone: remove all people, projects, and tasks documents.
export async function fullSystemReset() {
  // Note: Firestore charges per document delete; ensure admin-only access in security rules.
  // This will delete all people, projects, tasks, attendance, logs, and ranked data except settings and admin/lead UIDs.
  const [peopleSnap, projectsSnap, tasksSnap, attendanceSnap, logsSnap, rankedSnap] = await Promise.all([
    getDocs(collection(db, "people")),
    getDocs(collection(db, "projects")),
    getDocs(collection(db, "tasks")),
    getDocs(collection(db, "attendance")),
    getDocs(collection(db, "logs")),
    getDocs(collection(db, "ranked")),
  ]);

  // Delete tasks first (downstream of projects/people conceptually)
  const deletes: Promise<any>[] = [];
  for (const d of tasksSnap.docs) deletes.push(deleteDoc(doc(db, "tasks", d.id)));
  for (const d of projectsSnap.docs) deletes.push(deleteDoc(doc(db, "projects", d.id)));
  for (const d of peopleSnap.docs) deletes.push(deleteDoc(doc(db, "people", d.id)));
  for (const d of attendanceSnap.docs) deletes.push(deleteDoc(doc(db, "attendance", d.id)));
  for (const d of logsSnap.docs) deletes.push(deleteDoc(doc(db, "logs", d.id)));
  for (const d of rankedSnap.docs) {
    // Only delete ranked docs that are not settings (preserve settings)
    if (d.id !== "settings") deletes.push(deleteDoc(doc(db, "ranked", d.id)));
  }
  await Promise.all(deletes);

  // Clear caches
  bustCache(["people", "projects", "tasks"]);
  bustCacheByPrefix("tasks:project:");
  bustCache(["ranked:settings"]);
}

// ---- Anonymous visit tracking (privacy-friendly) ----
// Each browser profile gets a random localStorage ID (not sent to server). We only
// increment a daily aggregate doc once per client per day. No IPs, no cookies.
const VISITOR_KEY = `${CACHE_PREFIX}visitor:id`;
const VISIT_STAMP_KEY = `${CACHE_PREFIX}visitor:last_date`;

function ensureVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

export async function recordAnonymousVisit() {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const last = localStorage.getItem(VISIT_STAMP_KEY);
    if (last === today) return; // already counted today
    ensureVisitorId();
    const ref = doc(db, "analytics_daily", today);
    await setDoc(ref, { date: today, visits: increment(1) } as any, { merge: true });
    localStorage.setItem(VISIT_STAMP_KEY, today);
  } catch {
    // ignore (offline). Optionally could queue a retry.
  }
}

export async function fetchDailyAnalyticsRange(daysBack: number): Promise<DailyAnalytics[]> {
  const snap = await getDocs(collection(db, "analytics_daily"));
  const all = snap.docs.map(d => d.data() as DailyAnalytics);
  const today = new Date();
  const cutoff = new Date();
  cutoff.setDate(today.getDate() - (daysBack - 1));
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return all
    .filter(r => r.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}
