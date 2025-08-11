
import { useEffect, useMemo, useState } from "react";
import { fetchPeople, fetchProjects, fetchTasks } from "../lib/firestore";
import type { Person, Project, Task } from "../types";
import { useAuth } from "../hooks/useAuth";
import { signIn } from "../auth";
import ProjectCard from "../components/ProjectCard";
import TrophyIcon from "../components/TrophyIcon";
import ProgressBar from "../components/ProgressBar";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="text-xs text-uconn-muted">{label}</div>
      <div className="text-xl font-semibold leading-tight">{value}</div>
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

  // Leaderboard logic (from Dashboard)
  const leaderboard = people.map(person => {
    const completed = tasks.filter(
      t => t.assignee_id === person.id && t.status === "Complete"
    ).length;
    return { ...person, completed };
  }).sort((a, b) => b.completed - a.completed);

  // Owners map for ProjectCard
  const ownersMap = new Map(people.map(p => [p.id, p]));
  const tasksByProject = new Map<string, Task[]>();
  for (const t of tasks) {
    const arr = tasksByProject.get(t.project_id) ?? [];
    arr.push(t); tasksByProject.set(t.project_id, arr);
  }

  const user = useAuth();
  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">Overview</h1>

      {/* Top stats in one single row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Total People" value={people.length} />
        <StatCard label="Total Projects" value={projects.length} />
        <StatCard label="Total Tasks" value={totalTasks} />
      </div>

      {/* Full-width progress bar */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-uconn-muted">Progress</div>
          <div className="text-xs font-semibold">{completion}%</div>
        </div>
        <ProgressBar value={completion} heightClass="h-3" />
      </div>

      {/* Leaderboard section */}
      <div className="mb-8">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <h2 className="text-xl font-bold mb-2">Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="min-w-[320px] w-full text-sm">
              <thead>
                <tr>
                  <th className="py-2 px-4 text-left text-uconn-muted font-semibold">Rank</th>
                  <th className="py-2 px-4 text-left text-uconn-muted font-semibold">Name</th>
                  <th className="py-2 px-4 text-left text-uconn-muted font-semibold">Completed Tasks</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((person, idx) => (
                  <tr key={person.id} className={idx === 0 ? "bg-yellow-100/40" : ""}>
                    <td className="py-2 px-4">{idx + 1}</td>
                    <td className="py-2 px-4 flex items-center gap-1">
                      {person.name}
                      {idx === 0 && <TrophyIcon />}
                    </td>
                    <td className="py-2 px-4">{person.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

  {/* Project cards section */}
      <h2 className="text-lg font-semibold mt-6 mb-2">Projects</h2>
      <div className="flex items-center gap-4 text-xs text-uconn-muted mb-1">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Todo</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> In Progress</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Complete</div>
      </div>
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            owners={p.owner_ids?.map(id => ownersMap.get(id)!).filter(Boolean) ?? []}
            tasks={tasksByProject.get(p.id) ?? []}
          />
        ))}
      </div>

      {/* Sign in button at bottom if not signed in */}
      {!user && (
        <div className="flex justify-center mt-12">
          <button onClick={signIn} className="text-xs border px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition">
            Sign in
          </button>
        </div>
      )}
    </>
  );
}
