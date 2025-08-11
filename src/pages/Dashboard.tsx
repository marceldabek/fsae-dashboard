
import { useEffect, useState } from "react";

import ProjectCard from "../components/ProjectCard";
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

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">EV Powertrain — Dashboard</h1>
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
