import React, { useEffect, useMemo, useState } from "react";
import { fetchPeople, fetchTasks, fetchRankedSettings, refreshAllCaches } from "../lib/firestore";
import type { Person, Task, RankedSettings, RankLevel } from "../types";
import { useRankedEnabled } from "../hooks/useRankedEnabled";

// Display best rank first (Diamond → Bronze)
const RANKS: RankLevel[] = ["Diamond", "Platinum", "Gold", "Silver", "Bronze"];

function rankIcon(rank: RankLevel) {
  const name = rank.toLowerCase();
  return `/icons/rank-${name}.svg`;
}

export default function Ranked() {
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<RankedSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [rankedEnabled] = useRankedEnabled();
  const [nowTs, setNowTs] = useState<number>(Date.now());

  useEffect(() => {
    (async () => {
      await refreshAllCaches();
      const [p, t, s] = await Promise.all([fetchPeople(), fetchTasks(), fetchRankedSettings()]);
      setPeople(p);
      setTasks(t);
      setSettings(s);
    })();
    // Tick every second for countdown, and refresh data every 2 minutes for fresher points
    const tick = setInterval(() => setNowTs(Date.now()), 1000);
  const id = setInterval(async () => {
      try {
    await refreshAllCaches();
    const [p, t, s] = await Promise.all([fetchPeople(), fetchTasks(), fetchRankedSettings()]);
        setPeople(p);
        setTasks(t);
        setSettings(s);
      } catch {}
    }, 2 * 60 * 1000);
    return () => { clearInterval(id); clearInterval(tick); };
  }, []);

  // No admin controls here; application of promotions is managed in Admin.

  const participants = useMemo(() => {
    if (!settings) return [] as Person[];
    return people.filter(p => !!p.ranked_opt_in);
  }, [people, settings]);

  const scores = useMemo(() => {
    if (!settings) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const p of participants) m.set(p.id, 0);
    for (const t of tasks) {
      if (!t.assignee_id || !m.has(t.assignee_id)) continue;
      const pts = t.ranked_points ?? (t.status === "Complete" ? 35 : 10);
      m.set(t.assignee_id, (m.get(t.assignee_id) || 0) + pts);
    }
    return m;
  }, [participants, tasks, settings]);

  const byRank = useMemo(() => {
    const obj: Record<RankLevel, Person[]> = { Bronze: [], Silver: [], Gold: [], Platinum: [], Diamond: [] } as any;
    for (const p of participants) obj[(p.rank || "Bronze") as RankLevel].push(p);
    return obj;
  }, [participants]);

  if (!settings) return <div>Loading…</div>;

  // Countdown to next reset (testing: hourly). We use settings.last_reset_at as last apply boundary.
  const last = settings.last_reset_at || 0;
  // If last not set, assume period started at top of the current hour
  const topOfHour = (ts: number) => ts - (ts % (60*60*1000));
  const lastAnchor = last > 0 ? last : topOfHour(nowTs);
  const nextReset = lastAnchor + 60 * 60 * 1000; // hourly cadence
  const msLeft = Math.max(0, nextReset - nowTs);
  const hh = Math.floor(msLeft / 3600000);
  const mm = Math.floor((msLeft % 3600000) / 60000);
  const ss = Math.floor((msLeft % 60000) / 1000);
  const countdown = `${hh ? String(hh).padStart(2,'0')+':' : ''}${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Ranked</h1>
        <div className="ml-auto flex items-center gap-3">
          {settings.enabled && rankedEnabled ? (
            <div className="text-xs text-white/80 rounded border border-white/10 bg-white/5 px-2 py-1">
              Week ends in {countdown}
              <span className="ml-2 text-uconn-muted">(testing: hourly)</span>
            </div>
          ) : (
            <div className="text-xs text-red-300">Ranked mode is disabled</div>
          )}
        </div>
      </div>

      {/* Ranks tables */}
      {(!settings.enabled || !rankedEnabled) ? null : (
      <div className="grid lg:grid-cols-2 gap-4">
        {RANKS.map(level => {
          const list = (byRank[level] || []).slice().sort((a,b)=> (scores.get(b.id)||0)-(scores.get(a.id)||0));
          // Compute promotion/demotion bands per tier; used only for visual hints
          const key = level.toLowerCase() as "bronze"|"silver"|"gold"|"platinum"|"diamond";
          const promoPct = settings.promotion_pct?.[key] ?? 0;
          const demoPct = settings.demotion_pct?.[key] ?? 0;
          const promos = Math.floor((promoPct/100) * list.length);
          const demos = Math.floor((demoPct/100) * list.length);
          return (
            <div key={level} className="form-section p-0 overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10 bg-white/5">
                <img alt={level} src={rankIcon(level)} className="h-6 w-6" />
                <h2 className="font-semibold">{level}</h2>
                <span className="ml-auto text-xs text-uconn-muted">{list.length} in pool</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-uconn-muted border-b border-white/10">
                  <tr>
                    <th className="text-left px-3 py-2 w-8">#</th>
                    <th className="text-left px-2 py-2">Name</th>
                    <th className="text-right px-3 py-2 w-24">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p, i) => {
                    const isPromo = i < promos;
                    const isDemo = i >= Math.max(0, list.length - demos) && demos > 0;
                    const nameCls = `px-2 py-2 align-middle`;
                    const nameInnerCls = `pl-2 border-l-4 ${isPromo ? 'border-green-400' : isDemo ? 'border-red-400' : 'border-transparent'}`;
                    return (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="px-3 py-2 align-middle">{i+1}</td>
                        <td className={nameCls}><div className={nameInnerCls}>{p.name}</div></td>
                        <td className="px-3 py-2 align-middle text-right">{scores.get(p.id) || 0}</td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-uconn-muted">No participants</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
  )}
    </div>
  );
}
