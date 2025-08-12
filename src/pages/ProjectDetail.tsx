
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
  const [newAssignee, setNewAssignee] = useState<string>("");
  async function handleAddOwner(id: string){ if(!project) return; if(ownerIds.includes(id)) return; const next=[...ownerIds,id]; setOwnerIds(next); await updateProjectOwners(project.id, next); await reloadOwners(); }
  async function handleRemoveOwner(id: string){ if(!project) return; const next=ownerIds.filter(x=>x!==id); setOwnerIds(next); await updateProjectOwners(project.id, next); await reloadOwners(); }
  const [newStatus, setNewStatus] = useState<"Todo"|"In Progress"|"Complete">("In Progress");

  async function handleAdd() {
    if (!id || !newDesc.trim()) return;
    await addTask({ project_id: id, description: newDesc.trim(), status: newStatus, assignee_id: newAssignee || undefined });
    setNewDesc(""); setNewStatus("In Progress"); setNewAssignee("");
    await reloadTasks();
  }

  async function handleUpdate(t: Task, status: Task["status"]) {
    await updateTask(t.id, { status });
    await reloadTasks();
  }

  async function handleAssign(t: Task, assignee_id: string) {
    await updateTask(t.id, { assignee_id: assignee_id || undefined });
    await reloadTasks();
  }

  async function handleDelete(t: Task) {
    await deleteTaskById(t.id);
    await reloadTasks();
  }

  const [hideCompleted, setHideCompleted] = useState(false);

  if (!project) return <div className="text-sm">Loading…</div>;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            {project.subsystem && (
              <div className="text-xs font-semibold text-brand-teal/80 mt-1 uppercase tracking-wide">
                {project.subsystem}
              </div>
            )}
          </div>
          {project.design_link && (
            <a className="inline-flex items-center h-9 px-4 rounded bg-brand-blue/40 hover:bg-brand-blue/60 transition text-sm font-medium" href={project.design_link} target="_blank" rel="noreferrer">Design Docs</a>
          )}
        </div>
        <div className="text-sm text-uconn-muted">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">Owners: {owners.map(o => o.name).join(", ") || "—"}</div>
            {project.due_date && (() => {
              let date: Date | null = null;
              const s = project.due_date;
              const m = s.match(/(\d{4})[\/-]?(\d{2})[\/-]?(\d{2})/);
              if (m) {
                const [, y, mo, d] = m;
                date = new Date(Number(y), Number(mo) - 1, Number(d));
              } else if (!isNaN(Date.parse(s))) {
                date = new Date(s);
              }
              if (date) {
                const weekday = date.toLocaleString('en-US', { weekday: 'short' });
                const month = date.toLocaleString('en-US', { month: 'short' });
                const day = date.getDate();
                const suffix = (n: number) => n === 1 || n === 21 || n === 31 ? 'st' : n === 2 || n === 22 ? 'nd' : n === 3 || n === 23 ? 'rd' : 'th';
                return <div className="text-xs text-uconn-muted whitespace-nowrap">Due {weekday} {month} {day}{suffix(day)}</div>;
              }
              return null;
            })()}
          </div>
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
        <div className="text-xs text-uconn-muted text-center">
          {total > 0 ? `${done}/${total} complete` : "No tasks yet"}
        </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Tasks</h2>
              <label className="flex items-center gap-2 select-none cursor-pointer group">
                <span className="text-xs font-medium text-uconn-muted">Hide completed</span>
                <span className="relative inline-block w-10 h-6 align-middle select-none">
                  <input
                    type="checkbox"
                    checked={hideCompleted}
                    onChange={e=>setHideCompleted(e.target.checked)}
                    className="peer absolute w-10 h-6 opacity-0 cursor-pointer z-10"
                  />
                  <span className="block w-10 h-6 rounded-full transition bg-uconn-surface border border-uconn-border peer-checked:bg-brand-teal/70" />
                  <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-uconn-muted transition-all duration-200 peer-checked:translate-x-4 peer-checked:bg-brand-teal shadow" />
                </span>
              </label>
            </div>
            <ul className={canEdit ? "flex flex-wrap gap-4" : "space-y-2"}>
              {(hideCompleted ? tasks.filter(t=>t.status!=="Complete") : tasks).map(t => {
                const color = t.status === "Complete" ? "bg-green-500" : t.status === "In Progress" ? "bg-yellow-400" : "bg-red-500";
                const assignee = allPeople.find(p=>p.id===t.assignee_id);
                return (
                <li key={t.id} className="relative flex flex-col justify-between gap-3 rounded bg-uconn-surface border border-uconn-border p-3 pr-10 flex-1 min-w-[260px] md:w-[calc(50%-1rem)] xl:w-[calc(33.333%-1rem)]">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" title={t.description}>{t.description}</div>
                    <div className="text-[10px] text-uconn-muted flex gap-2 items-center mt-0.5">
                      <span>{t.status}</span>
                      <span>·</span>
                      <span>{assignee ? `@${assignee.name}` : "Unassigned"}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex flex-col items-end gap-2 text-xs">
                      <select
                        className="px-2 py-1 rounded bg-uconn-surface/60 border border-uconn-border text-xs text-uconn-text dark-select"
                        value={t.assignee_id || ""}
                        onChange={e=>handleAssign(t, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {allPeople.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => handleUpdate(t, "Todo")} className="px-2 py-1 rounded border text-[11px] font-medium border-red-500/60 text-red-300 bg-red-500/10 hover:bg-red-500/20 transition">Todo</button>
                        <button onClick={() => handleUpdate(t, "In Progress")} className="px-2 py-1 rounded border text-[11px] font-medium border-yellow-400/60 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 transition whitespace-nowrap">In Progress</button>
                        <button onClick={() => handleUpdate(t, "Complete")} className="px-2 py-1 rounded border text-[11px] font-medium border-green-500/60 text-green-300 bg-green-500/10 hover:bg-green-500/20 transition">Complete</button>
                        <button onClick={() => handleDelete(t)} className="px-2 py-1 rounded border text-[11px] font-medium border-red-500 text-red-300 bg-red-500/10 hover:bg-red-500/20 transition">Delete</button>
                      </div>
                    </div>
                  )}
                  <span className={`absolute top-1/2 -translate-y-1/2 right-3 w-3.5 h-3.5 rounded-full ${color} shadow`} aria-hidden />
                </li>
                );
              })}
            </ul>

            {canEdit && (
              <div className="mt-3 space-y-2">
                <h3 className="text-sm font-semibold">Add Task</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className="px-3 py-2 rounded"
                    placeholder="Description"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                  />
                  <select
                    className="px-3 py-2 rounded dark-select"
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as any)}
                  >
                    <option>Todo</option>
                    <option>In Progress</option>
                    <option>Complete</option>
                  </select>
                  <select
                    className="px-3 py-2 rounded dark-select"
                    value={newAssignee}
                    onChange={e=>setNewAssignee(e.target.value)}
                  >
                    <option value="">Assign to…</option>
                    {allPeople.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
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
