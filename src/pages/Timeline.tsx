import { useEffect, useState } from "react";
import { fetchProjects, fetchTasks } from "../lib/firestore";
import type { Project, Task } from "../types";

export default function Timeline() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [projs, tks] = await Promise.all([
          fetchProjects(),
          fetchTasks(),
        ]);
        if (!alive) return;
        setProjects(projs);
        setTasks(tks);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="text-sm text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Timeline</h1>
  <p className="text-sm text-muted">Lightweight scaffold to manage projects and tasks in a time-ordered list. Future: full calendar or external integration.</p>

      <div className="space-y-4">
        {projects.map(p => (
          <section key={p.id} className="border border-border rounded-md bg-overlay-6 p-4">
            <h2 className="font-medium text-lg">{p.name}</h2>
            {p.description && <p className="text-sm text-muted mb-2">{p.description}</p>}
            <ul className="mt-2 space-y-2">
              {tasks.filter(t => t.project_id === p.id)
                .sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
                .map(t => (
                <li key={t.id} className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 rounded-full ${t.status === "Complete" ? "bg-green-400" : t.status === "In Progress" ? "bg-yellow-300" : "bg-gray-400"}`} />
                  <div>
                    <div className="text-sm">{t.description}</div>
                    <div className="text-xs text-muted uppercase tracking-caps">
                      {t.created_at ? new Date(t.created_at).toLocaleString() : "No date"}
                      {t.completed_at ? ` → completed ${new Date(t.completed_at).toLocaleString()}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
