import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";

// ProgressBar removed per request
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Trash01, Edit03, CheckDone01 } from "@untitledui/icons";
import ProjectCreateModal from "../components/ProjectCreateModal";
import { Avatar } from "@/components/base/avatar/avatar";
import { getAvatarUrl } from "../utils/colorExtraction";

// Local archive icon (16x16) to display before the Archive label
const ArchiveIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="4" width="18" height="4" rx="1" ry="1" />
    <path d="M5 8h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z" />
    <path d="M10 12h4" />
  </svg>
);
import PersonSelectPopover from "../components/PersonSelectPopover";
import TaskCreateModal from "../components/TaskCreateModal";
import { fetchPeople, fetchProjects, fetchTasksForProject, addTask, updateTask, deleteTaskById, updateProjectOwners, archiveProject, deleteProject, invalidateProjectsCache } from "../lib/firestore";
import { db, functions } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useRankedEnabled } from "../hooks/useRankedEnabled";
import { useAuth } from "../hooks/useAuth";
import { RequireLead, RequireMember, useRoles } from "../lib/roles";
import type { Person, Project, Task } from "../types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export default function ProjectDetail() {
  const [showDescription, setShowDescription] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Delete project and redirect
  const handleDeleteProject = async () => {
  if (!project) return;
  await deleteProject(project.id);
  window.location.href = "https://marceldabek.github.io/fsae-dashboard/";
  };
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [owners, setOwners] = useState<Person[]>([]);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rankedEnabled] = useRankedEnabled();
  const [toast, setToast] = useState<string>("");
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  
  const user = useAuth();
  const uid = user?.uid || null;
  const { role } = useRoles();
  const amLead = role === 'lead' || role === 'admin';
