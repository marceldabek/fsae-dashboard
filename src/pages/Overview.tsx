
import { useEffect, useMemo, useState } from "react";

import { fetchPeople, fetchProjects, fetchTasks } from "../lib/firestore";
import type { Person, Project, Task } from "../types";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <div className="text-sm text-uconn-muted">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function Overview() {
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    (async () => {
      const [pe, pr, ta] = await Promise.all([fetchPeople(), fetchProjects(), fetchTasks()]);
      setPeople(pe); setProjects(pr); setTasks(ta);
    })();
  }, []);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === "Complete").length;
  const completion = totalTasks ? Math.round((doneTasks/totalTasks)*100) : 0;

  const projectOwnersCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) {
      for (const owner of p.owner_ids || []) {
        m.set(owner, (m.get(owner) || 0) + 1);
      }
    }
    return m;
  }, [projects]);

  const topContributors = [...projectOwnersCount.entries()]
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5)
    .map(([pid,count]) => ({ name: people.find(p=>p.id===pid)?.name || pid, count }));

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">Overview</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total People" value={people.length} />
        <StatCard label="Total Projects" value={projects.length} />
        <StatCard label="Total Tasks" value={totalTasks} />
        <StatCard label="Completion" value={`${completion}%`} />
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Top Contributors (by project count)</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topContributors.map(tc => (
            <li key={tc.name} className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
              <div className="text-sm">{tc.name}</div>
              <div className="text-sm text-uconn-muted">{tc.count} project(s)</div>
            </li>
          ))}
          {topContributors.length===0 && <div className="text-sm text-uconn-muted">No data yet.</div>}
        </ul>
      </section>
    </>
  );
}
