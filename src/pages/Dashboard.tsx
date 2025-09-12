
import { useEffect, useState } from "react";

import ProjectCard from "../components/overview/OverviewProjectCard";
import TrophyIcon from "../components/TrophyIcon";
import { fetchPeople, fetchProjects, fetchTasks } from "../lib/firestore";
import type { Person, Project, Task } from "../types";

export default function Dashboard() {
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    (async () => {
      const [pe, pr, ta] = await Promise.all([fetchPeople(), fetchProjects(), fetchTasks()]);
      setPeople(pe); setProjects(pr); setTasks(ta);
    })();
  }, []);

  const ownersMap = new Map(people.map(p => [p.id, p]));
  const tasksByProject = new Map<string, Task[]>();
  for (const t of tasks) {
    const arr = tasksByProject.get(t.project_id) ?? [];
    arr.push(t); tasksByProject.set(t.project_id, arr);
  }

  // Leaderboard logic
  const leaderboard = people.map(person => {
    const completed = tasks.filter(
      t => t.assignee_id === person.id && t.status === "Complete"
    ).length;
    return { ...person, completed };
  }).sort((a, b) => b.completed - a.completed);

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">EV Powertrain — Dashboard</h1>

      {/* Leaderboard section */}
      <div className="mb-8">
  <div className="rounded-2xl bg-card dark:bg-surface border border-white/10 p-4">
          <h2 className="text-xl font-bold mb-2">Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="min-w-[320px] w-full text-sm">
              <thead>
                <tr>
                  <th className="py-2 px-4 text-left text-muted font-semibold uppercase tracking-caps">Rank</th>
                  <th className="py-2 px-4 text-left text-muted font-semibold uppercase tracking-caps">Name</th>
                  <th className="py-2 px-4 text-left text-muted font-semibold uppercase tracking-caps">Completed Tasks</th>
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            owners={p.owner_ids?.map(id => ownersMap.get(id)!).filter(Boolean) ?? []}
            tasks={tasksByProject.get(p.id) ?? []}
          />
        ))}
      </div>
    </>
  );
}