// Leads can edit everything except hidden admin tabs, so treat them like admins here.
  // Members who claimed the project can create tasks for it; leads/admins can always edit
  const claimed = useMemo(() => {
    if (!project || !uid) return false;
    const personId = uid.startsWith("discord:") ? uid.slice("discord:".length) : uid;
    return Array.isArray(project.owner_ids) && project.owner_ids.includes(personId);
  }, [project, uid]);
  const canEdit = amLead || claimed;
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
    if (!id) return;
    const tryFetch = async () => {
      const snap = await getDoc(doc(db, "projects", id));
      if (!snap.exists()) return null;
      return { id, ...(snap.data() as any) } as Project;
    };
    try {
      let p: Project | null = await tryFetch();
      if (!p) {
        // brief retry to avoid sporadic propagation delays
        await new Promise(r => setTimeout(r, 120));
        p = await tryFetch();
      }
      if (p) {
        setProject(p);
        const ids = (p as any).owner_ids || [];
        setOwnerIds(ids);
        setOwners(ids.map((pid: string) => allPeople.find(pp => pp.id === pid)!).filter(Boolean));
      }
    } catch {}
  }

  async function reloadTasks() {
    if (!id) return;
    setTasks(await fetchTasksForProject(id));
  }
  useEffect(() => { reloadTasks(); }, [id]);

  async function claimProject() {
    if (!id || !uid) return;
    // Optimistic: update local project owners immediately
    setProject(p => {
      if (!p) return p;
      const personId = uid.startsWith("discord:") ? uid.slice("discord:".length) : uid;
      const next = Array.from(new Set([...(p.owner_ids || []), personId]));
      return { ...(p as any), owner_ids: next } as any;
    });
    const fn = httpsCallable(functions, "claimProject");
    try { await fn({ projectId: id }); } finally {
  invalidateProjectsCache();
      await reloadOwners();
    }
  }
  async function unclaimProject() {
    if (!id || !uid) return;
    // Optimistic: update local project owners immediately
    setProject(p => {
      if (!p) return p;
      const personId = uid.startsWith("discord:") ? uid.slice("discord:".length) : uid;
      const next = (p.owner_ids || []).filter(x => x !== personId);
      return { ...(p as any), owner_ids: next } as any;
    });
    const fn = httpsCallable(functions, "unclaimProject");
    try { await fn({ projectId: id }); } finally {
      invalidateProjectsCache();
      await reloadOwners();
    }
  }
  // rankedEnabled managed by hook

  // Progress summary removed

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
  const [editTaskId, setEditTaskId] = useState<string | null>(null); // Track which task is in edit mode

  if (!project) return <div className="text-sm">Loading…</div>;

  // derive due date label once
  const dueDateLabel = (() => {
  if (!project.due_date) return null;
  let date: Date | null = null;
  const s = project.due_date;
  const m = s.match(/(\d{4})[\/\-]?(\d{2})[\/\-]?(\d{2})/);
  if (m) { const [, y, mo, d] = m; date = new Date(Number(y), Number(mo) - 1, Number(d)); }
  else if (!isNaN(Date.parse(s))) { date = new Date(s); }
  if (!date) return null;
  const weekday = date.toLocaleString('en-US', { weekday: 'short' });
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const suffix = (n: number) => n === 1 || n === 21 || n === 31 ? 'st' : n === 2 || n === 22 ? 'nd' : n === 3 || n === 23 ? 'rd' : 'th';
  return `${weekday} ${month} ${day}${suffix(day)}`;
  })();

  return (
    <>
      <div className="space-y-4">
        <div className="relative">
          <div className="min-w-0 space-y-1">
            <h1 className="text-lg font-semibold leading-tight tracking-tight break-words pr-0 max-w-[calc(100%-110px)]">{project.name}</h1>
            {project.subsystem && (
              <div className="text-[11px] text-muted-foreground/60 uppercase tracking-caps mt-0.5">{project.subsystem}</div>
            )}
             {/* Description section */}
          </div>
          <div className="absolute top-0 right-0 flex flex-col gap-2 items-end sm:flex-row sm:items-start sm:gap-2" style={{width: 'auto'}}>
            {/* Right-side actions: Link + menu */}
            <div className="flex flex-col space-y-1 sm:flex-row sm:gap-2 items-end">
              {project.design_link && (
                <a
                  className="w-[68px] inline-flex items-center justify-center h-6 rounded-md border border-brand-blue/40 bg-brand-blue/20 hover:bg-brand-blue/30 text-[11px] font-medium whitespace-nowrap transition"
                  href={project.design_link}
                  target="_blank"
                  rel="noreferrer"
                  title="Design link"
                >Link</a>
              )}
              {/* Only leads/admins can see archive/delete menu (when not archived) */}
              <RequireLead>
                {!((project as any).archived) && (
                  <div className="relative">
                    <Dropdown.Root>
                      <Dropdown.DotsButton className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-white/70 bg-card dark:bg-surface hover:bg-card/80 outline-none focus:outline-none ring-0 focus:ring-0 focus-visible:ring-0" />
                      <Dropdown.Popover className="w-48 bg-card dark:bg-surface border border-white/70 shadow-xl outline-none ring-0 focus:ring-0 focus-visible:ring-0">
                        <Dropdown.Menu>
                          <Dropdown.Item
                            icon={Edit03}
                            onAction={() => setShowEditProject(true)}
                            className="[&>div>span]:text-white [&>div>svg]:text-white"
                          >
                            Edit…
                          </Dropdown.Item>
                          <Dropdown.Item
                            icon={ArchiveIcon as any}
                            onAction={() => setShowArchiveConfirm(true)}
                            className="[&>div>span]:text-white [&>div>svg]:text-white"
                          >
                            Archive
                          </Dropdown.Item>
                          <Dropdown.Item
                            icon={Trash01}
                            onAction={() => setShowDeleteConfirm(true)}
                            className="text-danger focus:text-danger hover:text-danger [&>div>span]:text-danger [&>div>svg]:text-danger"
                          >
                            <span className="pr-4">Delete</span>
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown.Root>

                    {showArchiveConfirm && (
                      <div className="absolute right-0 mt-2 w-72 rounded bg-surface border border-border p-3 shadow-lg z-20">
                        <div className="text-sm">Archive this project? You can re-enable it from the Admin page.</div>
                        <div className="flex gap-2 mt-3">
                          <button className="px-3 py-1 rounded bg-destructive text-destructive-foreground" onClick={async ()=>{ if(!project) return; await archiveProject(project.id); setProject(p=> p ? ({...p, archived: true} as any) : p); setShowArchiveConfirm(false); setToast('Project archived — re-enable from Admin'); setTimeout(()=>setToast(''),3000); }}>Confirm</button>
                          <button className="px-3 py-1 rounded bg-card dark:bg-surface border border-border" onClick={()=> setShowArchiveConfirm(false)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {showDeleteConfirm && (
                      <div className="absolute right-0 mt-2 w-72 rounded bg-surface border border-border p-3 shadow-lg z-30">
                        <div className="text-sm">Delete this project permanently? This cannot be undone.</div>
                        <div className="flex gap-2 mt-3">
                          <button className="px-3 py-1 rounded bg-destructive text-destructive-foreground" onClick={handleDeleteProject}>Confirm Delete</button>
                          <button className="px-3 py-1 rounded bg-card dark:bg-surface border border-border" onClick={()=> setShowDeleteConfirm(false)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </RequireLead>
            </div>
              {/* Only leads/admins see archived badge */}
              <RequireLead>
                {(project as any).archived && (
                  <span className="inline-flex items-center h-7 w-[68px] justify-center rounded border border-accent/40 bg-accent/10 text-xs text-accent font-semibold uppercase tracking-wide">Archived</span>
                )}
              </RequireLead>
          </div>
          {/* Edit Project modal (reuses the same component as Timeline) */}
          <ProjectCreateModal
            open={showEditProject}
            onClose={() => setShowEditProject(false)}
            people={allPeople}
            projectToEdit={project as any}
            onCreated={async () => { setShowEditProject(false); await reloadOwners(); }}
          />
           {/* Description shown plainly under header */}
           <div className="mb-8" style={{ marginTop: '24px' }}>
             <div className="rounded-lg border border-border bg-card dark:bg-surface p-3 text-xs text-muted-foreground/60" style={{minHeight: '32px'}}>
               {project.description ? project.description : <span className="text-muted-foreground/40">No description provided.</span>}
             </div>
           </div>
          <div style={{ marginTop: '16px', marginBottom: '48px' }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground uppercase tracking-caps text-xs">Owners</span>
                {/* Member claim controls (visible when not archived) */}
                <RequireMember>
                  {!((project as any).archived) && uid && !amLead && (
                    claimed ? (
                      <button
                        onClick={unclaimProject}
                        className="inline-flex items-center justify-center h-6 px-2 rounded-md border border-accent/40 bg-accent/10 hover:bg-accent/20 text-accent text-[11px] font-medium"
                      >Unclaim</button>
                    ) : (
                      <button
                        onClick={claimProject}
                        className="inline-flex items-center justify-center h-6 px-2 rounded-md border border-accent/40 bg-accent/10 hover:bg-accent/20 text-accent text-[11px] font-medium"
                      >Claim</button>
                    )
                  )}
                </RequireMember>
                <RequireLead>
                  {!((project as any).archived) && (
                    <PersonSelectPopover
                      mode="multi"
                      people={allPeople}
                      selectedIds={ownerIds}
                      onAdd={handleAddOwner}
                      onRemove={handleRemoveOwner}
                      triggerLabel="Add/Remove"
                      triggerContent={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                      buttonClassName="inline-flex items-center justify-center h-6 w-6 rounded-md border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent transition"
                      disabled={ownersBusy}
                      maxItems={5}
                    />
                  )}
                </RequireLead>
              </div>
              {dueDateLabel && (
                <span className="text-muted-foreground uppercase tracking-caps text-xs ml-auto text-right">{dueDateLabel}</span>
              )}
            </div>
            <div className="flex flex-wrap items-start gap-2 text-[13px] leading-snug">
              {owners.length > 0 ? (
                owners.map(o => {
                  const src = getAvatarUrl(o as any);
                  const initials = o?.name
                    ? o.name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map(s => s[0]?.toUpperCase())
                        .join("")
                    : o.id.slice(0, 2).toUpperCase();
                  return (
                    <Link
                      key={o.id}
                      to={`/person/${o.id}`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card dark:bg-surface border border-border/50 text-tick text-sm whitespace-nowrap font-medium hover:bg-card/80 focus:outline-none focus:ring-2 focus:ring-accent/50"
                      title={`View ${o.name}'s profile`}
                    >
                      <Avatar
                        size="xs"
                        alt={o?.name || o.id}
                        src={src}
                        initials={!src ? initials : undefined}
                        className="ring-2 ring-card dark:ring-surface"
                      />
                      <span className="truncate max-w-[160px]">{o.name}</span>
                    </Link>
                  );
                })
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-card dark:bg-surface border border-border/50 text-tick text-sm whitespace-nowrap font-medium">N/A</span>
              )}
            </div>
          </div>
        </div>
                {toast && (
                  <div className="fixed bottom-6 right-6 px-4 py-2 rounded shadow bg-surface/95 border border-accent/40 text-[13px] leading-snug text-white font-medium backdrop-blur-sm">
                    {toast}
                  </div>
                )}
  {/* Progress bar removed */}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs uppercase tracking-caps text-muted-foreground leading-tight">TASKS</h2>
                {/* Leads/admins OR members who claimed can add tasks */}
                {!(project as any).archived && (amLead || claimed) && (
                  <button
                    aria-label="Add task"
                    onClick={()=> setShowAddTask(true)}
                    className="group inline-flex items-center justify-center h-6 w-6 rounded-md border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent transition shadow-sm hover:shadow-accent/20 focus:outline-none"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="sr-only">Add task</span>
                  </button>
                )}
              </div>
              <label className="flex items-center gap-2 select-none cursor-pointer group">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-caps">Hide completed</span>
                <span className="relative inline-flex h-6 w-11 select-none ml-auto">
                  <input
                    type="checkbox"
                    checked={hideCompleted}
                    onChange={e => setHideCompleted(e.target.checked)}
                    className="peer sr-only"
                    onMouseUp={e => e.currentTarget.blur()}
                  />
                  {/* track */}
                  <span
                    className="
                      pointer-events-none block h-6 w-11 rounded-full border border-border
                      bg-black/15 dark:bg-white/15
                      transition-colors
                      peer-checked:bg-[#64C7C9]
                      peer-focus-visible:ring-2 peer-focus-visible:ring-[#64C7C9]/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background
                    "
                  />
                  {/* knob (the moving dot) */}
                  <span
                    className="
                      pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full
                      bg-white dark:bg-background shadow
                      transition-transform
                      peer-checked:translate-x-5
                    "
                  />
                </span>
              </label>
            </div>
          {/* Status Dot Legend - moved above task cards */}
          <div className="flex justify-between items-center w-full max-w-xs mx-auto mb-2" style={{minWidth: '250px', maxWidth: '390px'}}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full inline-block" aria-hidden style={{ background: '#BDC0C3' }}></span>
              <span className="text-[11px] uppercase tracking-caps font-medium">To-do / Not started</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full inline-block" aria-hidden style={{ background: '#FACC15' }}></span>
              <span className="text-[11px] uppercase tracking-caps font-medium">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full inline-block" aria-hidden style={{ background: '#34D399' }}></span>
              <span className="text-[11px] uppercase tracking-caps font-medium">Complete</span>
            </div>
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
                const isEditing = editTaskId === t.id;
                return (
                  <li key={t.id} className="relative flex flex-col justify-between gap-2 rounded bg-card dark:bg-surface border border-border p-3 pr-10 flex-1 min-w-[280px] md:w-[calc(50%-0.75rem)] xl:w-[calc(33.333%-0.75rem)]">
                    <div className="min-w-0 flex items-start gap-1.5">
                      <div className="text-sm break-words" title={t.description}>
                        {t.description}
                      </div>
                      <RequireLead>
                        {!isEditing && (
                          <Dropdown.Root>
                            <Dropdown.DotsButton className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-white/70 bg-card dark:bg-surface hover:bg-card/80 ml-1 outline-none focus:outline-none ring-0 focus:ring-0 focus-visible:ring-0" />
                            <Dropdown.Popover className="w-44 bg-card dark:bg-surface border border-white/70 shadow-xl outline-none ring-0 focus:ring-0 focus-visible:ring-0">
                              <Dropdown.Menu>
                                <Dropdown.Item icon={Edit03 as any} className="[&>div>span]:text-white [&>div>svg]:text-white" onAction={() => { setEditTaskId(t.id); setShowAddTask(false); }}>
                                  Edit…
                                </Dropdown.Item>
                                <Dropdown.Separator />
                                <Dropdown.Item className="[&>div>span]:text-white" onAction={() => handleUpdate(t, "Todo")}>
                                  <span className="inline-flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" aria-hidden></span>
                                    To-do
                                  </span>
                                </Dropdown.Item>
                                <Dropdown.Item className="[&>div>span]:text-white" onAction={() => handleUpdate(t, "In Progress") }>
                                  <span className="inline-flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" aria-hidden></span>
                                    In Progress
                                  </span>
                                </Dropdown.Item>
                                <Dropdown.Item className="[&>div>span]:text-white" onAction={() => handleUpdate(t, "Complete")}>
                                  <span className="inline-flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-success inline-block" aria-hidden></span>
                                    Complete
                                  </span>
                                </Dropdown.Item>
                                <Dropdown.Separator />
                                <Dropdown.Item icon={Trash01 as any} className="text-danger focus:text-danger hover:text-danger [&>div>span]:text-danger [&>div>svg]:text-danger" onAction={() => handleDelete(t)}>
                                  Delete
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown.Root>
                        )}
                      </RequireLead>
                    </div>
                    <div className="text-tick text-muted-foreground flex gap-2 items-center mt-0.5">
                      {/* Show assignee name to all users */}
                      {!isEditing && (
                        assignee ? (
                          <Link
                            to={`/person/${assignee.id}`}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card dark:bg-surface border border-border/50 text-tick text-[11px] font-medium hover:bg-card/80 focus:outline-none focus:ring-2 focus:ring-accent/50"
                            title={`View ${assignee.name}'s profile`}
                          >
                            {(() => {
                              const a = assignee as Person;
                              const src = getAvatarUrl(a as any);
                              const initials = a.name
                                ? a.name.split(/\s+/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join("")
                                : "NA";
                              return (
                                <Avatar
                                  size="xs"
                                  alt={a.name || 'Unassigned'}
                                  src={src}
                                  initials={!src ? initials : undefined}
                                  className="ring-2 ring-card dark:ring-surface"
                                />
                              );
                            })()}
                            <span className="truncate max-w-[160px]">{assignee.name}</span>
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card dark:bg-surface border border-border/50 text-tick text-[11px] font-medium">
                            {(() => {
                              const src = undefined as string | undefined;
                              const initials = "NA";
                              return (
                                <Avatar
                                  size="xs"
                                  alt={'Unassigned'}
                                  src={src}
                                  initials={!src ? initials : undefined}
                                  className="ring-2 ring-card dark:ring-surface"
                                />
                              );
                            })()}
                            <span className="truncate max-w-[160px]">Unassigned</span>
                          </span>
                        )
                      )}
                      {/* Only leads/admins can edit tasks */}
                      <RequireLead>
                        {/* Edit pencil removed; replaced with per-task 3-dots menu next to title */}
                        {isEditing && (
                          <div className="flex items-center gap-1">
                            <PersonSelectPopover
                              mode="single"
                              people={allPeople}
                              selectedId={t.assignee_id || null}
                              onSelect={(id) => handleAssign(t, id || "")}
                              triggerLabel={t.assignee_id ? (allPeople.find(p => p.id === t.assignee_id)?.name || 'Assignee') : 'Unassigned'}
                              buttonClassName="px-2 py-0.5 rounded bg-surface/80 border border-border text-tick text-sm whitespace-nowrap"
                              maxItems={5}
                            />
                            <button
                              className="p-1 rounded hover:bg-white/10"
                              title="Close edit"
                              onClick={() => setEditTaskId(null)}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        )}
                      </RequireLead>
                    </div>
                    {rankedEnabled && (
                      <span className="absolute top-2.5 right-3 text-tick text-muted font-semibold text-[10px] opacity-90">+{pts} · {ptsToHours(pts)}h</span>
                    )}
                    {/* Only leads/admins can edit task details and delete tasks */}
                    <RequireLead>
                      {isEditing && (
                        <div className="w-full flex flex-col gap-1 text-xs mt-2">
                          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                            <div className="flex w-full gap-1.5 flex-wrap">
                                <button onClick={() => handleUpdate(t, "Todo")} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-border bg-card dark:bg-surface hover:bg-card/80 transition justify-center flex-1 sm:flex-none sm:justify-start">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"/> Todo
                                </button>
                                <button onClick={() => handleUpdate(t, "In Progress")} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-border bg-card dark:bg-surface hover:bg-card/80 transition whitespace-nowrap justify-center flex-1 sm:flex-none sm:justify-start">
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent"/> In Progress
                                </button>
                                <button onClick={() => handleUpdate(t, "Complete")} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-border bg-card dark:bg-surface hover:bg-card/80 transition justify-center flex-1 sm:flex-none sm:justify-start">
                                  <span className="w-1.5 h-1.5 rounded-full bg-success"/> Complete
                                </button>
                              </div>
                            <div />
                          </div>

                          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                            <div className="flex items-center gap-2 w-full">
                              <Select
                                value={t.ranked_points === undefined ? "none" : String(t.ranked_points)}
                                onValueChange={(v) => updateTask(t.id, { ranked_points: v === "none" ? undefined : Number(v) }).then(reloadTasks)}
                              >
                                <SelectTrigger className="h-7 px-2.5 text-xs rounded border border-input flex-[2] w-full sm:flex-none sm:w-auto">
                                  <SelectValue placeholder="Points…" />
                                </SelectTrigger>
                                <SelectContent disablePortal>
                                  <SelectItem value="none">Points…</SelectItem>
                                  <SelectItem value="1">1 pt ~ 0.5 hr</SelectItem>
                                  <SelectItem value="3">3 pts ~ 1 hr</SelectItem>
                                  <SelectItem value="6">6 pts ~ 2 hrs</SelectItem>
                                  <SelectItem value="10">10 pts ~ 3 hrs</SelectItem>
                                  <SelectItem value="15">15 pts ~ 5 hrs</SelectItem>
                                  <SelectItem value="40">40 pts ~ 10 hrs</SelectItem>
                                  <SelectItem value="65">65 pts ~ 15 hrs</SelectItem>
                                  <SelectItem value="98">98 pts ~ 20 hrs</SelectItem>
                                  <SelectItem value="150">150 pts ~ 25 hrs</SelectItem>
                                  <SelectItem value="200">200 pts ~ 30 hrs</SelectItem>
                                </SelectContent>
                              </Select>
                              <button onClick={() => handleDelete(t)} className="inline-flex items-center gap-1 px-2.5 h-7 rounded border text-[11px] font-medium border-red-500/60 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition flex-1 sm:flex-none">
                                Delete
                              </button>
                            </div>
                            <div />
                          </div>
                        </div>
                      )}
                    </RequireLead>
                    <span className={`absolute top-1/2 -translate-y-1/2 right-3 w-3.5 h-3.5 rounded-full ${color} shadow`} aria-hidden />
                  </li>
                );
              })}
            </ul>
          </section>
          <TaskCreateModal
            open={showAddTask}
            onClose={()=> setShowAddTask(false)}
            people={allPeople}
            fixedProjectId={project.id}
            onCreated={()=>{ reloadTasks(); }}
          />
          {editTaskId && (
            <TaskCreateModal
              open={true}
              onClose={()=> setEditTaskId(null)}
              people={allPeople}
              fixedProjectId={project.id}
              taskToEdit={tasks.find(tt => tt.id === editTaskId)!}
              onCreated={()=>{ setEditTaskId(null); reloadTasks(); }}
            />
          )}
        </div>
    </>
  );
}
