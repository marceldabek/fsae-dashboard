
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { fetchPeople, fetchProjects, fetchTasks, fetchSettings } from "../lib/firestore";
import type { Person, Project } from "../types";

export default function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState<Person | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [settings, setSettings] = useState<{rulebook_url?: string; sharepoint_url?: string} | null>(null);

  useEffect(() => {
    (async () => {
      const [people, projects, settings] = await Promise.all([fetchPeople(), fetchProjects(), fetchSettings()]);
      const p = people.find(pp => pp.id === id) || null;
      setPerson(p);
      setProjects(projects.filter(pr => pr.owner_ids?.includes(id!)));
      setSettings(settings);
    })();
  }, [id]);

  if (!person) return <div className="text-sm">Loading…</div>;

  return (
    <>
      <Link to="/" className="text-sm underline">← Back to Dashboard</Link>
      <div className="mt-4 space-y-4">
        <h1 className="text-2xl font-semibold">{person.name}</h1>
        <div className="text-sm text-uconn-muted">{person.year}</div>
        <div className="text-sm">Skills: {person.skills?.join(", ") || "—"}</div>

        <section className="space-y-2">
          <h2 className="font-semibold">Quick Links</h2>
          <ul className="list-disc pl-5 text-sm">
            {settings?.sharepoint_url && <li><a className="underline" href={settings.sharepoint_url} target="_blank">SharePoint</a></li>}
            {settings?.rulebook_url && <li><a className="underline" href={settings.rulebook_url} target="_blank">Rulebook (PDF)</a></li>}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Projects</h2>
          <ul className="space-y-3">
            {projects.map(p => {
              const ptasks = tasks.filter(t => t.project_id === p.id);
              const total = ptasks.length;
              const done = ptasks.filter(t => t.status === "Complete").length;
              const percent = total ? Math.round((done/total)*100) : 0;
              return (
                <li key={p.id} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <Link className="underline" to={`/project/${p.id}`}>{p.name}</Link>
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
        </section>
      </div>
    </>
  );
}
