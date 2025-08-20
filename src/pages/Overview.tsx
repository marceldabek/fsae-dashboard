
import { useEffect, useMemo, useState, useRef } from "react";
import { fetchPeople, fetchProjects, fetchTasks, fetchAttendance, addProject } from "../lib/firestore";
import type { Person, Project, Task, Attendance } from "../types";
import { useAuth } from "../hooks/useAuth";
import ProjectCard from "../components/ProjectCard";
import PersonSelectPopover from "../components/PersonSelectPopover";
import TrophyIcon from "../components/TrophyIcon";
import ProgressBar from "../components/ProgressBar";
import SwipeCarousel from "../components/SwipeCarousel";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area } from "recharts";
import AttendanceCard from "../components/AttendanceCard";
import { RequireLead } from "../lib/roles";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center flex flex-col items-center justify-center min-w-0">
      {/* Make value text match total task completion font */}
      <div className="text-xl font-semibold leading-tight">{value}</div>
  <div className="mt-1 text-xs uppercase text-muted font-medium whitespace-nowrap overflow-hidden text-ellipsis leading-snug" title={label}>{label}</div>
    </div>
  );
}

export default function Overview() {
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  // Subsystem multi-select with search
  const [selectedSubsystems, setSelectedSubsystems] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"subsystem" | "name" | "due" | "progress">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showSubsystemMenu, setShowSubsystemMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  // Project create overlay state
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [prName, setPrName] = useState("");
  const [prOwners, setPrOwners] = useState<string[]>([]);
  const [prDesign, setPrDesign] = useState("");
  const [prDesc, setPrDesc] = useState("");
  const [prDue, setPrDue] = useState("");
  const [prSubsystem, setPrSubsystem] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  function toggleOwner(id: string) {
    setPrOwners(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  // Search bar state
  const [projectSearch, setProjectSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setProjectSearch(e.target.value);

  useEffect(() => {
    (async () => {
      const [pe, pr, ta, at] = await Promise.all([
        fetchPeople(),
        fetchProjects(),
        fetchTasks(),
        fetchAttendance(),
      ]);
      setPeople(pe); setProjects(pr); setTasks(ta); setAttendance(at);
    })();
  }, []);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === "Complete").length;
  const completion = totalTasks ? Math.round((doneTasks/totalTasks)*100) : 0;

  const projectOwnersCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) {
      for (const owner of p.owner_ids || []) {
        m.set(owner, (m.get(owner) || 0) + 1);
      }
    }
    return m;
  }, [projects]);

  const topContributors = [...projectOwnersCount.entries()]
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5)
    .map(([pid,count]) => ({ name: people.find(p=>p.id===pid)?.name || pid, count }));

  // Leaderboard logic (from Dashboard)
  const leaderboard = people.map(person => {
    const completed = tasks.filter(
      t => t.assignee_id === person.id && t.status === "Complete"
    ).length;
    return { ...person, completed };
  }).sort((a, b) => b.completed - a.completed).slice(0,5);

  // Owners map for ProjectCard
  const ownersMap = new Map(people.map(p => [p.id, p]));
  const tasksByProject = new Map<string, Task[]>();
  for (const t of tasks) {
    const arr = tasksByProject.get(t.project_id) ?? [];
    arr.push(t); tasksByProject.set(t.project_id, arr);
  }
  const projectProgress = (p: Project) => {
    const arr = tasksByProject.get(p.id) ?? [];
    if (!arr.length) return 0;
    const done = arr.filter(t => t.status === "Complete").length;
    return done / arr.length;
  };

  const user = useAuth();

  // Attendance utilities for AttendanceCard
  type AttendanceRecord = { date: string | Date; present: number };
  const dayLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  function toWeekSeries(records: AttendanceRecord[]) {
    const now = new Date();
    // Find the last 3 meeting days (Tue=2, Thu=4, Sat=6)
    const meetings: { label: string; present: number }[] = [];
    let count = 0;
    let d = new Date(now);
    while (meetings.length < 3 && count < 14) { // look back max 2 weeks
      const dow = d.getDay();
      if ([2, 4, 6].includes(dow)) {
        const key = d.toISOString().slice(0, 10);
        const present = records.filter(r => new Date(r.date).toISOString().slice(0,10) === key).reduce((s, r) => s + r.present, 0);
        meetings.unshift({ label: dayLabels[dow], present });
      }
      d.setDate(d.getDate() - 1);
      count++;
    }
    return meetings;
  }
  function toMonthSeries(records: AttendanceRecord[]) {
    const now = new Date();
    const days = 30;
    // Only include Tue (2), Thu (4), Sat (6)
    return Array.from({ length: days }).map((_, idx) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (days - 1 - idx));
      const dayOfWeek = d.getDay();
      if (![2, 4, 6].includes(dayOfWeek)) return null;
      const key = d.toISOString().slice(0, 10);
      const present = records.filter(r => new Date(r.date).toISOString().slice(0,10) === key).reduce((s, r) => s + r.present, 0);
      const label = `${d.toLocaleString(undefined, { month: "short" })} ${d.getDate()}`;
      return { label, present };
    }).filter(Boolean);
  }
  // Convert Attendance[] to AttendanceRecord[]
  const attendanceRecords: AttendanceRecord[] = attendance.map(a => ({ date: a.date, present: 1 }));
  const weekData = toWeekSeries(attendanceRecords);
  const monthData = toMonthSeries(attendanceRecords).filter((d): d is { label: string; present: number } => d !== null);

  // derive list of subsystems present
  // Only consider non-archived (open) projects for the Overview lists/filters
  const openProjects = useMemo(() => projects.filter(p => !(p as any).archived), [projects]);

  const subsystems = useMemo(() => {
    const set = new Set<string>();
    for (const p of openProjects) if (p.subsystem) set.add(p.subsystem);
    return Array.from(set).sort();
  }, [openProjects]);

  // counts per subsystem for nicer dropdown badges (only open projects)
  const subsystemCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of openProjects) if (p.subsystem) m.set(p.subsystem, (m.get(p.subsystem) || 0) + 1);
    return m;
  }, [openProjects]);

  // Hide completed projects switch state
  const [hideCompleted, setHideCompleted] = useState(false);
  // Filter projects by subsystem, search, and hide completed
  const filteredProjects = useMemo(() => {
    let arr = selectedSubsystems.length
      ? openProjects.filter(p => p.subsystem && selectedSubsystems.includes(p.subsystem))
      : openProjects;
    if (projectSearch.trim()) {
      const q = projectSearch.trim().toLowerCase();
      arr = arr.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.subsystem && p.subsystem.toLowerCase().includes(q))
      );
    }
    if (hideCompleted) {
      arr = arr.filter(p => projectProgress(p) < 1);
    }
    return arr;
  }, [openProjects, selectedSubsystems, projectSearch, hideCompleted]);
  const projectsToShow = [...filteredProjects].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") {
      cmp = a.name.localeCompare(b.name);
    } else if (sortBy === "due") {
      const av = a.due_date;
      const bv = b.due_date;
      if (av && bv) cmp = av.localeCompare(bv);
      else if (av && !bv) cmp = -1; // items with due date first in asc
      else if (!av && bv) cmp = 1;  // items without due go last in asc
      else cmp = 0;
    } else if (sortBy === "progress") {
      cmp = projectProgress(a) - projectProgress(b); // asc low->high
    } else {
      // subsystem default
      cmp = (a.subsystem || "").localeCompare(b.subsystem || "") || a.name.localeCompare(b.name);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });
  const sortLabel = (s: typeof sortBy) => s === "name" ? "Name" : s === "due" ? "Due date" : s === "progress" ? "Progress" : "Subsystem";
  const dirSymbol = sortDir === "asc" ? "↑" : "↓";

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowSubsystemMenu(false); setShowSortMenu(false); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
  const uid = user?.uid || null;
  // ...existing code...

  async function handleCreateProject() {
    if (!prName.trim()) return;
    try {
      setSavingProject(true);
      await addProject({
        name: prName.trim(),
        owner_ids: prOwners,
        design_link: prDesign.trim() || undefined,
        description: prDesc.trim() || undefined,
        due_date: prDue || undefined,
        subsystem: prSubsystem || undefined,
      } as any);
      const [pr] = await Promise.all([fetchProjects()]);
      setProjects(pr);
      // reset
      setPrName(""); setPrOwners([]); setPrDesign(""); setPrDesc(""); setPrDue(""); setPrSubsystem("");
      setShowCreateProject(false);
    } finally { setSavingProject(false); }
  }

  return (
    <>
  <h1 className="text-2xl font-semibold mb-4">Team Overview</h1>

  {/* Top area: stats + completion on the left, leaderboard on the right (desktop only) */}
  <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* Left column: stats + progress */}
        <div className="min-w-0">
          {/* Top stats in one single row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Members" value={people.length} />
            <StatCard label="Projects" value={projects.length} />
            <StatCard label="Tasks" value={totalTasks} />
          </div>

          {/* Progress bar with matching stat typography */}
  <div className="rounded-xl bg-white/5 border border-white/10 p-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs tracking-caps text-muted uppercase">Total Task Completion</div>
              {/* Keep completion percentage prominent */}
              <div className="text-xl font-semibold leading-tight">{completion}%</div>
            </div>
            <ProgressBar value={completion} heightClass="h-3" color={completion === 100 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : undefined} />
          </div>
        </div>

        {/* Right column: stacked widgets with swipe + dots */}
        <div className="min-w-0">
          <SwipeCarousel
            slideIndexInitial={0}
            onIndexChange={() => { /* no-op for now */ }}
            dots
          >
            {/* Slide 0: AttendanceCard */}
            <AttendanceCard
              title="Attendance"
              weekData={weekData}
              monthData={monthData}
              className="h-48 sm:h-56"
            />

            {/* Slide 1: Leaderboard */}
            <div className="relative max-w-[390px] w-full mx-auto rounded-2xl p-5 md:p-6 border bg-white/5 text-text border-white/10 overflow-hidden h-48 sm:h-56 flex flex-col">
              <h2 className="text-xs md:text-sm mb-2 text-muted uppercase tracking-caps" style={{ fontWeight: 400 }}>All-Time Leaderboard</h2>
              <div className="h-full overflow-hidden">
                <table className="w-full table-fixed text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <th className="w-8 py-1.5 px-2 text-center text-muted uppercase tracking-caps" style={{ fontWeight: 400 }}>#</th>
                      <th className="py-1.5 px-2 text-left text-muted uppercase tracking-caps" style={{ fontWeight: 400 }}>Name</th>
                      <th className="w-24 md:w-28 py-1.5 px-2 text-center text-muted uppercase tracking-caps" style={{ fontWeight: 400 }}>Tasks</th>
                    </tr>
                  </thead>
                  <tbody className="align-middle">
                    {leaderboard.slice(0, 5).map((person, idx) => (
                      <tr key={person.id} className={idx === 0 ? "bg-yellow-100/40" : ""}>
                        <td className="py-1.5 px-2 text-center">{idx + 1}</td>
                        <td className="py-1.5 px-2">
                          <div className="truncate flex items-center gap-1">
                            {person.name}
                            {idx === 0 && <TrophyIcon />}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center">{person.completed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SwipeCarousel>
        </div>
      </div>

  {/* Project cards section */}
      <div className="mt-6 mb-2 flex items-center w-full" style={{ display: 'flex' }}>
        <h2 className="text-lg font-semibold">Projects</h2>
        <RequireLead>
          <button
            aria-label="Create project"
            onClick={()=> setShowCreateProject(true)}
            className="group inline-flex items-center justify-center h-7 w-7 rounded-md border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent transition shadow-sm hover:shadow-accent/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ml-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="sr-only">Add project</span>
          </button>
        </RequireLead>
        <div className="flex-1" />
        {/* Hide completed switch, styled like admin page ranked pool switch */}
  <label className="relative inline-flex items-center cursor-pointer select-none outline-none focus:outline-none" style={{ marginLeft: 8 }}>
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={e => setHideCompleted(e.target.checked)}
            className="sr-only peer outline-none focus:outline-none"
            onMouseUp={e => e.currentTarget.blur()}
          />
          <span
            className="w-10 h-6 flex items-center bg-white/10 border border-white/20 rounded-full transition peer-checked:bg-accent/60 peer-focus:ring-2 peer-focus:ring-accent/60 relative"
            style={{ minWidth: 40 }}
          >
            <span
              className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${hideCompleted ? 'translate-x-5' : 'translate-x-1'}`}
              style={{ top: '50%', transform: `${hideCompleted ? 'translateX(20px)' : 'translateX(4px)'} translateY(-50%)`, transition: 'transform 0.2s' }}
            />
          </span>
          <span className="sr-only">Hide completed projects</span>
        </label>
      </div>
  <div className="flex items-center gap-4 text-[10px] text-muted mb-1 uppercase tracking-caps">
        <div className="flex items-center gap-1" title="Grey = To-do / Not started">
          <span className="w-2 h-2 rounded-full bg-gray-400" /> To-do / Not started
        </div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> In Progress</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Complete</div>
      </div>
      {/* Toolbar: Subsystem multi-select + Sort dropdown */}
  <div className="grid grid-cols-2 gap-2 w-full">
        <div className="relative min-w-0">
          <button
            onClick={() => { setShowSubsystemMenu(v=>!v); setShowSortMenu(false); }}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10 w-full"
          >
            Subsystems: <span className="font-semibold">{selectedSubsystems.length ? `${selectedSubsystems.length} selected` : "All"}</span>
          </button>
          {/* Subsystem popover: searchable multi-select with checkboxes */}
          <div className={`absolute z-20 mt-1 w-64 rounded-md border border-overlay-10 bg-bg/95 shadow-xl overflow-hidden transition transform origin-top ${showSubsystemMenu ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
            <div className="px-3 py-2 border-b border-white/10">
              <button
                className="w-full px-3 py-2 rounded-md text-xs sm:text-sm font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-200 focus:outline-none focus-visible:outline-none"
                onClick={() => setSelectedSubsystems([])}
              >
                Clear selection
              </button>
            </div>
            <div className="max-h-60 overflow-auto p-1">
              {subsystems.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted uppercase tracking-caps">No subsystems</div>
              )}
              {subsystems.map(s => {
                const checked = selectedSubsystems.includes(s);
                const count = subsystemCounts.get(s) ?? 0;
                return (
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-white/10 cursor-pointer focus:outline-none focus-visible:outline-none">
                    <input
                      type="checkbox"
                      className="accent-accent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                      checked={checked}
                      onChange={() => {
                        setSelectedSubsystems(prev => checked ? prev.filter(x=>x!==s) : [...prev, s]);
                      }}
                    />
                    <span className="truncate">{s}</span>
                    <span className="ml-auto inline-flex items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{count}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative min-w-0">
          <button
            onClick={() => { setShowSortMenu(v=>!v); setShowSubsystemMenu(false); }}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10 w-full"
          >
            Sort: <span className="font-semibold">{sortLabel(sortBy)} {dirSymbol}</span>
          </button>
          {/* Sort popover */}
          <div className={`absolute z-20 mt-1 w-48 rounded-md border border-overlay-10 bg-bg/95 shadow-xl overflow-hidden transition transform origin-top ${showSortMenu ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
            {(["name","subsystem","due","progress"] as const).map(v => (
              <button
                key={v}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 ${sortBy === v ? "bg-white/10" : ""}`}
                onClick={() => {
                  if (sortBy === v) {
                    setSortDir(d => d === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy(v);
                  }
                  setShowSortMenu(false);
                }}
              >{sortLabel(v)} {sortBy === v ? dirSymbol : ""}</button>
            ))}
          </div>
        </div>

        {(showSubsystemMenu || showSortMenu) && (
          <div className="fixed inset-0 z-10" onClick={() => { setShowSubsystemMenu(false); setShowSortMenu(false); }} />
        )}
      </div>

      {/* Project search bar */}
  <div className="w-full mt-2 mb-4">
        <input
          ref={searchInputRef}
          type="text"
          value={projectSearch}
          onChange={handleSearchChange}
          placeholder="Search projects..."
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 bg-white/5 focus:bg-white/10 w-full focus:outline-none"
        />
      </div>
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {projectsToShow.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            owners={p.owner_ids?.map(id => ownersMap.get(id)!).filter(Boolean) ?? []}
            tasks={tasksByProject.get(p.id) ?? []}
    compact
          />
        ))}
      </div>

  {/* Sign in button removed per request */}
  {showCreateProject && (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=> setShowCreateProject(false)} />
      <div className="relative w-[95vw] max-w-lg rounded-2xl border border-white/10 bg-bg/95 backdrop-blur-sm shadow-2xl p-5 overflow-auto max-h-[92vh]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Create Project</h3>
          <button onClick={()=> setShowCreateProject(false)} aria-label="Close" className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="space-y-3">
          <input className="px-3 py-2 rounded w-full" placeholder="Project name" value={prName} onChange={e=>setPrName(e.target.value)} />
          <input className="px-3 py-2 rounded w-full" placeholder="Design link (optional)" value={prDesign} onChange={e=>setPrDesign(e.target.value)} />
          <textarea className="px-3 py-2 rounded w-full" placeholder="Project description (optional)" value={prDesc} onChange={e=>setPrDesc(e.target.value)} />
          <div className="flex flex-col sm:flex-row gap-2">
            <select className="px-3 py-2 rounded w-full dark-select" value={prSubsystem} onChange={e=>setPrSubsystem(e.target.value)}>
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
            <input type="date" className="px-3 py-2 rounded w-full" value={prDue} onChange={e=>setPrDue(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted uppercase tracking-caps">Owners</div>
            <PersonSelectPopover
              mode="multi"
              people={people}
              selectedIds={prOwners}
              onAdd={(id)=> toggleOwner(id)}
              onRemove={(id)=> toggleOwner(id)}
              triggerLabel={prOwners.length ? `${prOwners.length} selected` : 'Add/Remove'}
              buttonClassName="ml-auto text-[11px] px-2 py-1 rounded bg-white/10 border border-white/20"
              maxItems={5}
            />
          </div>
          <button
            onClick={handleCreateProject}
            disabled={!prName.trim() || savingProject}
            className={`w-full px-3 py-2 rounded border border-border text-sm text-center ${prName.trim() ? 'bg-overlay-6 hover:bg-overlay-5' : 'bg-overlay-6 opacity-50 cursor-not-allowed'}`}
          >{savingProject ? 'Saving…' : 'Save Project'}</button>
        </div>
      </div>
    </div>
  )}
    </>
  );
}
