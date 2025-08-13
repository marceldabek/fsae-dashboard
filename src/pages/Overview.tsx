
import { useEffect, useMemo, useState } from "react";
import { fetchPeople, fetchProjects, fetchTasks } from "../lib/firestore";
import type { Person, Project, Task } from "../types";
import { useAuth } from "../hooks/useAuth";
import ProjectCard from "../components/ProjectCard";
import TrophyIcon from "../components/TrophyIcon";
import ProgressBar from "../components/ProgressBar";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center flex flex-col items-center justify-center min-w-0">
      <div className="text-xl font-semibold leading-tight">{value}</div>
      <div
        className="text-[10px] sm:text-[11px] mt-1 tracking-wide text-uconn-muted uppercase whitespace-nowrap overflow-hidden text-ellipsis leading-snug"
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
  // Subsystem multi-select with search
  const [selectedSubsystems, setSelectedSubsystems] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"subsystem" | "name" | "due" | "progress">("subsystem");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showSubsystemMenu, setShowSubsystemMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    (async () => {
      const [pe, pr, ta] = await Promise.all([fetchPeople(), fetchProjects(), fetchTasks()]);
      setPeople(pe); setProjects(pr); setTasks(ta);
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
  }).sort((a, b) => b.completed - a.completed).slice(0,3);

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

  // derive list of subsystems present
  const subsystems = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.subsystem) set.add(p.subsystem);
    return Array.from(set).sort();
  }, [projects]);

  // counts per subsystem for nicer dropdown badges
  const subsystemCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) if (p.subsystem) m.set(p.subsystem, (m.get(p.subsystem) || 0) + 1);
    return m;
  }, [projects]);

  const filteredProjects = selectedSubsystems.length
    ? projects.filter(p => p.subsystem && selectedSubsystems.includes(p.subsystem))
    : projects;
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
              <div className="text-[10px] sm:text-[11px] tracking-wide text-uconn-muted uppercase">Total Task Completion</div>
              <div className="text-xl font-semibold leading-tight">{completion}%</div>
            </div>
            <ProgressBar value={completion} heightClass="h-3" />
          </div>
        </div>

        {/* Right column: leaderboard */}
        <div className="min-w-0">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-2 md:p-3">
            <h2 className="text-base md:text-lg font-bold mb-1">Leaderboard</h2>
            <div className="overflow-x-auto">
              <table className="min-w-[320px] w-full text-[10px] sm:text-xs">
                <thead>
                  <tr>
                    <th className="w-8 py-1 px-2 text-center text-uconn-muted font-semibold">#</th>
                    <th className="py-1 px-2 text-left text-uconn-muted font-semibold">Name</th>
                    <th className="w-20 md:w-24 py-1 px-2 text-center text-uconn-muted font-semibold">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((person, idx) => (
                    <tr key={person.id} className={idx === 0 ? "bg-yellow-100/40" : ""}>
                      <td className="py-1 px-2 text-center">{idx + 1}</td>
                      <td className="py-1 px-2">
                        <div className="truncate max-w-[170px] sm:max-w-[220px] flex items-center gap-1">
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
        </div>
      </div>

  {/* Project cards section */}
      <h2 className="text-lg font-semibold mt-6 mb-2">Projects</h2>
      <div className="flex items-center gap-4 text-xs text-uconn-muted mb-1">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Todo</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> In Progress</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Complete</div>
      </div>
      {/* Toolbar: Subsystem multi-select + Sort dropdown */}
      <div className="relative flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <button
            onClick={() => { setShowSubsystemMenu(v=>!v); setShowSortMenu(false); }}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10"
          >
            Subsystems: <span className="font-semibold">{selectedSubsystems.length ? `${selectedSubsystems.length} selected` : "All"}</span>
          </button>
          {/* Subsystem popover: searchable multi-select with checkboxes */}
          <div className={`absolute z-20 mt-1 w-64 rounded-md border border-white/10 bg-uconn-blue/95 shadow-xl overflow-hidden transition transform origin-top ${showSubsystemMenu ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
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
                <div className="px-3 py-2 text-xs text-uconn-muted">No subsystems</div>
              )}
              {subsystems.map(s => {
                const checked = selectedSubsystems.includes(s);
                const count = subsystemCounts.get(s) ?? 0;
                return (
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-white/10 cursor-pointer focus:outline-none focus-visible:outline-none">
                    <input
                      type="checkbox"
                      className="accent-brand-teal focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
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

        <div className="relative">
          <button
            onClick={() => { setShowSortMenu(v=>!v); setShowSubsystemMenu(false); }}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10"
          >
            Sort: <span className="font-semibold">{sortLabel(sortBy)} {dirSymbol}</span>
          </button>
          {/* Sort popover */}
          <div className={`absolute z-20 mt-1 w-48 rounded-md border border-white/10 bg-uconn-blue/95 shadow-xl overflow-hidden transition transform origin-top ${showSortMenu ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
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
