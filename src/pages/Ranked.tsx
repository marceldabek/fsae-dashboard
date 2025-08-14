import React, { useEffect, useMemo, useState } from "react";
import { fetchPeople, fetchTasks, fetchRankedSettings, refreshAllCaches, fetchAttendance, computeRankedScores } from "../lib/firestore";
import type { Person, Task, RankedSettings, RankLevel } from "../types";
import { useRankedEnabled } from "../hooks/useRankedEnabled";

// Display best rank first (Diamond → Bronze)
const RANKS: RankLevel[] = ["Diamond", "Platinum", "Gold", "Silver", "Bronze"];

function rankIcon(rank: RankLevel) {
  // Use Vite base for correct pathing on GitHub Pages or subpaths
  const base = import.meta.env.BASE_URL || '/';
  const name = rank.toLowerCase();
  // Use PNG for all tiers to ensure raster consistency and new assets
  const ext = 'png';
  return `${base}icons/rank-${name}.${ext}`;
}

export default function Ranked() {
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<RankedSettings | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [rankedEnabled] = useRankedEnabled();
  const [nowTs, setNowTs] = useState<number>(Date.now());

  useEffect(() => {
    (async () => {
      await refreshAllCaches();
  const [p, t, s, a] = await Promise.all([fetchPeople(), fetchTasks(), fetchRankedSettings(), fetchAttendance()]);
      setPeople(p);
      setTasks(t);
      setSettings(s);
  setAttendance(a);
    })();
    // Tick every second for countdown, and refresh data every 2 minutes for fresher points
    const tick = setInterval(() => setNowTs(Date.now()), 1000);
  const id = setInterval(async () => {
      try {
    await refreshAllCaches();
  const [p, t, s, a] = await Promise.all([fetchPeople(), fetchTasks(), fetchRankedSettings(), fetchAttendance()]);
        setPeople(p);
        setTasks(t);
        setSettings(s);
    setAttendance(a);
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
    return computeRankedScores(participants, tasks, settings, attendance as any);
  }, [participants, tasks, attendance, settings]);

  const byRank = useMemo(() => {
    const obj: Record<RankLevel, Person[]> = { Bronze: [], Silver: [], Gold: [], Platinum: [], Diamond: [] } as any;
    for (const p of participants) obj[(p.rank || "Bronze") as RankLevel].push(p);
    return obj;
  }, [participants]);

  // Countdown to next weekly reset: Sunday at 12:00 local time
  function nextSundayNoon(fromTs: number) {
    const d = new Date(fromTs);
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const daysUntilSun = (7 - day) % 7; // 0 if Sunday today
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilSun, 12, 0, 0, 0);
    // If we're already past today noon on Sunday, move to next week
    if (target.getTime() <= fromTs) {
      target.setDate(target.getDate() + 7);
    }
    return target.getTime();
  }
  const nextReset = nextSundayNoon(nowTs);
  const msLeft = Math.max(0, nextReset - nowTs);
  const dd = Math.floor(msLeft / 86400000);
  const hh = Math.floor((msLeft % 86400000) / 3600000);
  const mm = Math.floor((msLeft % 3600000) / 60000);
  const countdown = `${dd}d ${hh}h ${mm}m`;

  // Compute "Change Today": compare current index to index at start of day or after last reset if that was later.
  const startOfDay = (ts: number) => {
    const d = new Date(ts);
    d.setHours(0,0,0,0);
    return d.getTime();
  };
  const baselineTs = Math.max(startOfDay(nowTs), settings?.last_reset_at ?? 0);

  // Build the current sorted lists per tier (used both for display and to seed baseline when absent)
  const sortedByTier = useMemo(() => {
    const m: Record<RankLevel, Person[]> = { Bronze: [], Silver: [], Gold: [], Platinum: [], Diamond: [] } as any;
    for (const lvl of RANKS) {
      const list = (byRank[lvl] || []).slice().sort((a,b)=> (scores.get(b.id)||0)-(scores.get(a.id)||0));
      m[lvl] = list;
    }
    return m;
  }, [byRank, scores]);

  // Persist a per-tier baseline at the start of day/reset in localStorage and mirror it to state for rendering
  type BaselineState = { ts: number; indices: Record<RankLevel, Record<string, number>> };
  const [baseline, setBaseline] = useState<BaselineState>(() => {
    try {
      const data: BaselineState = {
        ts: baselineTs,
        indices: { Bronze: {}, Silver: {}, Gold: {}, Platinum: {}, Diamond: {} } as any
      };
      for (const lvl of RANKS) {
        const key = `ranked:baseline:${lvl}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { ts: number; indices: Record<string, number> };
          if (parsed && parsed.ts === baselineTs) {
            (data.indices as any)[lvl] = parsed.indices || {};
          }
        }
      }
      return data;
    } catch {
      return { ts: baselineTs, indices: { Bronze: {}, Silver: {}, Gold: {}, Platinum: {}, Diamond: {} } as any };
    }
  });

  useEffect(() => {
    // If stored baseline doesn't match current baselineTs or missing any tier, seed from current ordering
    const next: BaselineState = {
      ts: baselineTs,
      indices: { Bronze: {}, Silver: {}, Gold: {}, Platinum: {}, Diamond: {} } as any,
    };
    let changed = false;
    for (const lvl of RANKS) {
      const key = `ranked:baseline:${lvl}`;
      let indices: Record<string, number> | undefined;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { ts: number; indices: Record<string, number> };
          if (parsed.ts === baselineTs) indices = parsed.indices;
        }
      } catch {}
      if (!indices) {
        // seed from current order for this tier
        indices = {};
        const list = sortedByTier[lvl] || [];
        list.forEach((p, idx) => { indices![p.id] = idx; });
        try { localStorage.setItem(key, JSON.stringify({ ts: baselineTs, indices })); } catch {}
        changed = true;
      }
      (next.indices as any)[lvl] = indices || {};
    }
    if (changed || baseline.ts !== baselineTs) setBaseline(next);
  }, [baselineTs, sortedByTier]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Ranked</h1>
        <div className="ml-auto flex items-center gap-3">
          {settings === null ? (
            <div className="text-xs text-white/80 rounded border border-white/10 bg-white/5 px-2 py-1">Loading…</div>
          ) : (settings?.enabled && rankedEnabled ? (
            <div className="text-xs text-white/90 rounded-full border border-white/10 bg-white/5 px-3 py-1 shadow-sm">
              Week ends in <span className="font-semibold">{countdown}</span>
            </div>
          ) : (
            <div className="text-xs text-red-300">Ranked mode is disabled</div>
          ))}
        </div>
      </div>

      {/* Legend (single, applies to all tiers) */}
  <div className="mb-3 text-xs text-muted uppercase tracking-caps">
        Legend: green left border = promotion zone, red left border = demotion zone. Change Today: ▲ moved up, ▼ moved down.
      </div>

      {/* Ranks tables */}
      {(!settings?.enabled || !rankedEnabled) ? null : (
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
            <div key={level} className="form-section p-0">
              <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10 bg-white/5">
                <img alt={level} src={rankIcon(level)} className="h-6 w-6 object-contain" />
                <h2 className="font-semibold">{level}</h2>
                <span className="ml-auto text-xs text-muted uppercase tracking-caps">{list.length} in pool</span>
              </div>
      <table className="w-full text-[13px] sm:text-sm">
                <thead className="text-xs text-muted uppercase tracking-caps border-b border-border/60">
                  <tr>
        <th className="text-left px-2 py-2 w-6">#</th>
        <th className="text-left px-2 py-2">Name</th>
        <th className="text-right px-2 py-2 w-12">Pts</th>
        <th className="text-right px-2 py-2 w-12">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p, i) => {
                    const isPromo = i < promos;
                    const isDemo = i >= Math.max(0, list.length - demos) && demos > 0;
                    const nameCls = `px-2 py-2 align-middle`;
                    const nameInnerCls = `pl-2 border-l-4 whitespace-nowrap truncate max-w-[9.5rem] overflow-hidden ${isPromo ? 'border-green-400' : isDemo ? 'border-red-400' : 'border-transparent'}`;
                    // Determine baseline index within this tier
                    const baselineIndexRaw = (baseline.indices as any)[level]?.[p.id];
                    const baselineIndex = typeof baselineIndexRaw === 'number' ? baselineIndexRaw : i;
                    const delta = baselineIndex - i; // + means moved up (smaller current index)
                    return (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="px-2 py-1.5 align-middle">{i+1}</td>
                        <td className={nameCls}><div className={nameInnerCls}>{p.name}</div></td>
                        <td className="px-2 py-1.5 align-middle text-right tabular-nums">{scores.get(p.id) || 0}</td>
                        <td className="px-2 py-1.5 align-middle text-right tabular-nums">
                          {delta === 0 ? (
                            <span className="text-muted">0</span>
                          ) : (
                            <span className={delta > 0 ? 'text-green-400' : 'text-red-400'}>
                              {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-muted">No participants</td></tr>
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
