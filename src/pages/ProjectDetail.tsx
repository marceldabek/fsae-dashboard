
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

import ProgressBar from "../components/ProgressBar";
import PeoplePicker from "../components/PeoplePicker";
import { fetchPeople, fetchProjects, fetchTasksForProject, addTask, updateTask, deleteTaskById, updateProjectOwners } from "../lib/firestore";
import { useAuth } from "../hooks/useAuth";
import { ADMIN_UID } from "../admin";
import type { Person, Project, Task } from "../types";

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [owners, setOwners] = useState<Person[]>([]);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
const user = useAuth();
const canEdit = user?.uid === ADMIN_UID;
const [ownerIds, setOwnerIds] = useState<string[]>([]);


  // load project + people
  useEffect(() => {
    (async () => {
      const [projects, people] = await Promise.all([
        (await import("../lib/firestore")).fetchProjects(),
        fetchPeople(),
      ]);
      const p = projects.find(pr => pr.id === id) || null;
      setProject(p || null);
      setAllPeople(people);
      const ids = p?.owner_ids || [];
      setOwnerIds(ids);
      setOwners(ids.map(pid => people.find(pp => pp.id === pid)!).filter(Boolean) || []);
    })();
  }, [id]);

  // load tasks for this project
  async function reloadOwners(){ if(!project) return; const people = await fetchPeople(); setOwners(ownerIds.map(pid => people.find(pp=>pp.id===pid)!).filter(Boolean)); }

  async function reloadTasks() {
    if (!id) return;
    setTasks(await fetchTasksForProject(id));
  }
  useEffect(() => { reloadTasks(); }, [id]);

  const total = tasks.length;
  const done = tasks.filter(t => t.status === "Complete").length;
  const percent = total > 0 ? (done / total) * 100 : 0;

  // local edit helpers
  const [newDesc, setNewDesc] = useState("");
  async function handleAddOwner(id: string){ if(!project) return; if(ownerIds.includes(id)) return; const next=[...ownerIds,id]; setOwnerIds(next); await updateProjectOwners(project.id, next); await reloadOwners(); }
  async function handleRemoveOwner(id: string){ if(!project) return; const next=ownerIds.filter(x=>x!==id); setOwnerIds(next); await updateProjectOwners(project.id, next); await reloadOwners(); }
  const [newStatus, setNewStatus] = useState<"Todo"|"In Progress"|"Complete">("In Progress");

  async function handleAdd() {
    if (!id || !newDesc.trim()) return;
    await addTask({ project_id: id, description: newDesc.trim(), status: newStatus });
    setNewDesc(""); setNewStatus("In Progress");
    await reloadTasks();
  }

  async function handleUpdate(t: Task, status: Task["status"]) {
    await updateTask(t.id, { status });
    await reloadTasks();
  }

  async function handleDelete(t: Task) {
    await deleteTaskById(t.id);
    await reloadTasks();
  }

  if (!project) return <div className="text-sm">Loading…</div>;

  return (
    <>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        {project.design_link && (
          <div>
            <a className="inline-flex items-center px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition text-sm" href={project.design_link} target="_blank" rel="noreferrer">Slides</a>
          </div>
        )}
        <div className="text-sm text-uconn-muted">
          Owners: {owners.map(o => o.name).join(", ") || "—"}
          {canEdit && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold mb-1">Manage Owners</h3>
              <PeoplePicker
                people={allPeople}
                selectedIds={ownerIds}
                onAdd={handleAddOwner}
                onRemove={handleRemoveOwner}
              />
            </div>
          )}
        </div>
        <ProgressBar value={percent} />
        <div className="text-xs text-uconn-muted">
          {total > 0 ? `${done}/${total} complete` : "No tasks yet"}
        </div>

          <section className="space-y-2">
            <h2 className="font-semibold">Tasks</h2>
            <ul className="space-y-2">
              {tasks.map(t => {
                const color = t.status === "Complete" ? "bg-green-500" : t.status === "In Progress" ? "bg-yellow-400" : "bg-red-500";
                return (
                <li key={t.id} className="relative flex items-center justify-between gap-3 rounded bg-white/5 border border-white/10 p-3 pr-8">
                  <div>
                    <div className="font-medium">{t.description}</div>
                    <div className="text-xs text-uconn-muted">{t.status}</div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 text-sm">
                      <button onClick={() => handleUpdate(t, "Todo")} className="px-2 py-1 rounded border">Todo</button>
                      <button onClick={() => handleUpdate(t, "In Progress")} className="px-2 py-1 rounded border">In Progress</button>
                      <button onClick={() => handleUpdate(t, "Complete")} className="px-2 py-1 rounded border">Complete</button>
                      <button onClick={() => handleDelete(t)} className="px-2 py-1 rounded border border-red-400 text-red-300">Delete</button>
                    </div>
                  )}
                  <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ${color}`} aria-hidden />
                </li>
                );
              })}
            </ul>

            {canEdit && (
              <div className="mt-3 space-y-2">
                <h3 className="text-sm font-semibold">Add Task</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className="px-3 py-2 rounded bg-white text-black"
                    placeholder="Description"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                  />
                  <select
                    className="px-3 py-2 rounded bg-white text-black"
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as any)}
                  >
                    <option>Todo</option>
                    <option>In Progress</option>
                    <option>Complete</option>
                  </select>
                  <button
                    onClick={handleAdd}
                    className="px-3 py-2 rounded bg-white/10 border border-white/20"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
    </>
  );
}
