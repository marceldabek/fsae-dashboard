import { useEffect, useMemo, useState } from "react";
import { fetchPeople, fetchProjects, fetchTasks } from "../lib/firestore";
import type { Person, Project, Task } from "../types";

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
  BarChart,
  Bar,
  Legend,
} from "recharts";

export default function Stats() {
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ppl, projs, tks] = await Promise.all([
          fetchPeople(),
          fetchProjects(),
          fetchTasks(),
        ]);
        if (!alive) return;
        setPeople(ppl);
        setProjects(projs);
        setTasks(tks);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const totals = useMemo(() => {
    const byStatus = { Todo: 0, "In Progress": 0, Complete: 0 } as Record<Task["status"], number>;
    for (const t of tasks) byStatus[t.status]++;
    return {
      totalTasks: tasks.length,
      byStatus,
      totalPeople: people.length,
      totalProjects: projects.length,
    };
  }, [people.length, projects.length, tasks]);

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

  // Subsystem meters: percent of projects finished (all tasks complete) per subsystem
  const subsystemMeters = useMemo(() => {
    const bySubsystem = new Map<string, { totalProjects: number; doneProjects: number }>();
    // Pre-index tasks by project for quick lookup
    const tasksByProject = new Map<string, Task[]>();
    for (const t of tasks) {
      const arr = tasksByProject.get(t.project_id) || [];
      arr.push(t);
      tasksByProject.set(t.project_id, arr);
    }
    for (const p of projects) {
      const key = p.subsystem || "Unassigned";
      const entry = bySubsystem.get(key) || { totalProjects: 0, doneProjects: 0 };
      entry.totalProjects += 1;
      const arr = tasksByProject.get(p.id) || [];
      const hasTasks = arr.length > 0;
      const allDone = hasTasks && arr.every(t => t.status === "Complete");
      if (allDone) entry.doneProjects += 1;
      bySubsystem.set(key, entry);
    }
    return Array.from(bySubsystem.entries())
      .map(([name, v]) => ({ name, total: v.totalProjects, done: v.doneProjects, percent: v.totalProjects ? Math.round((v.doneProjects / v.totalProjects) * 100) : 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
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

  if (loading) return <div className="text-sm text-uconn-muted">Loading stats…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Stats</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Projects" value={totals.totalProjects} />
        <StatCard label="People" value={totals.totalPeople} />
        <StatCard label="Tasks" value={totals.totalTasks} />
        <StatCard label="Done" value={totals.byStatus["Complete"]} />
      </div>

      <Section title="Tasks completed past 14 days">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last14Days} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="day"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                interval={1}
                angle={-30}
                textAnchor="end"
                height={60}
                tickFormatter={(v: string) => {
                  // v is YYYY-MM-DD; display as M/D
                  const [y, m, d] = v.split("-").map(Number);
                  return `${m}/${d}`;
                }}
              />
              <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #273042" }} />
              <Line type="monotone" dataKey="completed" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Completions per week">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="week" hide={weekly.length > 20} tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #273042" }} />
              <Legend />
              <Line type="monotone" dataKey="completed" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Top contributors (completed tasks)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perPerson} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #273042" }} />
              <Bar dataKey="completed" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Subsystem progress">
        <div className="space-y-2">
          {subsystemMeters.map(row => (
            <div key={row.name} className="flex items-center gap-3">
              <div className="w-36 text-xs text-uconn-muted">{row.name}</div>
              <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-brand-teal/60" style={{ width: `${row.percent}%` }} />
              </div>
              <div className="w-28 text-right text-xs">{row.done}/{row.total} ({row.percent}%)</div>
            </div>
          ))}
          {subsystemMeters.length === 0 && (
            <div className="text-xs text-uconn-muted">No subsystems</div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-uconn-border bg-black/10 p-4">
      <h2 className="text-lg font-medium mb-3">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-uconn-border bg-black/20 p-3">
      <div className="text-xs text-uconn-muted uppercase">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
