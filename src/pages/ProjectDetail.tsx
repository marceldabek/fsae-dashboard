
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

import ProgressBar from "../components/ProgressBar";
// (PeoplePicker legacy removed)
import PersonSelectPopover from "../components/PersonSelectPopover";
import TaskCreateCard from "../components/TaskCreateCard";
import { fetchPeople, fetchProjects, fetchTasksForProject, addTask, updateTask, deleteTaskById, updateProjectOwners, archiveProject } from "../lib/firestore";
import { useRankedEnabled } from "../hooks/useRankedEnabled";
import { useAuth } from "../hooks/useAuth";
import { isAdminUid } from "../admin";
import type { Person, Project, Task } from "../types";

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [owners, setOwners] = useState<Person[]>([]);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rankedEnabled] = useRankedEnabled();
  const [toast, setToast] = useState<string>("");
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  
const user = useAuth();
const canEdit = isAdminUid(user?.uid || null);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  // standardized picker no longer needs local show/search state


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
  // rankedEnabled managed by hook

  const total = tasks.length;
  const done = tasks.filter(t => t.status === "Complete").length;
  const percent = total > 0 ? (done / total) * 100 : 0;

  // local edit helpers
  const [newDesc, setNewDesc] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [newPoints, setNewPoints] = useState<number | "">("");
  async function handleAddOwner(id: string){ if(!project) return; if(ownerIds.includes(id)) return; const next=[...ownerIds,id]; setOwnerIds(next); await updateProjectOwners(project.id, next); await reloadOwners(); }
  async function handleRemoveOwner(id: string){ if(!project) return; const next=ownerIds.filter(x=>x!==id); setOwnerIds(next); await updateProjectOwners(project.id, next); await reloadOwners(); }
  const [newStatus, setNewStatus] = useState<"Todo"|"In Progress"|"Complete">("In Progress");

  async function handleAdd() {
    if (!id || !newDesc.trim()) return;
  await addTask({ project_id: id, description: newDesc.trim(), status: newStatus, assignee_id: newAssignee || undefined, ranked_points: (newPoints || undefined) as any });
    setNewDesc(""); setNewStatus("In Progress"); setNewAssignee("");
  setNewPoints("");
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
              <div className="text-xs font-semibold text-accent/80 mt-1 uppercase tracking-caps">
                {project.subsystem}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            {project.design_link && (
              <a className="inline-flex self-center items-center h-9 px-3 rounded bg-brand-blue/40 hover:bg-brand-blue/60 transition text-sm font-medium" href={project.design_link} target="_blank" rel="noreferrer">Design Docs</a>
            )}
            {canEdit && !((project as any).archived) && (
              <div className="relative">
                <button
                  onClick={()=> setShowArchiveConfirm(true)}
                  className="inline-flex items-center h-9 px-3 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 text-sm font-medium whitespace-normal text-center"
                >Archive Project</button>
                {showArchiveConfirm && (
                  <div className="absolute right-0 mt-2 w-72 rounded bg-surface border border-border p-3 shadow-lg z-20">
                    <div className="text-sm">Archive this project? You can re-enable it from the Admin page.</div>
                    <div className="flex gap-2 mt-3">
                      <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={async ()=>{ if(!project) return; await archiveProject(project.id); setProject(p=> p ? ({...p, archived: true} as any) : p); setShowArchiveConfirm(false); setToast('Project archived — re-enable from Admin'); setTimeout(()=>setToast(''),3000); }}>Confirm</button>
                      <button className="px-3 py-1 rounded bg-overlay-6 border border-border" onClick={()=> setShowArchiveConfirm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {canEdit && (project as any).archived && (
              <span className="inline-flex items-center h-9 px-3 rounded border border-yellow-400/40 bg-yellow-400/10 text-xs text-yellow-300 font-semibold uppercase tracking-wide">Archived</span>
            )}
          </div>
        </div>
  <div className="text-sm text-muted">
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
                return <div className="text-xs text-muted whitespace-nowrap uppercase tracking-caps">Due {weekday} {month} {day}{suffix(day)}</div>;
              }
              return null;
            })()}
          </div>
          {canEdit && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">Manage Owners
                <PersonSelectPopover
                  mode="multi"
                  people={allPeople}
                  selectedIds={ownerIds}
                  onAdd={handleAddOwner}
                  onRemove={handleRemoveOwner}
                  triggerLabel="Add/Remove"
                  buttonClassName="ml-auto text-[11px] px-2 py-1 rounded bg-white/10 border border-white/15 hover:bg-white/15"
                  maxItems={8}
                />
              </h3>
            </div>
          )}
          {toast && (
            <div className="fixed bottom-6 right-6 bg-white/6 border border-white/10 text-sm px-4 py-2 rounded shadow">{toast}</div>
          )}
        </div>
        <ProgressBar value={percent} />
  <div className="text-xs text-muted text-center uppercase tracking-caps">
          {total > 0 ? `${done}/${total} complete` : "No tasks yet"}
        </div>

          <section className="space-y-2">
            {canEdit && (
              <TaskCreateCard
                people={allPeople}
                fixedProjectId={project.id}
                onCreated={reloadTasks}
              />
            )}

            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Tasks</h2>
              <label className="flex items-center gap-2 select-none cursor-pointer group">
                <span className="text-xs font-medium text-muted uppercase tracking-caps">Hide completed</span>
                <span className="relative inline-block w-10 h-6 align-middle select-none">
                  <input
                    type="checkbox"
                    checked={hideCompleted}
                    onChange={e=>setHideCompleted(e.target.checked)}
                    className="peer absolute w-10 h-6 opacity-0 cursor-pointer z-10"
                  />
                  <span className="block w-10 h-6 rounded-full transition bg-surface border border-border peer-checked:bg-accent/70" />
                  <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-muted transition-all duration-200 peer-checked:translate-x-4 peer-checked:bg-accent shadow" />
                </span>
              </label>
            </div>
            <ul className={canEdit ? "flex flex-wrap gap-3" : "space-y-2"}>
              {(hideCompleted ? tasks.filter(t=>t.status!=="Complete") : tasks).map(t => {
                const color = t.status === "Complete" ? "bg-green-500" : t.status === "In Progress" ? "bg-yellow-400" : "bg-red-500";
                const assignee = allPeople.find(p=>p.id===t.assignee_id);
                const pts = t.ranked_points ?? (t.status === "Complete" ? 35 : 10);
                const ptsToHours = (p: number) => {
                  if (p === 1) return 0.5;
                  if (p === 3) return 1;
                  if (p === 10) return 3;
                  if (p === 6) return 2;
                  if (p === 15) return 5;
                  if (p === 40) return 10;
                  if (p === 65) return 15;
                  if (p === 98) return 20;
                  if (p === 150) return 25;
                  if (p === 200) return 30;
                  return Math.max(0, Math.round(p / 4));
                };
                return (
                <li key={t.id} className="relative flex flex-col justify-between gap-3 rounded bg-surface border border-border p-3 pr-10 flex-1 min-w-[280px] md:w-[calc(50%-0.75rem)] xl:w-[calc(33.333%-0.75rem)]">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" title={t.description}>{t.description}</div>
                    <div className="text-tick text-muted flex gap-2 items-center mt-0.5">
                      <span>{t.status}</span>
                      <span>·</span>
                      <span>{assignee ? `@${assignee.name}` : "Unassigned"}</span>
                    </div>
                  </div>
                  {rankedEnabled && (
                    <span className="absolute top-2 right-3 text-tick text-muted font-semibold">+{pts} · {ptsToHours(pts)}h</span>
                  )}
                  {canEdit && (
                    <div className="flex flex-col items-end gap-2 text-xs">
                      <PersonSelectPopover
                        mode="single"
                        people={allPeople}
                        selectedId={t.assignee_id || null}
                        onSelect={(id)=> handleAssign(t, id || "")}
                        triggerLabel={t.assignee_id ? (allPeople.find(p=>p.id===t.assignee_id)?.name || 'Assignee') : 'Unassigned'}
                        buttonClassName="px-2 py-1 rounded bg-surface/60 border border-border text-tick"
                        maxItems={8}
                      />
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        <button onClick={() => handleUpdate(t, "Todo")} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-white/15 bg-white/5 hover:bg-white/10 transition">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400"/> Todo
                        </button>
                        <button onClick={() => handleUpdate(t, "In Progress")} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-white/15 bg-white/5 hover:bg-white/10 transition whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-300"/> In Progress
                        </button>
                        <button onClick={() => handleUpdate(t, "Complete")} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-white/15 bg-white/5 hover:bg-white/10 transition">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400"/> Complete
                        </button>
                        {canEdit && (
                          <select
                            className="px-2 py-1 rounded bg-surface/60 border border-border text-xs text-text dark-select"
                            value={t.ranked_points || ""}
                            onChange={e=>updateTask(t.id, { ranked_points: e.target.value ? Number(e.target.value) : undefined }).then(reloadTasks)}
                          >
                            <option value="">Points…</option>
                            <option value="1">1 pt ~ 0.5 hr</option>
                            <option value="3">3 pts ~ 1 hr</option>
                            <option value="10">10 pts ~ 3 hrs</option>
                            <option value="6">6 pts ~ 2 hrs</option>
                            <option value="15">15 pts ~ 5 hrs</option>
                            <option value="40">40 pts ~ 10 hrs</option>
                            <option value="65">65 pts ~ 15 hrs</option>
                            <option value="98">98 pts ~ 20 hrs</option>
                            <option value="150">150 pts ~ 25 hrs</option>
                            <option value="200">200 pts ~ 30 hrs</option>
                          </select>
                        )}
                        <button onClick={() => handleDelete(t)} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-red-500/60 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition">
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                  <span className={`absolute top-1/2 -translate-y-1/2 right-3 w-3.5 h-3.5 rounded-full ${color} shadow`} aria-hidden />
                </li>
                );
              })}
            </ul>
          </section>
        </div>
    </>
  );
}
