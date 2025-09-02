
import { useEffect, useMemo, useState, useRef } from "react";
import { fetchPeople, fetchProjects, fetchTasks, fetchAttendance, fetchProjectDependencies } from "../lib/firestore";
import type { Person, Project, Task, Attendance, ProjectDependency } from "../types";
import { useAuth } from "../hooks/useAuth";
import ProjectCard from "../components/ProjectCard";
import TrophyIcon from "../components/TrophyIcon";
import ProgressBar from "../components/ProgressBar";
import SwipeCarousel from "../components/SwipeCarousel";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area } from "recharts";
import AttendanceCard from "../components/AttendanceCard";
import { RequireLead } from "../lib/roles";
import ProjectCreateModal from "../components/ProjectCreateModal";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-card dark:bg-surface border border-white/10 p-3 text-center flex flex-col items-center justify-center min-w-0">
      {/* Make value text match total task completion font */}
      <div className="text-xl font-semibold leading-tight">{value}</div>
  <div className="mt-1 text-xs tracking-caps text-muted uppercase opacity-80 whitespace-nowrap overflow-hidden text-ellipsis leading-snug" title={label}>{label}</div>
    </div>
  );
}

export default function Overview() {
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [dependencies, setDependencies] = useState<ProjectDependency[]>([]);
  // Subsystem multi-select with search
  const [selectedSubsystems, setSelectedSubsystems] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"subsystem" | "name" | "due" | "progress">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showSubsystemMenu, setShowSubsystemMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  // Project create overlay state (moved to reusable modal)
  const [showCreateProject, setShowCreateProject] = useState(false);
  // Search bar state
  const [projectSearch, setProjectSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setProjectSearch(e.target.value);

  useEffect(() => {
    (async () => {
      const [pe, pr, ta, at, deps] = await Promise.all([
        fetchPeople(),
        fetchProjects(),
        fetchTasks(),
        fetchAttendance(),
        fetchProjectDependencies(),
      ]);
      setPeople(pe); setProjects(pr); setTasks(ta); setAttendance(at); setDependencies(deps);
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

  // Determine blocked projects (grey), using dependencies and completion state
  const blockedProjectIds = useMemo(() => {
    if (!dependencies?.length) return new Set<string>();
    const incoming = new Map<string, string[]>();
    for (const d of dependencies) {
      if (!d.from_id || !d.to_id) continue;
      if (!incoming.has(d.to_id)) incoming.set(d.to_id, []);
      incoming.get(d.to_id)!.push(d.from_id);
    }
    const doneSet = new Set<string>();
    for (const p of openProjects) {
      const arr = tasks.filter(t => t.project_id === p.id);
      if (arr.length && arr.every(t => t.status === "Complete")) doneSet.add(p.id);
    }
    const blocked = new Set<string>();
    for (const p of openProjects) {
      const inc = incoming.get(p.id) || [];
      if (inc.length && inc.some(fid => !doneSet.has(fid))) blocked.add(p.id);
    }
    return blocked;
  }, [openProjects, tasks, dependencies]);

  // Exclude blocked projects from Overview
  const availableProjects = useMemo(() => openProjects.filter(p => !blockedProjectIds.has(p.id)), [openProjects, blockedProjectIds]);

  const subsystems = useMemo(() => {
    const set = new Set<string>();
    for (const p of availableProjects) if (p.subsystem) set.add(p.subsystem);
    return Array.from(set).sort();
  }, [availableProjects]);

  // counts per subsystem for nicer dropdown badges (only open projects)
  const subsystemCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of availableProjects) if (p.subsystem) m.set(p.subsystem, (m.get(p.subsystem) || 0) + 1);
    return m;
  }, [availableProjects]);

  // Hide completed projects switch state
  const [hideCompleted, setHideCompleted] = useState(false);
  // Filter projects by subsystem, search, and hide completed
  const filteredProjects = useMemo(() => {
    let arr = selectedSubsystems.length
      ? availableProjects.filter(p => p.subsystem && selectedSubsystems.includes(p.subsystem))
      : availableProjects;
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
  }, [availableProjects, selectedSubsystems, projectSearch, hideCompleted]);
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

  async function refreshProjects() {
    const [pr] = await Promise.all([fetchProjects()]);
    setProjects(pr);
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
            <StatCard label="Projects" value={availableProjects.length} />
            <StatCard label="Tasks" value={totalTasks} />
          </div>

          {/* Progress bar with matching stat typography */}
  <div className="rounded-xl bg-card dark:bg-surface border border-border p-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs tracking-caps text-muted uppercase opacity-80">Total Task Completion</div>
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
                className="h-56"
              />

            {/* Slide 1: Leaderboard */}
            <div className="relative max-w-[390px] w-full mx-auto rounded-2xl p-5 md:p-6 border bg-card dark:bg-surface text-foreground border-white/10 overflow-hidden h-56 flex flex-col">
              <h2 className="text-xs md:text-sm mb-2 text-muted uppercase tracking-caps" style={{ fontWeight: 400 }}>All-Time Leaderboard</h2>
              <div className="h-full overflow-hidden">
                <table className="mx-auto w-full table-fixed text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <th className="w-8 py-1 px-2 text-center text-muted uppercase tracking-caps" style={{ fontWeight: 400 }}>#</th>
                      <th className="py-1 px-2 text-left text-muted uppercase tracking-caps" style={{ fontWeight: 400 }}>Name</th>
                      <th className="w-24 md:w-28 py-1 px-2 text-center text-muted uppercase tracking-caps" style={{ fontWeight: 400 }}>Tasks</th>
                    </tr>
                  </thead>
                  <tbody className="align-middle">
                    {leaderboard.slice(0, 7).map((person, idx) => (
                      <tr key={person.id} className={idx === 0 ? "bg-yellow-100/40" : ""}>
                        <td className="py-1 px-2 text-center">{idx + 1}</td>
                        <td className="py-1 px-2">
                          <div className="truncate flex items-center gap-1 mb-0.5">
                            {person.name}
                            {idx === 0 && <TrophyIcon />}
                          </div>
                        </td>
                        <td className="py-1 px-2 text-center">{person.completed}</td>
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
          {/* Toggle */}
          <span className="relative inline-flex h-6 w-11 select-none ml-auto">
            {/* hidden checkbox drives styles */}
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
          <span className="sr-only">Hide completed projects</span>
        </label>
      </div>
  <div className="flex items-center gap-4 text-[10px] text-muted mb-1 uppercase tracking-caps">
        <div className="flex items-center gap-1" title="Grey = To-do / Not started">
          <span className="w-2 h-2 rounded-full" style={{ background: '#BDC0C3' }} /> To-do / Not started
        </div>
  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#64C7C9' }} /> In Progress</div>
  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#34D399' }} /> Complete</div>
      </div>
      {/* Toolbar: Subsystem multi-select + Sort dropdown */}
  <div className="grid grid-cols-2 gap-2 w-full">
        <div className="relative min-w-0">
          <button
            onClick={() => { setShowSubsystemMenu(v=>!v); setShowSortMenu(false); }}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card dark:bg-surface hover:bg-card/80 w-full"
          >
            Subsystems: <span className="font-semibold">{selectedSubsystems.length ? `${selectedSubsystems.length} selected` : "All"}</span>
          </button>
          {/* Subsystem popover: searchable multi-select with checkboxes */}
          <div className={`absolute z-20 mt-1 w-64 rounded-md border border-border bg-card dark:bg-surface shadow-xl overflow-hidden transition transform origin-top ${showSubsystemMenu ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
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
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-card/80 cursor-pointer focus:outline-none focus-visible:outline-none">
                    <input
                      type="checkbox"
                      className="accent-accent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                      checked={checked}
                      onChange={() => {
                        setSelectedSubsystems(prev => checked ? prev.filter(x=>x!==s) : [...prev, s]);
                      }}
                    />
                    <span className="truncate">{s}</span>
                    <span className="ml-auto inline-flex items-center justify-center rounded-full bg-surface/80 px-2 py-0.5 text-[10px]">{count}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative min-w-0">
          <button
            onClick={() => { setShowSortMenu(v=>!v); setShowSubsystemMenu(false); }}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card dark:bg-surface hover:bg-card/80 w-full"
          >
            Sort: <span className="font-semibold">{sortLabel(sortBy)} {dirSymbol}</span>
          </button>
          {/* Sort popover */}
          <div className={`absolute z-20 mt-1 w-48 rounded-md border border-border bg-card dark:bg-surface shadow-xl overflow-hidden transition transform origin-top ${showSortMenu ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
            {(["name","subsystem","due","progress"] as const).map(v => (
              <button
                key={v}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-surface/80 ${sortBy === v ? "bg-surface/80" : ""}`}
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
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card dark:bg-surface focus:bg-card/80 w-full focus:outline-none"
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

  {/* Create Project Modal */}
  <ProjectCreateModal
    open={showCreateProject}
    onClose={() => setShowCreateProject(false)}
    people={people}
    onCreated={async () => { await refreshProjects(); }}
  />
    </>
  );
}
