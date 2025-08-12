import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp();
const db = admin.firestore();

// Types aligned with src/types.ts
type RankLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

type Person = {
  id: string;
  name: string;
  rank?: RankLevel;
  ranked_opt_in?: boolean;
  rank_history?: { ts: number; from: RankLevel; to: RankLevel }[];
};

type Task = {
  id: string;
  project_id: string;
  description: string;
  status: 'In Progress' | 'Complete' | 'Todo';
  assignee_id?: string;
  created_at?: number;
  completed_at?: number;
  ranked_points?: 5 | 10 | 25 | 35 | 50 | 100 | number;
};

type RankedSettings = {
  enabled?: boolean;
  autoApply?: boolean;
  applyEvery?: 'hourly' | 'weekly';
  promotion_pct?: Partial<Record<'bronze'|'silver'|'gold'|'platinum'|'diamond', number>>;
  demotion_pct?: Partial<Record<'bronze'|'silver'|'gold'|'platinum'|'diamond', number>>;
  default_task_points?: number;
};

const order: RankLevel[] = ['Bronze','Silver','Gold','Platinum','Diamond'];
const nextRank = (r: RankLevel): RankLevel => order[Math.min(order.indexOf(r)+1, order.length-1)];
const prevRank = (r: RankLevel): RankLevel => order[Math.max(order.indexOf(r)-1, 0)];

function taskPoints(t: Task, settings?: RankedSettings): number {
  if (typeof t.ranked_points === 'number') return t.ranked_points;
  const base = settings?.default_task_points ?? 10;
  if (t.status === 'Complete') return 35;
  if (t.status === 'In Progress') return base;
  return base;
}

async function computeAndApply() {
  const [peopleSnap, tasksSnap, rankedSnap] = await Promise.all([
    db.collection('people').get(),
    db.collection('tasks').get(),
    db.collection('ranked').get(),
  ]);

  const people: Person[] = peopleSnap.docs.map((d: admin.firestore.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) }));
  const tasks: Task[] = tasksSnap.docs.map((d: admin.firestore.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) }));

  const settingsDoc = rankedSnap.docs.find((d: admin.firestore.QueryDocumentSnapshot) => d.id === 'settings');
  const defaults: RankedSettings = {
    enabled: true,
    autoApply: true,
    applyEvery: 'hourly',
    promotion_pct: { bronze: 40, silver: 30, gold: 20, platinum: 10, diamond: 0 },
    demotion_pct: { bronze: 0, silver: 10, gold: 15, platinum: 20, diamond: 0 },
    default_task_points: 10,
  };
  const settings: RankedSettings = settingsDoc ? { ...defaults, ...(settingsDoc.data() as any) } : defaults;

  if (!settings.enabled || !settings.autoApply) {
    console.log('Ranked disabled or autoApply off. Skipping.');
    return { updated: 0, skipped: true };
  }

  // Filter participants
  const participants = people.filter(p => !!p.ranked_opt_in);

  // Compute scores
  const scores = new Map<string, number>();
  for (const p of participants) scores.set(p.id, 0);
  for (const t of tasks) {
    if (!t.assignee_id || !scores.has(t.assignee_id)) continue;
    const pts = taskPoints(t, settings);
    scores.set(t.assignee_id, (scores.get(t.assignee_id) || 0) + pts);
  }

  // Group by rank
  const byRank: Record<RankLevel, Person[]> = {
    Bronze: [], Silver: [], Gold: [], Platinum: [], Diamond: [],
  } as any;
  for (const p of participants) byRank[(p.rank || 'Bronze') as RankLevel].push(p);

  const updates: Array<{ id: string; to: RankLevel } > = [];
  const pct = (n?: number) => Math.max(0, Math.min(100, n ?? 0));

  for (const level of order) {
    const arr = byRank[level];
    if (!arr || arr.length === 0) continue;
    const sorted = [...arr].sort((a,b)=> (scores.get(b.id)||0) - (scores.get(a.id)||0));
    const key = level.toLowerCase() as 'bronze'|'silver'|'gold'|'platinum'|'diamond';
    const promoPct = pct(settings.promotion_pct?.[key]);
    const demoPct = pct(settings.demotion_pct?.[key]);
    const promos = Math.floor((promoPct/100) * sorted.length);
    const demos = Math.floor((demoPct/100) * sorted.length);

    if (level !== 'Diamond') {
      for (let i=0;i<promos;i++) {
        const p = sorted[i];
        updates.push({ id: p.id, to: nextRank(level) });
      }
    }
    if (level !== 'Bronze') {
      for (let i=0;i<demos;i++) {
        const p = sorted[sorted.length - 1 - i];
        updates.push({ id: p.id, to: prevRank(level) });
      }
    }
  }

  const now = Date.now();
  const batch = db.runTransaction(async (trx: admin.firestore.Transaction) => {
    for (const u of updates) {
      const ref = db.collection('people').doc(u.id);
      const snap = await trx.get(ref);
      const data = snap.data() as Person | undefined;
      const fromRank = (data?.rank || 'Bronze') as RankLevel;
      const toRank = u.to;
  if (fromRank !== toRank) {
        const prevHist = Array.isArray((data as any)?.rank_history) ? (data as any).rank_history : [];
        const nextHist = [...prevHist, { ts: now, from: fromRank, to: toRank }];
        trx.update(ref, { rank: toRank, rank_history: nextHist } as any);
      }
    }
  });
  await batch;

  // Update last_reset_at to now (period boundary)
  const settingsRef = db.collection('ranked').doc('settings');
  await settingsRef.set({ last_reset_at: Date.now() }, { merge: true });
  console.log(`Applied ${updates.length} rank updates`);
  return { updated: updates.length };
}

// Scheduled every hour (testing cadence).
export const applyRankedEvery15m = functions.pubsub
  .schedule('every 60 minutes')
  .timeZone('UTC')
  .onRun(async () => {
    try {
      return await computeAndApply();
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
