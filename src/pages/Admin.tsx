import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { isAdminUid } from "../admin";
import type { Person, Project, RankLevel, RankedSettings } from "../types";
import {
  fetchPeople,
  fetchProjects,
  fetchSettings,
  setSettings,
  addPerson,
  addProject,
  addTask,
  updatePerson,
  updateProject,
  fullSystemReset,
  fetchTasks,
  fetchRankedSettings,
  applyRankedPromotionsDemotions,
  addAttendance,
} from "../lib/firestore";

export default function Admin() {
  const user = useAuth();
  const isAdmin = isAdminUid(user?.uid || null);

  // Data
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [settings, setSettingsState] = useState<{ rulebook_url?: string; sharepoint_url?: string } | null>(null);
  const [rankedSettings, setRankedSettingsState] = useState<RankedSettings | null>(null);

  // Settings inputs
  const [ruleUrl, setRuleUrl] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  // Create Person
  const [pName, setPName] = useState("");
  const [pYear, setPYear] = useState("Senior");
  const [pSkills, setPSkills] = useState("");
  const [pRole, setPRole] = useState("");
  const [pDiscord, setPDiscord] = useState("");

  // Create Project
  const [prName, setPrName] = useState("");
  const [prOwners, setPrOwners] = useState<string[]>([]);
  const [prDesign, setPrDesign] = useState("");
  const [prDesc, setPrDesc] = useState("");
  const [prDue, setPrDue] = useState("");
  const [prSubsystem, setPrSubsystem] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");

  // Create Task
  const [tProject, setTProject] = useState<string>("");
  const [tDesc, setTDesc] = useState("");
  const [tStatus, setTStatus] = useState<"Todo" | "In Progress" | "Complete">("In Progress");
  const [tAssignee, setTAssignee] = useState<string>("");
  const [tPoints, setTPoints] = useState<number|"">("");
  const [attendeeId, setAttendeeId] = useState<string>("");

  // Admin UI helpers
  const [peopleSearch, setPeopleSearch] = useState("");
  const [projectsSearch, setProjectsSearch] = useState("");
  // Admin projects list filtering/sorting (UI similar to Overview)
  const [admSelectedSubsystems, setAdmSelectedSubsystems] = useState<string[]>([]);
  const [admSortBy, setAdmSortBy] = useState<"name"|"due"|"subsystem">("subsystem");
  const [admSortDir, setAdmSortDir] = useState<"asc"|"desc">("asc");
  const [admShowSubsystemMenu, setAdmShowSubsystemMenu] = useState(false);
  const [admShowSortMenu, setAdmShowSortMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"people" | "projects" | "settings" | "ranked">("people");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rankedApplying, setRankedApplying] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  // Ranked settings edit buffer
  const [promoEdit, setPromoEdit] = useState<{ bronze?: number; silver?: number; gold?: number; platinum?: number; diamond?: number }>({});
  const [demoEdit, setDemoEdit] = useState<{ bronze?: number; silver?: number; gold?: number; platinum?: number; diamond?: number }>({});
  const [rsDirty, setRsDirty] = useState(false);
  // Apply modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyPassword, setApplyPassword] = useState("");
  // Seed import state
  const [seedPreview, setSeedPreview] = useState<{
    people: { name: string; year?: string; role?: string; skills?: string; discord?: string }[];
    projects: { name: string; subsystem?: string; due_date?: string; description?: string; design_link?: string; owners?: string }[];
    tasks: { project: string; description: string; status: "Todo"|"In Progress"|"Complete"; assignee?: string }[];
  } | null>(null);
  const [seedImporting, setSeedImporting] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string>("");

  // Load data/settings once
  useEffect(() => {
    (async () => {
      const { fetchRankedSettings } = await import("../lib/firestore");
  const { fetchRecentLogs } = await import("../lib/firestore");
  const [pe, pr, st, rs, logs] = await Promise.all([fetchPeople(), fetchProjects(), fetchSettings(), fetchRankedSettings(), fetchRecentLogs(50)]);
      setPeople(pe);
      setProjects(pr);
      setSettingsState(st);
      setRankedSettingsState(rs);
  setRecentLogs(logs);
      setRuleUrl(st?.rulebook_url || "");
      setShareUrl(st?.sharepoint_url || "");
  setPromoEdit({ ...(rs?.promotion_pct || {}) });
  setDemoEdit({ ...(rs?.demotion_pct || {}) });
  setRsDirty(false);
    })();
  }, []);

  // Keep inputs in sync if settings change
  useEffect(() => {
    setRuleUrl(settings?.rulebook_url || "");
    setShareUrl(settings?.sharepoint_url || "");
  }, [settings]);

  // Helpers
  const toggleOwner = (id: string) =>
    setPrOwners((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const [toast, setToast] = useState<string>("");
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(()=>setToast(""), 3000);
  }

  async function handleSaveSettings() {
    try {
      await setSettings({
        rulebook_url: ruleUrl.trim() || undefined,
        sharepoint_url: shareUrl.trim() || undefined,
      });
      setSettingsState(await fetchSettings());
      showToast("Settings saved");
    } catch (e: any) {
      console.error(e);
      showToast("Save failed");
    }
  }

  async function handleFullReset() {
    try {
      await fullSystemReset();
      setPeople([]);
      setProjects([]);
      showToast("System reset complete");
    } catch (e) {
      console.error(e);
      showToast("Reset failed");
    }
  }

  async function handleCreatePerson() {
    try {
  const id = await addPerson({
        name: pName.trim(),
        year: pYear,
        role: pRole.trim() || undefined,
        skills: pSkills.split(",").map((s) => s.trim()).filter(Boolean),
        discord: pDiscord.trim() || undefined,
      } as any);
      setPeople(await fetchPeople());
      setPName("");
      setPYear("Senior");
      setPRole("");
      setPSkills("");
      setPDiscord("");
  showToast("Person saved");
    } catch (e: any) {
      console.error(e);
  showToast("Save failed");
    }
  }

  async function handleCreateProject() {
    if (!prName.trim()) return alert("Give the project a name");
    try {
  const id = await addProject({
        name: prName.trim(),
        owner_ids: prOwners,
        design_link: prDesign.trim() || undefined,
        description: prDesc.trim() || undefined,
        due_date: prDue || undefined, // YYYY-MM-DD
        subsystem: prSubsystem || undefined,
      } as any);
      setProjects(await fetchProjects());
      setPrName("");
      setPrOwners([]);
      setPrDesign("");
      setPrDesc("");
      setPrDue("");
      setPrSubsystem("");
  showToast("Project saved");
    } catch (e: any) {
      console.error(e);
  showToast("Save failed");
    }
  }

  async function handleCreateTask() {
    if (!tProject) return alert("Choose a project");
    try {
  const id = await addTask({ project_id: tProject, description: tDesc.trim(), status: tStatus, assignee_id: tAssignee || undefined, ranked_points: (tPoints || undefined) as any });
      setTProject("");
      setTDesc("");
      setTStatus("In Progress");
      setTAssignee("");
      setTPoints("");
  showToast("Task saved");
    } catch (e: any) {
      console.error(e);
  showToast("Save failed");
    }
  }

  // Subsystems present across projects and counts
  const subsystems = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.subsystem) set.add(p.subsystem);
    return Array.from(set).sort();
  }, [projects]);

  const subsystemCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) if (p.subsystem) m.set(p.subsystem, (m.get(p.subsystem) || 0) + 1);
    return m;
  }, [projects]);

  const filteredAdminProjects = admSelectedSubsystems.length
    ? projects.filter(p => p.subsystem && admSelectedSubsystems.includes(p.subsystem))
    : projects;

  const projectsToShow = useMemo(() => {
    const q = projectsSearch.toLowerCase();
    const searchFiltered = filteredAdminProjects.filter(p => {
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    });
    const sorted = [...searchFiltered].sort((a, b) => {
      let cmp = 0;
      if (admSortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (admSortBy === "due") cmp = (a.due_date || "").localeCompare(b.due_date || "");
      else cmp = (a.subsystem || "").localeCompare(b.subsystem || "") || a.name.localeCompare(b.name);
      return admSortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredAdminProjects, projectsSearch, admSortBy, admSortDir]);

  const sortLabel = (s: typeof admSortBy) => s === "name" ? "Name" : s === "due" ? "Due date" : "Subsystem";
  const dirSymbol = admSortDir === "asc" ? "↑" : "↓";

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAdmShowSubsystemMenu(false); setAdmShowSortMenu(false); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!isAdmin) return (<div><h1 className="text-2xl font-semibold">Admin</h1><p className="text-sm text-uconn-muted mt-2">You must be signed in as admin to access this page.</p></div>);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4">
      {/* Title inline above a sleek tab bar */}
      <h1 className="text-2xl font-semibold mb-1">Admin</h1>
      {/* Tab bar without filled background; keeps underline across full width */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded bg-brand-teal text-black shadow-lg text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}

      {/* Tabs */}
  <div className="sticky top-0 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 bg-uconn-blue/60 backdrop-blur border-b border-uconn-border/60 overflow-x-auto h-scroll-tabs">
        <nav className="flex gap-2 sm:gap-3 h-11 items-end min-w-max" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'people'}
            onClick={() => setActiveTab('people')}
            className={`px-3 pb-2 pt-2 border-b-2 ${activeTab==='people' ? 'border-brand-teal text-white' : 'border-transparent text-uconn-muted hover:text-white'}`}
          >
            People
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'projects'}
            onClick={() => setActiveTab('projects')}
            className={`px-3 pb-2 pt-2 border-b-2 ${activeTab==='projects' ? 'border-brand-teal text-white' : 'border-transparent text-uconn-muted hover:text-white'}`}
          >
            Projects & Tasks
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            className={`px-3 pb-2 pt-2 border-b-2 ${activeTab==='settings' ? 'border-brand-teal text-white' : 'border-transparent text-uconn-muted hover:text-white'}`}
          >
            Global Settings
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'ranked'}
            onClick={() => setActiveTab('ranked')}
            className={`px-3 pb-2 pt-2 border-b-2 ${activeTab==='ranked' ? 'border-brand-teal text-white' : 'border-transparent text-uconn-muted hover:text-white'}`}
          >
            Ranked Settings
          </button>
        </nav>
      </div>

      {activeTab === 'people' && (
        <div role="tabpanel" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <section className="space-y-2">
              <h2 className="font-semibold">Create Person</h2>
              <div className="form-section p-4 space-y-3">
                <input className="px-3 py-2 rounded w-full" placeholder="Name" value={pName} onChange={(e) => setPName(e.target.value)} />
                <div className="flex flex-col sm:flex-row gap-3">
                  <select className="px-3 py-2 rounded dark-select" value={pYear} onChange={(e) => setPYear(e.target.value)}>
                    <option>Freshman</option>
                    <option>Sophomore</option>
                    <option>Junior</option>
                    <option>Senior</option>
                    <option>Graduate</option>
                  </select>
                  <input className="px-3 py-2 rounded flex-1" placeholder="Role (optional)" value={pRole} onChange={(e) => setPRole(e.target.value)} />
                </div>
                <input className="px-3 py-2 rounded w-full" placeholder="Skills (comma-separated)" value={pSkills} onChange={(e) => setPSkills(e.target.value)} />
                <input className="px-3 py-2 rounded w-full" placeholder="Discord (e.g., username)" value={pDiscord} onChange={(e) => setPDiscord(e.target.value)} />
                <button onClick={handleCreatePerson} className="px-3 py-2 rounded bg-white/10 border border-uconn-border">Save Person</button>

                {/* Quick attendance bar (always 10 points) */}
                <div className="pt-3 border-t border-white/10 mt-3">
                  <div className="text-xs text-uconn-muted mb-1">Quick attendance</div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="date"
                      className="px-2.5 py-1.5 rounded text-sm bg-white/5 border border-white/10"
                      value={attendanceDate}
                      onChange={(e)=>setAttendanceDate(e.target.value)}
                    />
                    <select
                      className="px-2.5 py-1.5 rounded dark-select text-sm flex-1"
                      value={attendeeId}
                      onChange={(e)=>setAttendeeId(e.target.value)}
                    >
                      <option value="">Select person…</option>
                      {people.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      className="px-2.5 py-1.5 rounded border border-uconn-border bg-white/10 text-xs whitespace-nowrap"
                      onClick={async()=>{
                        if(!attendeeId) { showToast('Select a person'); return; }
                        const date = attendanceDate || new Date().toISOString().slice(0,10);
                        try {
                          const personName = people.find(p=>p.id===attendeeId)?.name || 'Attendance';
                          await addAttendance({ person_id: attendeeId, date, points: 10 });
                          showToast(`${personName} marked present (+10 pts)`);
                          // Reset after toast so message always shows for the previous selection
                          setTimeout(()=>{
                            setAttendeeId('');
                            setAttendanceDate(new Date().toISOString().slice(0,10));
                          }, 0);
                        } catch (e:any) {
                          if (e?.code === 'DUPLICATE_ATTENDANCE' || e?.message === 'DUPLICATE_ATTENDANCE') {
                            const personName = people.find(p=>p.id===attendeeId)?.name || 'Person';
                            showToast(`${personName} already marked for ${date}`);
                          } else {
                            console.error(e);
                            showToast('Attendance failed');
                          }
                        }
                      }}
                    >Give 10 pts</button>
                  </div>
                </div>
              </div>
            </section>
            <section className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">People</h2>
                <input className="px-3 py-2 rounded text-sm w-56" placeholder="Search people…" value={peopleSearch} onChange={(e)=>setPeopleSearch(e.target.value)} />
              </div>
              <div className="space-y-4">
                {people
                  .filter(p=>{
                    const q = peopleSearch.toLowerCase();
                    if(!q) return true;
                    return p.name.toLowerCase().includes(q) || (p.skills||[]).some(s=>s.toLowerCase().includes(q)) || (p.role||"").toLowerCase().includes(q);
                  })
                  .sort((a,b)=>a.name.localeCompare(b.name))
                  .map((p) => (
                    <details key={p.id} className="rounded-xl bg-white/5 border border-white/10">
                      <summary className="cursor-pointer font-medium px-3 py-2 flex items-center justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="text-xs text-uconn-muted ml-2 truncate">{p.role || p.year || ""}</span>
                      </summary>
                      <div className="px-3 pb-3 mt-1 grid sm:grid-cols-2 gap-4">
                        <input className="px-3 py-2 rounded" value={p.name} onChange={(e) => setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
                        <select className="px-3 py-2 rounded dark-select" value={p.year || "Senior"} onChange={(e) => setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, year: e.target.value } : x)))}>
                          <option>Freshman</option>
                          <option>Sophomore</option>
                          <option>Junior</option>
                          <option>Senior</option>
                          <option>Graduate</option>
                        </select>
                        <input className="px-3 py-2 rounded" placeholder="Role" value={p.role || ""} onChange={(e) => setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, role: e.target.value } : x)))} />
                        <input className="px-3 py-2 rounded" placeholder="Discord" value={p.discord || ""} onChange={(e) => setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, discord: e.target.value } : x)))} />
                        <input className="px-3 py-2 rounded sm:col-span-2" placeholder="Skills (comma-separated)" value={(p.skills || []).join(", ")} onChange={(e) => setPeople((prev) => prev.map((x) => x.id === p.id ? { ...x, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x))} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-2 items-end">
                          <div>
                            <label className="text-xs text-uconn-muted">Rank</label>
                            <select className="mt-1 px-3 py-2 rounded w-full dark-select" value={(p as any).rank || "Bronze"} onChange={(e)=> setPeople(prev=>prev.map(x=>x.id===p.id?{...x, rank: e.target.value as any}:x))}>
                              <option>Bronze</option>
                              <option>Silver</option>
                              <option>Gold</option>
                              <option>Platinum</option>
                              <option>Diamond</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-uconn-muted">Ranked pool</label>
                            <label className="mt-1 flex items-center gap-3 select-none">
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={!!(p as any).ranked_opt_in}
                                onChange={(e)=> setPeople(prev=>prev.map(x=>x.id===p.id?{...x, ranked_opt_in: e.target.checked}:x))}
                              />
                              <span className="relative inline-block h-6 w-11 rounded-full bg-white/15 transition-colors peer-checked:bg-brand-teal/70 
                                after:content-[''] after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-5" />
                              <span className="text-xs text-white/90">Opted in</span>
                            </label>
                          </div>
                        </div>
                        <button className="px-3 py-2 rounded bg-white/10 border border-uconn-border sm:col-span-2" onClick={async () => { await updatePerson(p.id, p as any); showToast("Person updated"); }}>Save Changes</button>
                      </div>
                    </details>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div role="tabpanel" className="mt-4 space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="space-y-2">
            <h2 className="font-semibold">Create Project & Assign Owners</h2>
            <div className="form-section p-4 space-y-3">
              <input className="px-3 py-2 rounded w-full" placeholder="Project name" value={prName} onChange={(e) => setPrName(e.target.value)} />
              <input className="px-3 py-2 rounded w-full" placeholder="Design link (optional)" value={prDesign} onChange={(e) => setPrDesign(e.target.value)} />
              <textarea className="px-3 py-2 rounded w-full" placeholder="Project description (optional)" value={prDesc} onChange={(e) => setPrDesc(e.target.value)} />
              <div className="flex flex-col sm:flex-row gap-2">
                <select className="px-3 py-2 rounded w-full dark-select" value={prSubsystem} onChange={(e)=>setPrSubsystem(e.target.value)}>
                  <option value="">Select subsystem…</option>
                  <option>Aero</option>
                  <option>Business</option>
                  <option>Composites</option>
                  <option>Controls</option>
                  <option>Data Acquisition</option>
                  <option>Electrical IC</option>
                  <option>Electrical EV</option>
                  <option>Finance</option>
                  <option>Frame</option>
                  <option>Manufacturing</option>
                  <option>Powertrain EV</option>
                  <option>Powertrain IC</option>
                  <option>Suspension</option>
                </select>
                <input type="date" className="px-3 py-2 rounded w-full" value={prDue} onChange={(e) => setPrDue(e.target.value)} />
              </div>
              <div className="text-sm text-uconn-muted">Owners</div>
              <input className="px-3 py-2 rounded w-full mb-1" placeholder="Search people…" value={ownerSearch} onChange={(e)=>setOwnerSearch(e.target.value)} />
              <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-auto border border-uconn-border rounded p-2">
                {people.filter(p => {
                  if(!ownerSearch.trim()) return true;
                  const q = ownerSearch.toLowerCase();
                  return p.name.toLowerCase().includes(q) || (p.skills||[]).some(s=>s.toLowerCase().includes(q));
                }).map((p) => {
                  const selected = prOwners.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => toggleOwner(p.id)} className={"text-left px-2 py-1 rounded border " + (selected ? "bg-white/20" : "") }>
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-uconn-muted">{p.skills?.join(", ")}</div>
                    </button>
                  );
                })}
              </div>
              <button onClick={handleCreateProject} className="px-3 py-2 rounded bg-white/10 border border-uconn-border">Save Project</button>
            </div>
            </section>
            <section className="space-y-2">
            <h2 className="font-semibold">Create Task</h2>
            <div className="form-section p-4 space-y-3">
              <select className="px-3 py-2 rounded w-full dark-select" value={tProject} onChange={(e) => setTProject(e.target.value)}>
                <option value="">Select project…</option>
                {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              <input className="px-3 py-2 rounded w-full" placeholder="Task description" value={tDesc} onChange={(e) => setTDesc(e.target.value)} />
              <select className="px-3 py-2 rounded w-full dark-select" value={tAssignee} onChange={(e)=>setTAssignee(e.target.value)}>
                <option value="">Assign to…</option>
                {people.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch gap-3">
                <select
                  className="px-3 py-2 rounded dark-select h-11 sm:w-auto sm:min-w-[160px]"
                  value={tStatus}
                  onChange={(e) => setTStatus(e.target.value as any)}
                >
                  <option>Todo</option>
                  <option>In Progress</option>
                  <option>Complete</option>
                </select>
                <select className="px-3 py-2 rounded dark-select h-11 sm:w-auto sm:min-w-[200px]" value={(tPoints as any)} onChange={(e)=> setTPoints((e.target.value? Number(e.target.value) : "") as any)}>
                  <option value="">Points (by estimated hours)</option>
                  <option value="1">1 pt ~ 30 mins</option>
                  <option value="3">3 pts ~ 1 hour</option>
                  <option value="6">6 pts ~ 2 hours</option>
                  <option value="15">15 pts ~ 5 hours</option>
                  <option value="40">40 pts ~ 10 hours</option>
                  <option value="65">65 pts ~ 15 hours</option>
                  <option value="98">98 pts ~ 20 hours</option>
                  <option value="150">150 pts ~ 25 hours</option>
                  <option value="200">200 pts ~ 30 hours</option>
                </select>
                <button
                  onClick={handleCreateTask}
                  className="px-4 rounded bg-white/10 border border-uconn-border h-11 whitespace-nowrap sm:max-w-full"
                >
                  Save Task
                </button>
              </div>
            </div>
            </section>
          </div>

          <section className="mt-2">
            <div className="flex flex-wrap items-center gap-2 mb-2 relative">
              <h2 className="font-semibold mr-auto">Projects</h2>
              <input
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 bg-white/5 w-56 placeholder:text-uconn-muted focus:outline-none focus-visible:outline-none"
                placeholder="Search projects…"
                value={projectsSearch}
                onChange={(e)=>setProjectsSearch(e.target.value)}
              />

              {/* Subsystem multi-select popover */}
              <div className="relative">
                <button
                  onClick={() => { setAdmShowSubsystemMenu(v=>!v); setAdmShowSortMenu(false); }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10"
                >
                  Subsystems: <span className="font-semibold">{admSelectedSubsystems.length ? `${admSelectedSubsystems.length} selected` : "All"}</span>
                </button>
                <div className={`absolute right-0 z-20 mt-1 w-64 rounded-md border border-white/10 bg-uconn-blue/95 shadow-xl overflow-hidden transition transform origin-top ${admShowSubsystemMenu ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
                  <div className="px-3 py-2 border-b border-white/10">
                    <button
                      className="w-full px-3 py-2 rounded-md text-xs sm:text-sm font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-200 focus:outline-none focus-visible:outline-none"
                      onClick={() => setAdmSelectedSubsystems([])}
                    >
                      Clear selection
                    </button>
                  </div>
                  <div className="max-h-60 overflow-auto p-1">
                    {subsystems.length === 0 && (
                      <div className="px-3 py-2 text-xs text-uconn-muted">No subsystems</div>
                    )}
                    {subsystems.map(s => {
                      const checked = admSelectedSubsystems.includes(s);
                      const count = subsystemCounts.get(s) ?? 0;
                      return (
                        <label key={s} className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-white/10 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-brand-teal"
                            checked={checked}
                            onChange={() => setAdmSelectedSubsystems(prev => checked ? prev.filter(x=>x!==s) : [...prev, s])}
                          />
                          <span className="truncate">{s}</span>
                          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sort popover */}
              <div className="relative">
                <button
                  onClick={() => { setAdmShowSortMenu(v=>!v); setAdmShowSubsystemMenu(false); }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10"
                >
                  Sort: <span className="font-semibold">{sortLabel(admSortBy)} {dirSymbol}</span>
                </button>
                <div className={`absolute right-0 z-20 mt-1 w-48 rounded-md border border-white/10 bg-uconn-blue/95 shadow-xl overflow-hidden transition transform origin-top ${admShowSortMenu ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
                  {(["subsystem","name","due"] as const).map(v => (
                    <button
                      key={v}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 ${admSortBy === v ? "bg-white/10" : ""}`}
                      onClick={() => {
                        if (admSortBy === v) setAdmSortDir(d => d === "asc" ? "desc" : "asc");
                        else setAdmSortBy(v);
                        setAdmShowSortMenu(false);
                      }}
                    >{sortLabel(v)} {admSortBy === v ? dirSymbol : ""}</button>
                  ))}
                </div>
              </div>

              {(admShowSubsystemMenu || admShowSortMenu) && (
                <div className="fixed inset-0 z-10" onClick={() => { setAdmShowSubsystemMenu(false); setAdmShowSortMenu(false); }} />
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {projectsToShow.map((p) => (
                  <details key={p.id} className="form-section p-3">
                    <summary className="cursor-pointer font-medium">{p.name}</summary>
                    <div className="mt-2 space-y-3">
                      <input className="px-3 py-2 rounded w-full" value={p.name} onChange={(e) => setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
                      <input className="px-3 py-2 rounded w-full" placeholder="Design link" value={p.design_link || ""} onChange={(e) => setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, design_link: e.target.value } : x)))} />
                      <textarea className="px-3 py-2 rounded w-full" placeholder="Description" value={p.description || ""} onChange={(e) => setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, description: e.target.value } : x)))} />
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select className="px-3 py-2 rounded w-full dark-select" value={p.subsystem || ""} onChange={(e)=> setProjects(prev=>prev.map(x=>x.id===p.id?{...x, subsystem: e.target.value || undefined}:x))}>
                          <option value="">Subsystem…</option>
                          <option>Aero</option>
                          <option>Business</option>
                          <option>Composites</option>
                          <option>Controls</option>
                          <option>Data Acquisition</option>
                          <option>Electrical IC</option>
                          <option>Electrical EV</option>
                          <option>Finance</option>
                          <option>Frame</option>
                          <option>Manufacturing</option>
                          <option>Powertrain EV</option>
                          <option>Powertrain IC</option>
                          <option>Suspension</option>
                        </select>
                        <input type="date" className="px-3 py-2 rounded w-full" value={p.due_date || ""} onChange={(e) => setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, due_date: e.target.value } : x)))} />
                      </div>
                      <button className="px-3 py-2 rounded bg-white/10 border border-uconn-border w-full" onClick={async () => { await updateProject(p.id, p); showToast("Project updated"); }}>Save Changes</button>
                    </div>
                  </details>
                ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'settings' && (
        <div role="tabpanel" className="mt-4">
          <section className="space-y-2">
            <h2 className="font-semibold">Global Settings</h2>
            <div className="form-section wide p-4 space-y-2">
              <label className="text-sm block">Rulebook PDF URL</label>
              <input className="px-3 py-2 rounded w-full" placeholder="https://…/rulebook.pdf" value={ruleUrl} onChange={(e) => setRuleUrl(e.target.value)} />
              <label className="text-sm block">Team SharePoint URL</label>
              <input className="px-3 py-2 rounded w-full" placeholder="https://…sharepoint.com/sites/FSAE/…" value={shareUrl} onChange={(e) => setShareUrl(e.target.value)} />
              <button onClick={handleSaveSettings} className="mt-2 px-3 py-2 rounded bg-white/10 border border-uconn-border">Save Settings</button>
            </div>
            {/* Retrieve archived project */}
            <ArchivedProjectRestore />
            <div className="form-section wide p-4 mt-4 border border-red-500/30 bg-red-500/10 rounded-xl">
              <h3 className="font-semibold text-red-200">Danger zone</h3>
              <p className="text-sm text-red-200/80">This will permanently delete ALL people, projects, and tasks. This action cannot be undone.</p>
              <button
                onClick={() => { setResetPassword(""); setShowResetModal(true); }}
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded border border-red-500/50 bg-red-600/20 hover:bg-red-600/30 text-red-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Full system reset
              </button>
            </div>
          </section>
          {/* Seed data import */}
          <section className="space-y-2 mt-6">
            <h2 className="font-semibold">Seed data (Excel)</h2>
            <div className="form-section wide p-4 space-y-3">
              <p className="text-sm text-uconn-muted">
                Provide an Excel file with sheets named "People", "Projects", and "Tasks". Columns:
                <br />People: Name, Year, Role, Skills, Discord
                <br />Projects: Name, Subsystem, Due Date (YYYY-MM-DD), Description, Design Link, Owners (comma-separated names)
                <br />Tasks: Project, Description, Status (Todo|In Progress|Complete), Assignee (name)
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setSeedPreview(null); setSeedMessage("");
                  try {
                    const data = await file.arrayBuffer();
                    const XLSX: any = await import("xlsx");
                    const wb = XLSX.read(data, { type: "array" });
                    const peopleSheet = wb.Sheets["People"]; const projectSheet = wb.Sheets["Projects"]; const taskSheet = wb.Sheets["Tasks"]; 
                    const people = peopleSheet ? XLSX.utils.sheet_to_json(peopleSheet) : [];
                    const projects = projectSheet ? XLSX.utils.sheet_to_json(projectSheet) : [];
                    const tasks = taskSheet ? XLSX.utils.sheet_to_json(taskSheet) : [];
                    setSeedPreview({
                      people: people.map((r: any) => ({ name: r.Name?.toString() || "", year: r.Year?.toString(), role: r.Role?.toString(), skills: r.Skills?.toString(), discord: r.Discord?.toString() })),
                      projects: projects.map((r: any) => ({ name: r.Name?.toString() || "", subsystem: r.Subsystem?.toString(), due_date: r["Due Date"]?.toString(), description: r.Description?.toString(), design_link: r["Design Link"]?.toString(), owners: r.Owners?.toString() })),
                      tasks: tasks.map((r: any) => ({ project: r.Project?.toString() || "", description: r.Description?.toString() || "", status: (r.Status?.toString() || "Todo") as any, assignee: r.Assignee?.toString() })),
                    });
                  } catch (err: any) {
                    console.error(err);
                    setSeedMessage("Failed to read file");
                  }
                }}
              />
              {seedPreview && (
                <div className="text-sm">
                  Preview: {seedPreview.people.length} people, {seedPreview.projects.length} projects, {seedPreview.tasks.length} tasks
                  <div className="mt-2 flex gap-2">
                    <button
                      disabled={seedImporting}
                      className="px-3 py-2 rounded border border-uconn-border bg-white/10 disabled:opacity-50"
                      onClick={async () => {
                        if (!seedPreview) return;
                        setSeedImporting(true); setSeedMessage("Importing…");
                        try {
                          // Build name->id map from current and new people
                          const nameToPersonId = new Map<string, string>();
                          for (const p of people) nameToPersonId.set(p.name.trim(), p.id);
                          // Import people
                          for (const row of seedPreview.people) {
                            const name = row.name?.trim(); if (!name) continue;
                            if (!nameToPersonId.has(name)) {
                              const id = await addPerson({ name, year: row.year || undefined, role: row.role || undefined, skills: (row.skills||"").split(",").map((s)=>s.trim()).filter(Boolean), discord: row.discord || undefined } as any);
                              nameToPersonId.set(name, id);
                            }
                          }
                          // Import projects
                          const projectNameToId = new Map<string, string>();
                          for (const row of seedPreview.projects) {
                            const name = row.name?.trim(); if (!name) continue;
                            if (!projectNameToId.has(name)) {
                              const owners = (row.owners||"").split(",").map((s)=>s.trim()).filter(Boolean).map(n=>nameToPersonId.get(n)).filter(Boolean) as string[];
                              const id = await addProject({ name, subsystem: row.subsystem || undefined, due_date: row.due_date || undefined, description: row.description || undefined, design_link: row.design_link || undefined, owner_ids: owners } as any);
                              projectNameToId.set(name, id);
                            }
                          }
                          // Import tasks
                          for (const row of seedPreview.tasks) {
                            const projectId = projectNameToId.get((row.project||"").trim()); if (!projectId) continue;
                            const assignee = row.assignee ? nameToPersonId.get(row.assignee.trim()) : undefined;
                            const status = (row.status === "Todo" || row.status === "In Progress" || row.status === "Complete") ? row.status : "Todo";
                            await addTask({ project_id: projectId, description: row.description || "", status, assignee_id: assignee });
                          }
                          setPeople(await fetchPeople());
                          setProjects(await fetchProjects());
                          setSeedMessage("Import complete");
                        } catch (e) {
                          console.error(e);
                          setSeedMessage("Import failed");
                        } finally {
                          setSeedImporting(false);
                        }
                      }}
                    >Import</button>
                    <button className="px-3 py-2 rounded border border-uconn-border bg-white/10" onClick={()=>{ setSeedPreview(null); setSeedMessage(""); }}>Clear</button>
                  </div>
                  {seedMessage && <div className="mt-2 text-xs text-uconn-muted">{seedMessage}</div>}
                </div>
              )}
            </div>
          </section>
          {/* Reset modal */}
          {showResetModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/70" onClick={() => setShowResetModal(false)} />
              <div className="relative w-[95vw] max-w-md rounded-xl border border-white/15 bg-uconn-blue/95 shadow-2xl p-5">
                <h4 className="text-lg font-semibold mb-2">Confirm full system reset</h4>
                <p className="text-sm text-uconn-muted">Enter the reset password to proceed. Contact the team lead if you don’t know it.</p>
                <div className="mt-3 relative">
                  <input
                    autoFocus
                    type={showPassword ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-10 rounded border border-white/10 bg-black/20"
                    placeholder="Reset password"
                    value={resetPassword}
                    onChange={(e)=>setResetPassword(e.target.value)}
                  />
                  <button
                    aria-label="Toggle password visibility"
                    onClick={()=>setShowPassword(v=>!v)}
                    className="absolute right-1 top-1.5 h-7 w-7 inline-flex items-center justify-center rounded hover:bg-white/10"
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.6-1.36 1.5-2.59 2.57-3.61M10.58 5.06A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8-."></path></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button onClick={()=>setShowResetModal(false)} className="px-3 py-2 rounded border border-uconn-border bg-white/10">Cancel</button>
                  <button
                    onClick={async ()=>{ await handleFullReset(); setShowResetModal(false); }}
                    disabled={resetPassword !== 'UCONN FORMULA SAE'}
                    className={`px-3 py-2 rounded border ${resetPassword === 'UCONN FORMULA SAE' ? 'border-red-500 bg-red-600/30 hover:bg-red-600/40 text-red-100' : 'border-white/10 bg-white/5 text-uconn-muted cursor-not-allowed'}`}
                  >
                    Permanently delete everything
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ranked' && (
        <div role="tabpanel" className="mt-4">
          <section className="space-y-2">
            <h2 className="font-semibold">Ranked Settings</h2>
            <div className="form-section wide p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-brand-teal" checked={!!rankedSettings?.enabled} onChange={async (e) => {
                    const enabled = e.target.checked; setRankedSettingsState(s=>s?{...s, enabled}: { enabled });
                    const { setRankedSettings } = await import("../lib/firestore"); await setRankedSettings({ enabled });
                  }} />
                  Enable ranked mode
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-brand-teal" checked={!!rankedSettings?.autoApply} onChange={async (e) => {
                    const autoApply = e.target.checked; setRankedSettingsState(s=>s?{...s, autoApply}: { autoApply });
                    const { setRankedSettings } = await import("../lib/firestore"); await setRankedSettings({ autoApply });
                  }} />
                  Auto apply hourly
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 -mt-2">
                <p className="text-xs text-uconn-muted">When on, the app reveals the Ranked page and point indicators. Turning it off hides ranked UI and points, but nothing is deleted.</p>
                <p className="text-xs text-uconn-muted">When on, promotions/relegations can be applied on a schedule. In this client-only build it’s a manual action or conceptual; see note below.</p>
              </div>
              <div className="mt-2 overflow-auto rounded border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Rank</th>
                      <th className="text-left px-3 py-2 font-medium">Promote %</th>
                      <th className="text-left px-3 py-2 font-medium">Relegate %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["Bronze","Silver","Gold","Platinum","Diamond"] as const).map(r => {
                      const key = r.toLowerCase() as "bronze"|"silver"|"gold"|"platinum"|"diamond";
                      const promo = (promoEdit as any)[key] ?? 0;
                      const demo = (demoEdit as any)[key] ?? 0;
                      const promoDisabled = r === "Diamond"; // no promotion from Diamond
                      const demoDisabled = r === "Bronze"; // no demotion from Bronze
                      return (
                        <tr key={r} className="border-t border-white/10"> 
                          <td className="px-3 py-2 text-xs">{r}</td>
                          <td className="px-3 py-2">
                            {promoDisabled ? (
                              <span className="text-xs text-uconn-muted">N/A</span>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={promo}
                                onChange={async (e)=>{
                                  const v = Math.max(0, Math.min(100, Number(e.target.value)));
                                  setPromoEdit(prev => ({ ...(prev||{}), [key]: v }));
                                  setRsDirty(true);
                                }}
                                className="px-2 py-1 rounded w-24 bg-white/5 border border-white/10"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {demoDisabled ? (
                              <span className="text-xs text-uconn-muted">N/A</span>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={demo}
                                onChange={async (e)=>{
                                  const v = Math.max(0, Math.min(100, Number(e.target.value)));
                                  setDemoEdit(prev => ({ ...(prev||{}), [key]: v }));
                                  setRsDirty(true);
                                }}
                                className="px-2 py-1 rounded w-24 bg-white/5 border border-white/10"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-end">
                <button
                  disabled={!rsDirty}
                  onClick={async ()=>{
                    try {
                      const { setRankedSettings } = await import("../lib/firestore");
                      await setRankedSettings({ promotion_pct: promoEdit as any, demotion_pct: demoEdit as any });
                      setRankedSettingsState(s => ({ ...(s||{}), promotion_pct: { ...(promoEdit as any) }, demotion_pct: { ...(demoEdit as any) } } as any));
                      setRsDirty(false);
                      showToast("Ranked settings saved");
                    } catch (e) {
                      console.error(e);
                      showToast("Save failed");
                    }
                  }}
                  className="mt-2 px-3 py-2 rounded bg-white/10 border border-uconn-border text-sm disabled:opacity-50"
                >Save changes</button>
              </div>
              {/* Opt-in only and boundary rules are fixed by design; no extra toggles here. */}
              <div className="pt-4 mt-2 border-t border-white/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                  <div>
                    <div className="text-sm font-medium">Manual override</div>
                    <p className="text-xs text-uconn-muted">Apply promotions and relegations immediately using the current week’s points.</p>
                  </div>
                  <button
                    disabled={rankedApplying}
                    onClick={()=>{ setApplyPassword(""); setShowApplyModal(true); }}
                    className="px-3 py-2 rounded bg-brand-teal/40 hover:bg-brand-teal/60 border border-uconn-border text-sm font-medium disabled:opacity-50"
                  >Apply now</button>
                </div>
              </div>

              {/* Recent ranked activity log */}
              <div className="pt-4 mt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Recent ranked activity</div>
                  <button
                    className="text-xs px-2 py-1 rounded border border-uconn-border bg-white/5"
                    onClick={async ()=>{
                      const { fetchRecentLogs } = await import("../lib/firestore");
                      setRecentLogs(await fetchRecentLogs(50));
                    }}
                  >Refresh</button>
                </div>
                <ul className="text-sm divide-y divide-white/10 rounded border border-white/10">
                  {recentLogs.length === 0 && (
                    <li className="px-3 py-2 text-uconn-muted">No activity yet</li>
                  )}
                  {recentLogs.map((e, i) => (
                    <li
                      key={e.id || i}
                      className="px-3 py-2 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 text-xs text-uconn-muted leading-snug">
                        <span className="shrink-0 sm:w-40 sm:inline block">
                          {new Date(e.ts || 0).toLocaleString()}
                        </span>
                        <span className="font-mono text-[10px] sm:text-xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 border border-white/10">
                          {e.type}
                        </span>
                      </div>
                      <span className="text-sm break-words whitespace-pre-wrap leading-snug">
                        {e.type === 'attendance' && (
                          <>
                            Attendance · {e.points} pts {e.person_id ? `→ ${people.find(p=>p.id===e.person_id)?.name || e.person_id}` : ''}
                          </>
                        )}
                        {e.type === 'rank_change' && (
                          <>
                            Rank · {people.find(p=>p.id===e.person_id)?.name || e.person_id} {e.from_rank} → {e.to_rank}
                          </>
                        )}
                        {e.type === 'task_points' && (
                          <>
                            Task · {e.points} pts {e.person_id ? `→ ${people.find(p=>p.id===e.person_id)?.name || e.person_id}` : ''} {e.note ? `· ${e.note}` : ''}
                          </>
                        )}
                        {e.type !== 'attendance' && e.type !== 'rank_change' && (e.note || '')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Apply modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowApplyModal(false)} />
          <div className="relative w-[95vw] max-w-md rounded-xl border border-white/15 bg-uconn-blue/95 shadow-2xl p-5">
            <h4 className="text-lg font-semibold mb-2">Confirm ranked apply</h4>
            <p className="text-sm text-uconn-muted">Enter the confirmation phrase to proceed.</p>
            <input
              autoFocus
              className="mt-3 w-full px-3 py-2 rounded border border-white/10 bg-black/20"
              placeholder="Enter confirmation phrase"
              value={applyPassword}
              onChange={(e)=>setApplyPassword(e.target.value)}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={()=>setShowApplyModal(false)} className="px-3 py-2 rounded border border-uconn-border bg-white/10">Cancel</button>
      <button
                disabled={applyPassword !== 'UCONN FORMULA SAE' || rankedApplying}
                className={`px-3 py-2 rounded border ${applyPassword === 'UCONN FORMULA SAE' ? 'border-brand-teal bg-brand-teal/30 hover:bg-brand-teal/40 text-white' : 'border-white/10 bg-white/5 text-uconn-muted cursor-not-allowed'}`}
                onClick={async ()=>{
                  try {
                    setRankedApplying(true);
        const [pe, ts, rs, att] = await Promise.all([fetchPeople(), fetchTasks(), fetchRankedSettings(), (await import("../lib/firestore")).fetchAttendance()]);
        const moved = await applyRankedPromotionsDemotions(pe, ts, rs, att);
                    showToast(`${moved} updates applied`);
                    const { fetchRecentLogs } = await import("../lib/firestore");
                    setRecentLogs(await fetchRecentLogs(50));
                    setShowApplyModal(false);
                  } catch (e) {
                    console.error(e);
                    showToast("Apply failed");
                  } finally {
                    setRankedApplying(false);
                  }
                }}
              >Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ArchivedProjectRestore() {
  const [all, setAll] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  useEffect(() => { (async () => { try { setLoading(true); const { fetchProjects } = await import("../lib/firestore"); setAll(await fetchProjects()); } finally { setLoading(false); } })(); }, []);
  const archived = all.filter(p=> (p as any).archived);
  const filtered = archived.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="form-section wide p-4 mt-6 space-y-3">
      <h3 className="text-sm font-semibold">Retrieve archived project</h3>
      <p className="text-xs text-uconn-muted">Restore a previously archived project (brings it back into lists).</p>
      {archived.length === 0 ? (
        <p className="text-xs text-uconn-muted italic">No archived projects yet.</p>
      ) : (
        <input
          className="px-3 py-2 rounded w-full"
          placeholder="Search archived projects…"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
      )}
      {loading && <div className="text-xs text-uconn-muted">Loading…</div>}
      {archived.length > 0 && (
        <ul className="space-y-2 max-h-64 overflow-auto pr-1">
          {filtered.slice(0,25).map(p => (
            <li key={p.id} className="flex items-center gap-3 text-sm px-2 py-2 rounded bg-white/5 border border-white/10">
              <span className="truncate flex-1">{p.name}</span>
              <button
                disabled={restoring === p.id}
                onClick={async ()=> {
                  try {
                    setRestoring(p.id);
                    const { updateProject } = await import("../lib/firestore");
                    await updateProject(p.id, { archived: false } as any);
                    setAll(prev => prev.map(x=> x.id===p.id ? { ...x, archived: false } : x));
                    // Use alert fallback here since top-level showToast is out of scope
                    (window as any).alert?.("Project restored");
                  } catch (e) {
                    console.error(e);
                    (window as any).alert?.("Restore failed");
                  } finally {
                    setRestoring(null);
                  }
                }}
                className="px-3 py-1.5 rounded text-xs font-medium border border-brand-teal/50 bg-brand-teal/20 hover:bg-brand-teal/30 disabled:opacity-50"
              >Restore</button>
            </li>
          ))}
          {filtered.length === 0 && !loading && (
            <li className="text-xs text-uconn-muted px-2 py-1">No archived projects match.</li>
          )}
        </ul>
      )}
    </div>
  );
}
