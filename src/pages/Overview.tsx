
import { useEffect, useMemo, useState, useRef } from "react";
import { fetchPeople, fetchProjects, fetchTasks, fetchAttendance } from "../lib/firestore";
import type { Person, Project, Task, Attendance } from "../types";
import { useAuth } from "../hooks/useAuth";
import ProjectCard from "../components/ProjectCard";
import TrophyIcon from "../components/TrophyIcon";
import ProgressBar from "../components/ProgressBar";
import SwipeCarousel from "../components/SwipeCarousel";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area } from "recharts";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center flex flex-col items-center justify-center min-w-0">
    {/* Keep number large for prominence */}
    <div className="text-xl font-semibold leading-tight">{value}</div>
      <div
  className="text-[10px] mt-1 tracking-caps text-muted uppercase whitespace-nowrap overflow-hidden text-ellipsis leading-snug"
        title={label}
      >
        {label}
      </div>
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
  const [sortBy, setSortBy] = useState<"subsystem" | "name" | "due" | "progress">("subsystem");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showSubsystemMenu, setShowSubsystemMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

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

  // Build attendance series for recent days; include only Tue/Thu/Sat
  const attendanceSeries = useMemo(() => {
    const days = 21; // 3 weeks to ensure enough Tue/Thu/Sat points
    const today = new Date();
    const byDate = new Map<string, number>();
    for (const a of attendance) {
      const d = a.date; // YYYY-MM-DD
      byDate.set(d, (byDate.get(d) || 0) + 1);
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    const points: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      const dow = dt.getDay(); // 0=Sun ... 6=Sat
      if (!(dow === 2 || dow === 4 || dow === 6)) continue; // Tue/Thu/Sat only
      const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      const label = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      points.push({ date: label, count: byDate.get(key) || 0 });
    }
    return points;
  }, [attendance]);

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

  const filteredProjects = selectedSubsystems.length
    ? openProjects.filter(p => p.subsystem && selectedSubsystems.includes(p.subsystem))
    : openProjects;
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
  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">Team Overview</h1>

  {/* Top area: stats + completion on the left, leaderboard on the right (desktop only) */}
  <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* Left column: stats + progress */}
        <div className="min-w-0">
          {/* Top stats in one single row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Total People" value={people.length} />
            <StatCard label="Total Projects" value={projects.length} />
            <StatCard label="Total Tasks" value={totalTasks} />
          </div>

          {/* Progress bar with matching stat typography */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 pb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs tracking-caps text-muted uppercase">Total Task Completion</div>
              {/* Keep completion percentage prominent */}
              <div className="text-xl font-semibold leading-tight">{completion}%</div>
            </div>
            <ProgressBar value={completion} heightClass="h-3" />
          </div>
        </div>

        {/* Right column: stacked widgets with swipe + dots */}
        <div className="min-w-0">
          <SwipeCarousel
            slideIndexInitial={0}
            onIndexChange={() => { /* no-op for now */ }}
            dots
          >
            {/* Slide 0: Attendance chart */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 md:p-4">
              <h2 className="text-base md:text-lg font-bold mb-2">Meeting Attendance</h2>
              <div className="h-48 sm:h-56">
                {attendanceSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={attendanceSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="attLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#64C7C9" />
                          <stop offset="100%" stopColor="#98D7D8" />
                        </linearGradient>
                        <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#64C7C9" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#98D7D8" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                      <Tooltip contentStyle={{ background: "#0b132b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} labelStyle={{ color: "#cbd5e1" }} />
                      <Area type="monotone" dataKey="count" stroke="none" fill="url(#attFill)" />
                      <Line type="monotone" dataKey="count" stroke="url(#attLine)" strokeWidth={3} dot={{ r: 2, stroke: "#98D7D8" }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted">No attendance yet</div>
                )}
              </div>
            </div>

            {/* Slide 1: Leaderboard */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 md:p-4">
              <h2 className="text-base md:text-lg font-bold mb-2">Leaderboard</h2>
              <div className="h-48 sm:h-56 overflow-hidden">
                <table className="w-full table-fixed text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <th className="w-8 py-1.5 px-2 text-center text-muted font-semibold uppercase tracking-caps">#</th>
                      <th className="py-1.5 px-2 text-left text-muted font-semibold uppercase tracking-caps">Name</th>
                      <th className="w-24 md:w-28 py-1.5 px-2 text-center text-muted font-semibold uppercase tracking-caps">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="align-middle">
                    {leaderboard.map((person, idx) => (
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
      <h2 className="text-lg font-semibold mt-6 mb-2">Projects</h2>
  <div className="flex items-center gap-4 text-[10px] text-muted mb-1 uppercase tracking-caps">
        <div className="flex items-center gap-1" title="Grey = To-do / Not started">
          <span className="w-2 h-2 rounded-full bg-gray-400" /> To-do / Not started
        </div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> In Progress</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Complete</div>
      </div>
      {/* Toolbar: Subsystem multi-select + Sort dropdown */}
      <div className="grid grid-cols-2 gap-2 mb-3 w-full">
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
            {(["subsystem","name","due","progress"] as const).map(v => (
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
    </>
  );
}
