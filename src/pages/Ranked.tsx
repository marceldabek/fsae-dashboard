import React, { useEffect, useMemo, useState } from "react";
import { fetchPeople, fetchTasks, fetchRankedSettings, refreshAllCaches, fetchAttendance, computeRankedScores } from "../lib/firestore";
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
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
  const [baseline, setBaseline] = useState<{ ts: number; tiers: Record<string,string[]>; people: string[] } | null>(null);

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

  // Server-driven baseline: baseline_today doc written by nightly or manual apply
  useEffect(()=>{
    let stopped = false;
    (async ()=>{
      try {
        const snap = await getDoc(doc(db,'ranked','baseline_today'));
        if (!stopped) {
          if (snap.exists()) setBaseline(snap.data() as any);
          else setBaseline(null);
        }
      } catch { setBaseline(null); }
    })();
    const id = setInterval(async ()=>{
      try {
        const snap = await getDoc(doc(db,'ranked','baseline_today'));
        if (!stopped) {
          if (snap.exists()) setBaseline(snap.data() as any);
        }
      } catch {}
    }, 60*1000); // refresh baseline view every minute
    return ()=>{ stopped = true; clearInterval(id); };
  },[]);

  // Build current sorted lists per tier
  const sortedByTier = useMemo(() => {
    const m: Record<RankLevel, Person[]> = { Bronze: [], Silver: [], Gold: [], Platinum: [], Diamond: [] } as any;
    for (const lvl of RANKS) {
      const list = (byRank[lvl] || []).slice().sort((a,b)=> (scores.get(b.id)||0)-(scores.get(a.id)||0));
      m[lvl] = list;
    }
    return m;
  }, [byRank, scores]);

  // Helper to get baseline index per tier from server baseline tiers map
  function getBaselineIndex(level: RankLevel, personId: string, fallback: number): number {
    const tierList: string[] | undefined = (baseline as any)?.tiers?.[level];
    if (!tierList) return fallback;
    const idx = tierList.indexOf(personId);
    return idx === -1 ? fallback : idx;
  }

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
                    const baselineIndex = getBaselineIndex(level, p.id, i);
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
