import { useEffect, useMemo, useState } from "react";
import { fetchPeople, fetchProjects, fetchTasks, fetchAttendance, palette, fetchDailyAnalyticsRange } from "../lib/firestore";
import type { Person, Project, Task, Attendance } from "../types";

// Lazy import Recharts pieces to keep bundle light if page not visited
// Vite will code-split this page anyway since it's route-lazy.
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";

export default function Stats() {
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [dailyAnalytics, setDailyAnalytics] = useState<{ date: string; visits?: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ppl, projs, tks, att, analytics] = await Promise.all([
          fetchPeople(),
          fetchProjects(),
          fetchTasks(),
          fetchAttendance(),
          fetchDailyAnalyticsRange(30).catch(() => []),
        ]);
        if (!alive) return;
        setPeople(ppl);
        setProjects(projs);
        setTasks(tks);
        setAttendance(att);
        setDailyAnalytics(analytics);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const totals = useMemo(() => {
    // Exclude tasks that belong to archived projects from the general "byStatus" totals
    const projByIdAll = new Map(projects.map(p => [p.id, p] as const));
    const byStatus = { Todo: 0, "In Progress": 0, Complete: 0 } as Record<Task["status"], number>;
    for (const t of tasks) {
      const proj = projByIdAll.get(t.project_id);
      if (proj && (proj as any).archived) continue; // ignore tasks from archived projects for these totals
      byStatus[t.status]++;
    }
    return {
      totalTasks: tasks.length,
      byStatus,
      totalPeople: people.length,
      totalProjects: projects.length,
    };
  }, [people.length, projects.length, tasks]);

  // Estimate hours of unassigned work (tasks without an assignee and not complete)
  // using the same non-linear points→hours mapping as ProjectDetail. If a task
  // has no ranked_points, assume a small default (2h) so the metric reflects
  // real backlog instead of 0.
  const ptsToHours = (p: number) => {
    if (p === 1) return 0.5;
    if (p === 3) return 1;
    if (p === 10) return 3;
    if (p === 6) return 2;
    if (p === 15) return 5;
    if (p === 40) return 10;
    if (p === 65) return 15;
    if (p === 98) return 20;
    if (p === 150) return 25;
    if (p === 200) return 30;
    return Math.max(0, Math.round(p / 4));
  };
  const unassignedHours = useMemo(() => {
    let sum = 0;
    for (const t of tasks) {
      if (t.status !== "Complete" && (!t.assignee_id || t.assignee_id === "")) {
        if (typeof t.ranked_points === "number") sum += ptsToHours(t.ranked_points);
        else sum += 2; // fallback when no points estimate present
      }
    }
    return Math.round(sum);
  }, [tasks]);

  // Productivity over time: completed tasks per week (simple bins)
  const weekly = useMemo(() => {
    const bins = new Map<string, number>();
    for (const t of tasks) {
      const stamp = t.completed_at ?? 0;
      if (!stamp) continue;
      const d = new Date(stamp);
      // ISO week key: YYYY-Www
      const year = d.getUTCFullYear();
      const firstJan = new Date(Date.UTC(year, 0, 1));
      const day = Math.floor((d.getTime() - firstJan.getTime()) / 86400000);
      const week = Math.floor((day + firstJan.getUTCDay()) / 7) + 1;
      const key = `${year}-W${String(week).padStart(2, "0")}`;
      bins.set(key, (bins.get(key) || 0) + 1);
    }
    return Array.from(bins.entries())
      .map(([week, completed]) => ({ week, completed }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [tasks]);

  // Tasks completed past 14 days (daily bins)
  const last14Days = useMemo(() => {
    const now = new Date();
    const days: { day: string; completed: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ day: key, completed: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.day, i]));
    for (const t of tasks) {
      if (!t.completed_at) continue;
      const day = new Date(t.completed_at).toISOString().slice(0, 10);
      const i = idx.get(day);
      if (i !== undefined) days[i].completed += 1;
    }
    return days;
  }, [tasks]);

  // Trim leading zero-completion days so mobile view doesn't show activity compressed at far right
  const last14DaysDisplay = useMemo(() => {
    const firstNonZero = last14Days.findIndex(d => d.completed > 0);
    if (firstNonZero > 2) {
      return last14Days.slice(firstNonZero - 1); // keep one context day before first activity
    }
    return last14Days;
  }, [last14Days]);

  // Subsystem segmented bars: proportions of Todo / In Progress / Complete across all tasks in the subsystem
  // Subsystem segmented bars: exclude archived projects so subsystem status reflects active work only
  const subsystemSegments = useMemo(() => {
    const bySubsystem = new Map<string, { todo: number; progress: number; done: number }>();
    const projById = new Map(projects.map(p => [p.id, p] as const));
    for (const t of tasks) {
      const proj = projById.get(t.project_id);
      if (proj && (proj as any).archived) continue; // ignore archived project tasks for subsystem status
      const key = proj?.subsystem || "Unassigned";
      const entry = bySubsystem.get(key) || { todo: 0, progress: 0, done: 0 };
      if (t.status === "Complete") entry.done += 1;
      else if (t.status === "In Progress") entry.progress += 1;
      else entry.todo += 1;
      bySubsystem.set(key, entry);
    }
    return Array.from(bySubsystem.entries()).map(([subsystem, v]) => {
      const total = v.todo + v.progress + v.done;
      const toPct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
      return { subsystem, total, todo: v.todo, progress: v.progress, done: v.done, todoPct: toPct(v.todo), progressPct: toPct(v.progress), donePct: toPct(v.done) };
    }).sort((a, b) => a.subsystem.localeCompare(b.subsystem));
  }, [projects, tasks]);

  // Per-person completion counts
  const perPerson = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.status === "Complete" && t.assignee_id) {
        map.set(t.assignee_id, (map.get(t.assignee_id) || 0) + 1);
      }
    }
    const rows = people.map(p => ({ name: p.name, completed: map.get(p.id) || 0 }));
    // show top 10 by default
    return rows.sort((a, b) => b.completed - a.completed).slice(0, 10);
  }, [people, tasks]);

  // Project progress: percent complete per project
  const projectProgress = useMemo(() => {
    const byProject = new Map<string, { total: number; done: number; name: string }>();
    for (const p of projects) {
      byProject.set(p.id, { total: 0, done: 0, name: p.name });
    }
    for (const t of tasks) {
      const entry = byProject.get(t.project_id);
      if (!entry) continue;
      entry.total += 1;
      if (t.status === "Complete") entry.done += 1;
    }
    const rows = Array.from(byProject.entries()).map(([id, v]) => ({
      project: v.name,
      percent: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }));
    return rows.sort((a, b) => b.percent - a.percent).slice(0, 10);
  }, [projects, tasks]);

  // Daily hours by subsystem (completed tasks only, last 30 days). Converts ranked_points to approximate hours.
  const dailyHoursBySubsystem = useMemo(() => {
    const daysBack = 30;
    const today = new Date();
    const dayKeys: string[] = [];
    for (let i = daysBack - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const dayIndex = new Map(dayKeys.map((d, i) => [d, i] as const));
    const projById = new Map(projects.map(p => [p.id, p] as const));
    const subsystems = new Set<string>();
    // Build matrix: day -> subsystem -> hours
    const matrix: Record<string, Record<string, number>> = {};
    for (const key of dayKeys) matrix[key] = {};
    for (const t of tasks) {
      if (t.status !== "Complete" || !t.completed_at) continue;
      const day = new Date(t.completed_at).toISOString().slice(0, 10);
      if (!dayIndex.has(day)) continue; // outside window
      const proj = projById.get(t.project_id);
      const subsystem = proj?.subsystem || "Unassigned";
      subsystems.add(subsystem);
      const hours = typeof t.ranked_points === "number" ? ptsToHours(t.ranked_points) : 2;
      matrix[day][subsystem] = (matrix[day][subsystem] || 0) + hours;
    }
    const subsysList = Array.from(subsystems.values()).sort();
    return dayKeys.map(day => {
      const row: any = { day };
      for (const s of subsysList) row[s] = matrix[day][s] || 0;
      return row;
    });
  }, [projects, tasks]);

  // Exponential smoothing (alpha=0.3) to soften single-day spikes; one-line update per key
  const dailyHoursBySubsystemSmooth = useMemo(() => { const rows=dailyHoursBySubsystem; if(!rows.length) return []; const keys=Object.keys(rows[0]).filter(k=>k!=='day'); const alpha=0.3; const prev:Record<string,number>={}; return rows.map(r=>{const o:any={day:r.day}; keys.forEach(k=>o[k]=prev[k]=prev[k]==null?r[k]:alpha*r[k]+(1-alpha)*prev[k]); return o;}); }, [dailyHoursBySubsystem]);

  // Trim leading zero visits so chart focus isn't shoved to far right on mobile
  const dailyAnalyticsDisplay = useMemo(() => {
    const firstNonZero = dailyAnalytics.findIndex(d => (d.visits || 0) > 0);
    if (firstNonZero > 2) return dailyAnalytics.slice(firstNonZero - 1);
    return dailyAnalytics;
  }, [dailyAnalytics]);
  if (loading) return <div className="text-sm text-muted">Loading stats…</div>;

  return (
    <div className="space-y-6">
  {/* Responsive heading: shrink on very small screens */}
  <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-caps">Stats</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Projects" value={totals.totalProjects} />
        <StatCard label="People" value={totals.totalPeople} />
        <StatCard label="Tasks" value={totals.totalTasks} />
        <StatCard label="Tasks Done" value={totals.byStatus["Complete"]} />
        <StatCard label="Unassigned Work" value={`${unassignedHours} ${unassignedHours === 1 ? 'hour' : 'hours'}`} />
        <StatCard label="Visits Today" value={(dailyAnalytics.find(d => d.date === new Date().toISOString().slice(0,10))?.visits) ?? 0} />
      </div>

  <Section title="Tasks completed" subtitle="Past 14 days">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last14DaysDisplay} margin={{ top: 6, right: 10, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
              <XAxis
                dataKey="day"
        tick={{ fill: "#BDC0C3", fontSize: 11 }}
        minTickGap={12}
        angle={-30}
        textAnchor="end"
        height={54}
                tickFormatter={(v: string) => {
                  // v is YYYY-MM-DD; display as M/D
                  const [y, m, d] = v.split("-").map(Number);
                  return `${m}/${d}`;
                }}
              />
              <YAxis allowDecimals={false} tick={{ fill: "#BDC0C3", fontSize: 11 }} domain={[0, 'dataMax + 1']} width={28} />
              <Tooltip contentStyle={{ background: "#0F1B3A", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="completed" stroke="#34D399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

  <Section title="Completions per week">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
              <XAxis dataKey="week" hide={weekly.length > 20} tick={{ fill: "#BDC0C3", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#BDC0C3", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0F1B3A", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8 }} />
              <Legend />
      {/* Use accent for weekly, differentiating from daily (success) */}
      <Line type="monotone" dataKey="completed" stroke="#64C7C9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

  {/* Removed Top contributors section per request */}

  <Section title="Subsystem status" subtitle="Task counts">
        <div className="space-y-2">
          <div className="text-xs text-muted flex flex-wrap items-center gap-3 uppercase tracking-caps">
            <span className="font-semibold text-white">Legend</span>
            <span className="flex items-center gap-1 normal-case"><span className="w-3 h-3 rounded-sm bg-success inline-block" /> <span className="text-[11px]">Complete</span></span>
            <span className="flex items-center gap-1 normal-case"><span className="w-3 h-3 rounded-sm bg-warning inline-block" /> <span className="text-[11px]">In&nbsp;Progress</span></span>
            <span className="flex items-center gap-1 normal-case"><span className="w-3 h-3 rounded-sm bg-muted/40 inline-block" /> <span className="text-[11px]">Todo</span></span>
            <span className="text-[11px] text-muted/70 ml-auto md:ml-4 normal-case font-normal tracking-normal">Left→Right: Complete · In Progress · Todo</span>
          </div>
          <ul className="space-y-2">
            {subsystemSegments.map(row => (
              <li key={row.subsystem} className="flex items-center gap-3">
                <div className="w-32 md:w-40 text-sm truncate">{row.subsystem}</div>
                <div className="flex-1 h-3 rounded bg-overlay-6 overflow-hidden flex">
                  <div className="h-full" style={{ flexGrow: row.done, flexBasis: 0, background: '#34D399' }} />
                  <div className="h-full" style={{ flexGrow: row.progress, flexBasis: 0, background: '#FACC15' }} />
                  <div className="h-full" style={{ flexGrow: row.todo, flexBasis: 0, background: 'rgba(255,255,255,0.25)' }} />
                </div>
                <div className="hidden md:block w-28 text-right text-xs text-muted">{row.done}/{row.total} done</div>
              </li>
            ))}
            {subsystemSegments.length === 0 && (
              <li className="text-sm text-muted">No subsystem data</li>
            )}
          </ul>
        </div>
      </Section>

  <Section title="Attendance" subtitle="Last 10 meetings">
        <div className="h-48">
          <AttendanceLast10 attendance={attendance} />
        </div>
      </Section>

  <Section title="Daily hours by subsystem" subtitle="Last 30 days">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyHoursBySubsystem} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
              <XAxis
                dataKey="day"
                interval={2}
                tick={{ fill: "#BDC0C3", fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                height={60}
                tickFormatter={(v: string) => {
                  const [y, m, d] = v.split("-");
                  return `${m}/${d}`;
                }}
              />
              <YAxis allowDecimals={false} tick={{ fill: "#BDC0C3", fontSize: 11 }} label={{ value: "Hours", angle: -90, position: 'insideLeft', fill: '#BDC0C3', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0F1B3A", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8 }} />
              <Legend />
              {Array.from(new Set(projects.map(p => p.subsystem || "Unassigned")).values()).sort().map((sub, i) => {
                // Extended deterministic palette derived from accent + success + warning variants
                const cycle = ['#64C7C9', '#98D7D8', '#34D399', '#FACC15', '#3BA7A9', '#2E7D7F'];
                return <Line key={sub} type="monotone" dataKey={sub} stroke={cycle[i % cycle.length]} strokeWidth={2} dot={false} />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

  <Section title="Daily hours by subsystem" subtitle="Smoothed (α=0.3)">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyHoursBySubsystemSmooth} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
              <XAxis
                dataKey="day"
                interval={2}
                tick={{ fill: "#BDC0C3", fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                height={60}
                tickFormatter={(v: string) => {
                  const [y,m,d] = v.split('-');
                  return `${m}/${d}`;
                }}
              />
              <YAxis allowDecimals={false} tick={{ fill: "#BDC0C3", fontSize: 11 }} label={{ value: "Smoothed Hours", angle: -90, position: 'insideLeft', fill: '#BDC0C3', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0F1B3A", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8 }} />
              <Legend />
              {Object.keys(dailyHoursBySubsystemSmooth[0] || {}).filter(k => k !== 'day').map((sub, i) => {
                const cycle = ['#64C7C9', '#98D7D8', '#34D399', '#FACC15', '#3BA7A9', '#2E7D7F'];
                return <Line key={sub} type="monotone" dataKey={sub} stroke={cycle[i % cycle.length]} strokeWidth={2} dot={false} />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
  <p className="mt-2 text-tick text-muted">Exponential smoothing (α=0.3) dampens spikes from large task completions while keeping trends clear. Raw totals (previous chart) remain the authoritative sum.</p>
      </Section>

  <Section title="Daily visits" subtitle="Last 30 days">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyAnalyticsDisplay} margin={{ top: 6, right: 10, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
              <XAxis
                dataKey="date"
                interval={3}
                tick={{ fill: "#BDC0C3", fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                height={54}
                tickFormatter={(v: string) => {
                  const [y,m,d] = v.split('-');
                  return `${m}/${d}`;
                }}
              />
              <YAxis allowDecimals={false} tick={{ fill: "#BDC0C3", fontSize: 11 }} width={28} />
              <Tooltip contentStyle={{ background: "#0F1B3A", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8 }} />
              {/* Use accent-weak to differentiate from weekly completions */}
              <Line type="monotone" dataKey="visits" stroke="#98D7D8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-overlay-6 p-4">
      {/* Section title shrinks on narrow phones */}
      <h2 className="text-base sm:text-lg font-semibold uppercase tracking-caps mb-1">{title}</h2>
      {subtitle && <div className="text-[11px] sm:text-xs text-muted mb-3 -mt-1">{subtitle}</div>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-overlay-6 p-3 h-full flex flex-col justify-between">
      <div className="text-[11px] sm:text-xs text-muted uppercase tracking-caps font-semibold">{label}</div>
      {/* Value size responsive: smaller on very small screens */}
      <div className="text-lg sm:text-2xl font-bold text-center leading-tight">{value}</div>
    </div>
  );
}

function AttendanceLast10({ attendance }: { attendance: Attendance[] }) {
  // Compute last ten meeting dates (Tue=2, Thu=4, Sat=6)
  const meetingDays = new Set([2, 4, 6]);
  const from = new Date();
  const days: string[] = [];
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (days.length < 10) {
    if (meetingDays.has(cursor.getDay())) days.push(fmt(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  const counts = new Map<string, number>(days.map(d => [d, 0]));
  for (const a of attendance) {
    if (counts.has(a.date)) counts.set(a.date, (counts.get(a.date) || 0) + 1);
  }
  const data = [...days].reverse().map(date => {
    const d = new Date(date + 'T00:00:00');
    const label = `${d.getMonth() + 1}/${d.getDate()}`; // M/D format
    return { date, label, attendees: counts.get(date) || 0 };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 10, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="attLast10Line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#64C7C9" />
            <stop offset="100%" stopColor="#98D7D8" />
          </linearGradient>
          <linearGradient id="attLast10Fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64C7C9" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#98D7D8" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #273042', borderRadius: 8 }} />
        <AreaChart width={0} height={0} />
        <Area type="monotone" dataKey="attendees" stroke="none" fill="url(#attLast10Fill)" />
        <Line type="monotone" dataKey="attendees" stroke="url(#attLast10Line)" strokeWidth={3} dot={{ r: 3, stroke: '#98D7D8' }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
