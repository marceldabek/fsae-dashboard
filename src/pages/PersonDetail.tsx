

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchPeople, fetchProjects, fetchTasks, fetchSettings } from "../lib/firestore";
import type { Person, Project, Task } from "../types";

export default function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState<Person | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]); // tasks assigned to this person
  const [allTasks, setAllTasks] = useState<Task[]>([]); // all tasks (for leaderboard rank)
  const [settings, setSettings] = useState<{rulebook_url?: string; sharepoint_url?: string} | null>(null);

  useEffect(() => {
    (async () => {
  const [people, projects, allTasks, settings] = await Promise.all([
        fetchPeople(), fetchProjects(), fetchTasks(), fetchSettings()
      ]);
      const p = people.find(pp => pp.id === id) || null;
      setPerson(p);
      setProjects(projects.filter(pr => pr.owner_ids?.includes(id!)));
  setAllTasks(allTasks);
  setTasks(allTasks.filter(t => t.assignee_id === id));
  setSettings(settings);
    })();
  }, [id]);

  if (!person) return <div className="text-sm">Loading…</div>;

  // Stats
  const numProjects = projects.length;
  const numTasks = tasks.length;
  const numTasksTodo = tasks.filter(t => t.status !== "Complete").length;

  // Leaderboard rank (by completed tasks)
  const completedByPerson = new Map<string, number>();
  for (const t of allTasks) {
    if (t.status === "Complete" && t.assignee_id) {
      completedByPerson.set(t.assignee_id, (completedByPerson.get(t.assignee_id) || 0) + 1);
    }
  }
  const sorted = [...completedByPerson.entries()].sort((a,b)=>b[1]-a[1]);
  const myRank = id ? sorted.findIndex(([pid]) => pid === id) + 1 : undefined;
  const myCompleted = completedByPerson.get(id || "") || 0;

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-6">
      {/* Profile Card */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col gap-2 items-start">
        <div className="text-2xl font-bold">{person.name}</div>
        <div className="text-sm text-uconn-muted">{person.year || person.role}</div>
        {myRank ? (
          <div className="text-xs bg-white/10 rounded px-2 py-1">Leaderboard Rank: #{myRank} · {myCompleted} completed</div>
        ) : (
          <div className="text-xs text-uconn-muted">No completed tasks yet</div>
        )}
        {person.skills && person.skills.length > 0 && (
          <div className="text-sm">Skills: {person.skills.join(", ")}</div>
        )}
        <div className="flex gap-6 mt-2">
          <div className="text-center">
            <div className="text-lg font-semibold">{numProjects}</div>
            <div className="text-xs text-uconn-muted">Projects</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{numTasks}</div>
            <div className="text-xs text-uconn-muted">Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{numTasksTodo}</div>
            <div className="text-xs text-uconn-muted">To Do</div>
          </div>
        </div>
      </div>

      {/* Quick Links Card */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
        <h2 className="font-semibold mb-2">Quick Links</h2>
        <ul className="list-disc pl-5 text-sm">
          {(() => {
            const sharepoint = settings?.sharepoint_url || "https://uconn-my.sharepoint.com/shared?id=%2Fsites%2FUConnFormulaSAE%2FShared%20Documents&listurl=https%3A%2F%2Fuconn%2Esharepoint%2Ecom%2Fsites%2FUConnFormulaSAE%2FShared%20Documents";
            return <li><a className="underline" href={sharepoint} target="_blank">SharePoint</a></li>;
          })()}
          {settings?.rulebook_url && <li><a className="underline" href={settings.rulebook_url} target="_blank">Rulebook (PDF)</a></li>}
        </ul>
      </div>

      {/* Projects Card */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
        <h2 className="font-semibold mb-2">Projects</h2>
        <ul className="space-y-3">
          {projects.map(p => {
            const ptasks = tasks.filter(t => t.project_id === p.id);
            const total = ptasks.length;
            const done = ptasks.filter(t => t.status === "Complete").length;
            const percent = total ? Math.round((done/total)*100) : 0;
            return (
              <li key={p.id} className="rounded-xl bg-white/10 border border-white/10 p-3">
                <div className="flex items-center justify-between">
                  <Link className="underline font-semibold" to={`/project/${p.id}`}>{p.name}</Link>
                  <div className="text-xs text-uconn-muted">{done}/{total} · {percent}%</div>
                </div>
                <div className="text-xs text-uconn-muted">
                  {p.description || "—"}
                  {p.due_date && <> · Due {p.due_date}</>}
                </div>
                {ptasks.length>0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {ptasks.map(t => <li key={t.id}>{t.description} <span className="text-uconn-muted">({t.status})</span></li>)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
