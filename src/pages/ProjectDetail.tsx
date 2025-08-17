
import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";

import ProgressBar from "../components/ProgressBar";
// (PeoplePicker legacy removed)
import PersonSelectPopover from "../components/PersonSelectPopover";
import TaskCreateCard from "../components/TaskCreateCard";
import { fetchPeople, fetchProjects, fetchTasksForProject, addTask, updateTask, deleteTaskById, updateProjectOwners, archiveProject } from "../lib/firestore";
import { useRankedEnabled } from "../hooks/useRankedEnabled";
import { useAuth } from "../hooks/useAuth";
import { isAdminUid, isLeadUid } from "../admin";
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
const uid = user?.uid || null;
// Leads can edit everything except hidden admin tabs, so treat them like admins here.
const canEdit = isAdminUid(uid) || isLeadUid(uid);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const ownerMutationVersion = useRef(0); // incremental guard to avoid race conditions
  const [ownersBusy, setOwnersBusy] = useState(false);
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

  // keep owners state derived from ownerIds + allPeople
  useEffect(() => {
    setOwners(ownerIds.map(id => allPeople.find(p => p.id === id)!).filter(Boolean));
  }, [ownerIds, allPeople]);
  // legacy reload (if needed to re-fetch people list externally)
  async function reloadOwners(){
    // no network fetch needed for live UI; rely on existing allPeople
    setOwners(ownerIds.map(id => allPeople.find(p => p.id === id)!).filter(Boolean));
  }

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
  async function handleAddOwner(id: string){
    if(!project) return; if(ownerIds.includes(id)) return;
    const baseVersion = ++ownerMutationVersion.current;
    const next=[...ownerIds,id];
    setOwnerIds(next); // optimistic (owners effect updates list)
    setOwnersBusy(true);
    try {
      await updateProjectOwners(project.id, next);
    } finally { if (ownerMutationVersion.current === baseVersion) setOwnersBusy(false); }
  }
  async function handleRemoveOwner(id: string){
    if(!project) return;
    const baseVersion = ++ownerMutationVersion.current;
    const next=ownerIds.filter(x=>x!==id);
    setOwnerIds(next); // optimistic
    setOwnersBusy(true);
    try {
      await updateProjectOwners(project.id, next);
    } finally { if (ownerMutationVersion.current === baseVersion) setOwnersBusy(false); }
  }
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
  const [showAddTask, setShowAddTask] = useState(false);

  if (!project) return <div className="text-sm">Loading…</div>;

  // derive due date label once
  const dueDateLabel = (() => {
    if (!project.due_date) return null;
    let date: Date | null = null;
    const s = project.due_date;
    const m = s.match(/(\d{4})[\/-]?(\d{2})[\/-]?(\d{2})/);
    if (m) { const [, y, mo, d] = m; date = new Date(Number(y), Number(mo) - 1, Number(d)); }
    else if (!isNaN(Date.parse(s))) { date = new Date(s); }
    if (!date) return null;
    const weekday = date.toLocaleString('en-US', { weekday: 'short' });
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const suffix = (n: number) => n === 1 || n === 21 || n === 31 ? 'st' : n === 2 || n === 22 ? 'nd' : n === 3 || n === 23 ? 'rd' : 'th';
    return `Due ${weekday} ${month} ${day}${suffix(day)}`;
  })();

  return (
    <>
      <div className="space-y-4">
        <div className="relative">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight break-words pr-40 sm:pr-0">{project.name}</h1>
            {project.subsystem && (
              <div className="text-[11px] font-medium text-accent/80 uppercase tracking-caps mt-0.5">{project.subsystem}</div>
            )}
          </div>
          <div className="absolute top-0 right-0 flex gap-2 items-start">
            {project.design_link && (
              <a
                className="inline-flex items-center justify-center h-7 px-3 rounded-md border border-brand-blue/40 bg-brand-blue/20 hover:bg-brand-blue/30 text-[11px] font-medium whitespace-nowrap transition"
                href={project.design_link}
                target="_blank"
                rel="noreferrer"
                title="Design link"
              >Link</a>
            )}
            {canEdit && !((project as any).archived) && (
              <div className="relative">
                <button
                  onClick={()=> setShowArchiveConfirm(true)}
                  className="inline-flex items-center justify-center h-7 px-3 rounded-md border border-red-500/50 bg-red-500/15 hover:bg-red-500/25 text-red-200 text-[11px] font-medium whitespace-nowrap transition"
                >Archive</button>
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
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted/70 uppercase tracking-caps text-[11px]">Owners</span>
              {dueDateLabel && (
                <span className="text-[11px] text-muted/70 uppercase tracking-caps whitespace-nowrap ml-auto text-right">{dueDateLabel}</span>
              )}
            </div>
            <div className="flex flex-wrap items-start gap-2 text-[13px] leading-snug">
              <span className="font-medium text-white/90 whitespace-normal break-words pr-1">{owners.map(o => o.name).join(", ") || "—"}</span>
              {canEdit && !((project as any).archived) && (
                <PersonSelectPopover
                  mode="multi"
                  people={allPeople}
                  selectedIds={ownerIds}
                  onAdd={handleAddOwner}
                  onRemove={handleRemoveOwner}
                  triggerLabel="Add/Remove"
                  triggerContent={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                  buttonClassName="inline-flex items-center justify-center h-6 w-6 rounded-md border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent transition"
                  disabled={ownersBusy}
                  maxItems={5}
                />
              )}
            </div>
          </div>
        </div>
                {toast && (
                  <div className="fixed bottom-6 right-6 px-4 py-2 rounded shadow bg-surface/95 border border-accent/40 text-[13px] leading-snug text-white font-medium backdrop-blur-sm">
                    {toast}
                  </div>
                )}
        <div className="mt-2">
          <ProgressBar value={percent} color={percent === 100 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : undefined} />
        </div>
        <div className="text-[11px] text-muted text-center uppercase tracking-caps font-medium tracking-wide mt-1 mb-1">
          {total > 0 ? `${done}/${total} complete` : "No tasks yet"}
        </div>

          <section className="space-y-2">
          {/* Status Dot Legend */}
          <div className="flex justify-between items-center w-full max-w-xs mx-auto mb-2" style={{minWidth: '250px', maxWidth: '390px'}}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" aria-hidden></span>
              <span className="text-[11px] text-muted uppercase tracking-caps font-medium">To-do / Not started</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" aria-hidden></span>
              <span className="text-[11px] text-muted uppercase tracking-caps font-medium">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" aria-hidden></span>
              <span className="text-[11px] text-muted uppercase tracking-caps font-medium">Complete</span>
            </div>
          </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base leading-tight">Tasks</h2>
                {canEdit && !(project as any).archived && (
                  <button
                    aria-label="Add task"
                    onClick={()=> setShowAddTask(true)}
                    className="group inline-flex items-center justify-center h-7 w-7 rounded-md border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent transition shadow-sm hover:shadow-accent/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="sr-only">Add task</span>
                  </button>
                )}
              </div>
              <label className="flex items-center gap-2 select-none cursor-pointer group">
                <span className="text-[11px] font-medium text-muted uppercase tracking-caps">Hide completed</span>
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
                <li key={t.id} className="relative flex flex-col justify-between gap-2 rounded bg-surface border border-border p-3 pr-10 flex-1 min-w-[280px] md:w-[calc(50%-0.75rem)] xl:w-[calc(33.333%-0.75rem)]">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" title={t.description}>{t.description}</div>
                    <div className="text-tick text-muted flex gap-2 items-center mt-0.5">
                      <span>{t.status}</span>
                      <span>·</span>
                      {canEdit ? (
                        <PersonSelectPopover
                          mode="single"
                          people={allPeople}
                          selectedId={t.assignee_id || null}
                          onSelect={(id) => handleAssign(t, id || "")}
                          triggerLabel={t.assignee_id ? (allPeople.find(p => p.id === t.assignee_id)?.name || 'Assignee') : 'Unassigned'}
                          buttonClassName="px-2 py-0.5 rounded bg-surface/60 border border-border text-tick text-sm whitespace-nowrap"
                          maxItems={5}
                        />
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-transparent">{assignee ? `@${assignee.name}` : "Unassigned"}</span>
                      )}
                    </div>
                  </div>
                  {rankedEnabled && (
                    <span className="absolute top-2 right-3 text-tick text-muted font-semibold">+{pts} · {ptsToHours(pts)}h</span>
                  )}
                  {canEdit && (
                    <div className="w-full flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                        <div className="flex w-full gap-1.5 flex-wrap">
                            <button onClick={() => handleUpdate(t, "Todo")} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-white/15 bg-white/5 hover:bg-white/10 transition justify-center flex-1 sm:flex-none sm:justify-start">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"/> Todo
                            </button>
                            <button onClick={() => handleUpdate(t, "In Progress")} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-white/15 bg-white/5 hover:bg-white/10 transition whitespace-nowrap justify-center flex-1 sm:flex-none sm:justify-start">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-300"/> In Progress
                            </button>
                            <button onClick={() => handleUpdate(t, "Complete")} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-white/15 bg-white/5 hover:bg-white/10 transition justify-center flex-1 sm:flex-none sm:justify-start">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400"/> Complete
                            </button>
                          </div>
                        <div />
                      </div>

                      <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                        <div className="flex items-center gap-2 w-full">
                          <select
                            className="h-7 px-2.5 rounded bg-surface/60 border border-border text-xs text-text dark-select flex-[2] w-full sm:flex-none sm:w-auto"
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
                          <button onClick={() => handleDelete(t)} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-red-500/60 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition flex-1 sm:flex-none">
                            Delete
                          </button>
                        </div>
                        <div />
                      </div>
                    </div>
                  )}
                  <span className={`absolute top-1/2 -translate-y-1/2 right-3 w-3.5 h-3.5 rounded-full ${color} shadow`} aria-hidden />
                </li>
                );
              })}
            </ul>
          </section>
          {showAddTask && createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center">
              <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={()=> setShowAddTask(false)} />
              <div className="relative w-[95vw] max-w-md rounded-2xl border border-white/10 bg-bg/95 backdrop-blur-sm shadow-2xl p-5 text-white">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Add Task</h3>
                  <button onClick={()=> setShowAddTask(false)} aria-label="Close" className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-white/10">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <TaskCreateCard
                  people={allPeople}
                  fixedProjectId={project.id}
                  onCreated={()=>{ reloadTasks(); setShowAddTask(false); }}
                  hideTitle
                  unstyled
                />
              </div>
            </div>,
            document.body
          )}
        </div>
    </>
  );
}
