

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchPeople, fetchProjects, fetchTasks, fetchSettings, fetchAttendance } from "../lib/firestore";
import type { Person, Project, Task, RankLevel, LogEvent, Attendance } from "../types";
import { useRankedEnabled } from "../hooks/useRankedEnabled";
import LinkButton from "../components/LinkButton";

export default function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState<Person | null>(null);
  // All projects (we'll derive which to show)
  const [projects, setProjects] = useState<Project[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]); // tasks assigned to this person
  const [allTasks, setAllTasks] = useState<Task[]>([]); // all tasks (for leaderboard rank)
  const [settings, setSettings] = useState<{rulebook_url?: string; sharepoint_url?: string} | null>(null);
  const [logs, setLogs] = useState<LogEvent[]>([]); // person-specific logs
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [rankedEnabled] = useRankedEnabled();

  useEffect(() => {
    (async () => {
      const [people, projects, allTasks, settings, attendance] = await Promise.all([
        fetchPeople(), fetchProjects(), fetchTasks(), fetchSettings(), fetchAttendance()
      ]);
      setPeople(people);
      const p = people.find(pp => pp.id === id) || null;
      setPerson(p);
      setProjects(projects);
      setAllTasks(allTasks);
      setTasks(allTasks.filter(t => t.assignee_id === id));
      setSettings(settings);
      setAttendance(attendance);
      // Only load logs when Ranked mode is enabled to avoid unnecessary module loads
      if (id && rankedEnabled) {
        try {
          const mod = await import("../lib/firestore");
          if (mod && typeof mod.fetchLogsForPerson === 'function') {
            setLogs(await mod.fetchLogsForPerson(id));
          } else {
            setLogs([]);
          }
        } catch {
          // ignore log fetch errors
          setLogs([]);
        }
      } else {
        setLogs([]);
      }
    })();
  }, [id, rankedEnabled]);

  // Compute attendance streak (consecutive meeting days with attendance, counting today if applicable)
  useEffect(() => {
    if (!person) return;
    const meetingDays = new Set([2,4,6]); // Tue/Thu/Sat
    const datesForPerson = new Set(attendance.filter(a => a.person_id === person.id).map(a => a.date));
    // Walk backwards from today; if today not meeting day skip to previous day; count consecutive meeting days present.
    let streakCount = 0;
    const cursor = new Date();
    for (let i = 0; i < 120; i++) { // safety cap
      const dayOfWeek = cursor.getDay();
      const iso = cursor.toISOString().slice(0,10);
      if (meetingDays.has(dayOfWeek)) {
        if (datesForPerson.has(iso)) streakCount++;
        else break; // gap
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    setStreak(streakCount);
  }, [attendance, person]);

  if (!person) return <div className="text-sm">Loading…</div>;

  // Stats
  // Derive list of projects to display: show if the person is an owner OR they have at least one non-complete task
  // assigned to them for the project. If all their assigned tasks on a project are complete, hide it.
  const displayProjects = projects.filter(pr => {
    if (pr.owner_ids?.includes(id!)) return true;
    const assignedTasks = allTasks.filter(t => t.project_id === pr.id && t.assignee_id === id);
    return assignedTasks.some(t => t.status !== 'Complete');
  });
  const numProjects = displayProjects.length;
  const numTasks = tasks.length;
  const numTasksTodo = tasks.filter(t => t.status !== "Complete").length;

  // Estimate total hours committed (completed tasks) using same mapping logic used elsewhere.
  const ptsToHours = (p: number) => {
    if (p === 1) return 0.5;
    if (p === 3) return 1;
    if (p === 6) return 2;
    if (p === 10) return 3;
    if (p === 15) return 5;
    if (p === 40) return 10;
    if (p === 65) return 15;
    if (p === 98) return 20;
    if (p === 150) return 25;
    if (p === 200) return 30;
    return Math.max(0, Math.round(p / 4));
  };
  const taskHours = Math.round(tasks.filter(t=> t.status === 'Complete').reduce((sum, t)=> sum + (typeof t.ranked_points === 'number' ? ptsToHours(t.ranked_points) : 2), 0));

  // Remove old leaderboard rank on personal page per request

  function rankIcon(rank: RankLevel | undefined) {
    const base = import.meta.env.BASE_URL || '/';
    const r = (rank || "Bronze").toLowerCase();
    const ext = 'png';
    return `${base}icons/rank-${r}.${ext}`;
  }

  // Sort rank history newest first for display
  const history = (person.rank_history || []).slice().sort((a,b)=>b.ts-a.ts);

  // Date formatting helpers (e.g., Aug 9th)
  function ordinal(n: number) {
    return n === 1 || n === 21 || n === 31 ? 'st'
      : n === 2 || n === 22 ? 'nd'
      : n === 3 || n === 23 ? 'rd' : 'th';
  }
  function formatMonthDay(input: number | Date) {
    const d = input instanceof Date ? input : new Date(input);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day}${ordinal(day)}`;
  }
  function replaceIsoDateInNote(note: string) {
    return note.replace(/(\d{4})-(\d{2})-(\d{2})/, (_m, y, mo, da) => {
      const d = new Date(Number(y), Number(mo) - 1, Number(da));
      return formatMonthDay(d);
    });
  }
  function formatLogNote(l: LogEvent) {
    const base = l.note ? replaceIsoDateInNote(l.note) : l.type;
    if (l.type === 'attendance') {
      // Remove patterns like "Attendance 10 pts on " or similar numeric pts phrasing
      return base.replace(/Attendance\s+\d+\s*pts?\s+on\s+/i, 'Attendance ');
    }
    return base;
  }

  return (
  <div className="max-w-2xl mx-auto mt-6 space-y-6">
      {/* Profile Card */}
  <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-1.5 relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xl font-semibold leading-tight truncate flex items-center gap-2">
              <span className="truncate">{person.name}</span>
            </div>
            {person.discord && (
              <div className="text-xs text-muted-foreground leading-snug truncate uppercase tracking-caps">@{person.discord.replace(/^@/, '')}</div>
            )}
            <div className="text-xs text-muted-foreground leading-snug uppercase tracking-caps">{person.year || person.role}</div>
          </div>
          {rankedEnabled && person.rank && (
            <img src={rankIcon(person.rank)} alt={person.rank} className="shrink-0 h-20 w-20 md:h-24 md:w-24 object-contain -mt-2" />
          )}
        </div>
  {/* role/year shown above; badges are displayed below Projects per request */}
        <div className="mt-3 grid grid-cols-5 text-center">
          <div className="flex flex-col items-center">
            <div className="text-lg font-semibold">{numProjects}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-caps">Projects</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-lg font-semibold">{numTasks}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-caps">Tasks</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-lg font-semibold">{numTasksTodo}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-caps">To Do</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-lg font-semibold flex items-center gap-1">
              {streak}
              {streak > 0 && (
                <svg className="h-4 w-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2c.7 2.4 2.1 4.2 4.2 5.5 2 .3 3.3 1.5 3.8 3.6.5 2.1-.2 4-2.1 5.7-.6-1.6-1.5-2.8-2.9-3.6.3 2.2-.5 4-2.4 5.4-1.9 1.4-3.9 1.5-6 .4-2.1-1.1-3.1-2.9-3.1-5.3 0-1.5.5-2.8 1.6-3.9 1.1-1.1 2.4-1.7 3.9-1.7-.4 1.3-.2 2.4.5 3.5.7 1 1.6 1.4 2.7 1.2 1.1-.2 1.8-.9 2-2 .2-1.1-.2-2.1-1.1-3-.9-.9-1.5-2-1.6-3.2-.1-1.2.3-2.4 1.1-3.7Z" />
                </svg>
              )}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-caps">Streak</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-lg font-semibold">{taskHours}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-caps">Hrs</div>
          </div>
        </div>
      </div>

      {/* Quick Links Card */}
  <div className="rounded-2xl bg-card border border-border p-4">
        <h2 className="font-semibold mb-2">Quick Links</h2>
        <ul className="list-disc pl-5 text-sm">
          {(() => {
            const sharepoint = settings?.sharepoint_url || "https://uconn-my.sharepoint.com/shared?id=%2Fsites%2FUConnFormulaSAE%2FShared%20Documents&listurl=https%3A%2F%2Fuconn%2Esharepoint%2Ecom%2Fsites%2FUConnFormulaSAE%2FShared%20Documents";
            return <li><a className="underline" href={sharepoint} target="_blank">SharePoint</a></li>;
          })()}
          {settings?.rulebook_url && <li><a className="underline" href={settings.rulebook_url} target="_blank">Rulebook (PDF)</a></li>}
        </ul>
      </div>

      {/* Projects Card */}
  <div className="rounded-2xl bg-card border border-border p-4">
        <h2 className="font-semibold mb-2">Projects</h2>
        <ul className="space-y-3">
          {displayProjects.map(p => {
            // Use ALL tasks for the project for progress, not just tasks assigned to this person
            const ptasksAll = allTasks.filter(t => t.project_id === p.id);
            const total = ptasksAll.length;
            const done = ptasksAll.filter(t => t.status === "Complete").length;
            const percent = total ? Math.round((done/total)*100) : 0;
            const due = (() => {
              const s = p.due_date || "";
              // Try to parse YYYY-MM-DD or similar
              const m = s.match(/(\d{4})[\/-]?(\d{2})[\/-]?(\d{2})/);
              let date: Date | null = null;
              if (m) {
                const [, y, mo, d] = m;
                date = new Date(Number(y), Number(mo) - 1, Number(d));
              } else if (!isNaN(Date.parse(s))) {
                date = new Date(s);
              }
              if (date) {
                const month = date.toLocaleString('en-US', { month: 'long' });
                const day = date.getDate();
                const suffix = (n: number) => n === 1 || n === 21 || n === 31 ? 'st' : n === 2 || n === 22 ? 'nd' : n === 3 || n === 23 ? 'rd' : 'th';
                return `${month} ${day}${suffix(day)}`;
              }
              return s;
            })();
            return (
              <li key={p.id} className="rounded-xl bg-surface border border-border p-3">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-0 min-w-0">
                    <Link className="text-base md:text-lg font-normal truncate" to={`/project/${p.id}`}>{p.name}</Link>
                    {p.subsystem && (
                      <div className="text-xs uppercase tracking-caps text-muted-foreground leading-tight truncate mb-2" style={{marginBottom: '8px'}}>{p.subsystem}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-sm text-muted-foreground">{done}/{total}</div>
                      {/* Design link removed as requested */}
                  </div>
                </div>
                {/* Description removed as requested */}
                {p.due_date && (() => {
                  let date: Date | null = null;
                  const s = p.due_date;
                  const m = s.match(/(\d{4})[\/-]?(\d{2})[\/-]?(\d{2})/);
                  if (m) {
                    const [, y, mo, d] = m;
                    date = new Date(Number(y), Number(mo) - 1, Number(d));
                  } else if (!isNaN(Date.parse(s))) {
                    date = new Date(s);
                  }
                  if (date) {
                    const weekday = date.toLocaleString('en-US', { weekday: 'long' });
                    const month = date.toLocaleString('en-US', { month: 'long' });
                    const day = date.getDate();
                    const suffix = (n: number) => n === 1 || n === 21 || n === 31 ? 'st' : n === 2 || n === 22 ? 'nd' : n === 3 || n === 23 ? 'rd' : 'th';
                    return (
                      <div className="text-xs text-muted-foreground uppercase tracking-caps" style={{marginTop: 0}}>{weekday}, {month} {day}{suffix(day)}</div>
                    );
                  }
                  return null;
                })()}
                {/* Show only open tasks (not Complete) and style them similar to ProjectDetail */}
                {ptasksAll.filter(t => t.status !== 'Complete').length > 0 && (
                  <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1">
                    {ptasksAll.filter(t => t.status !== 'Complete').map(t => {
                      const color = t.status === "In Progress" ? "bg-warning" : "bg-destructive";
                      return (
                        <li key={t.id} className="relative flex flex-col justify-between gap-2 rounded bg-surface border border-border p-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate" title={t.description}>{t.description}</div>
                            <div className="text-tick text-muted-foreground flex gap-2 items-center mt-0.5">
                              <span className="capitalize">{t.status}</span>
                              <span>·</span>
                              <span>{t.assignee_id ? `@${(people.find(pp => pp.id === t.assignee_id)?.name) || 'Assignee'}` : 'Unassigned'}</span>
                            </div>
                          </div>
                          <span
                            className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full ${color} shadow`}
                            style={{ transform: 'translateY(-50%)' }}
                            aria-hidden
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Badges Card (placed under Projects and above Ranked History) */}
  <div className="rounded-2xl bg-card border border-border p-4">
        <h2 className="font-semibold mb-2">Badges</h2>
        {person.skills && person.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {person.skills.map((s, i) => (
              <span key={i} className="text-xs px-3 py-1 rounded bg-accent/10 border border-accent/30 text-accent font-medium uppercase tracking-caps">{s}</span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground uppercase tracking-caps">No badges yet.</div>
        )}
      </div>

  {/* Bottom two-column area: Ranked History (left) & Points History (right) - only when ranked is enabled */}
  {rankedEnabled ? (
    <div className="grid md:grid-cols-2 gap-6">
  <div className="rounded-2xl bg-card border border-border p-4 relative">
        <div className="flex items-center mb-2">
          <h2 className="font-semibold flex-1">Ranked History</h2>
          <button
            className="px-3 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent font-medium uppercase tracking-caps text-xs hover:bg-accent/20 transition"
            type="button"
            onClick={() => alert('Trophy cabinet coming soon!')}
          >
            Trophies
          </button>
        </div>
        {history.length === 0 ? (
          <div className="text-xs text-muted-foreground uppercase tracking-caps">No rank changes yet.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-24 uppercase tracking-caps">{formatMonthDay(h.ts)}</span>
                <span className="inline-flex items-center gap-1">
                  <img src={rankIcon(h.from)} alt={h.from} className="h-4 w-4 object-contain" />
                  <span>{h.from}</span>
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="inline-flex items-center gap-1">
                  <img src={rankIcon(h.to)} alt={h.to} className="h-4 w-4 object-contain" />
                  <span>{h.to}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
  <div className="rounded-2xl bg-card border border-border p-4">
        <h2 className="font-semibold mb-2">Points History</h2>
        {logs.length === 0 ? (
          <div className="text-xs text-muted-foreground uppercase tracking-caps">No point events yet.</div>
        ) : (
          <ul className="space-y-2 text-sm max-h-72 overflow-auto pr-1">
            {logs
              .filter(l => (l.type === 'attendance' || l.type === 'task_points'))
              .slice(0, 100)
              .map((l, i) => (
                <li key={l.id || i} className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground w-24 shrink-0 uppercase tracking-caps">{formatMonthDay(l.ts)}</span>
                  <span className="flex-1">
                    <span className="text-foreground">{formatLogNote(l)}</span>{' '}
                    {typeof l.points === 'number' && <span className="text-accent font-semibold">(+{l.points})</span>}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  ) : null}
    </div>
  );
}
