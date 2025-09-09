import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAttendance, fetchPeople, fetchProjects, fetchTasks, updatePerson } from "../lib/firestore";
import type { Attendance, LogEvent, Person, Project, Task } from "../types";
import { useRankedEnabled } from "../hooks/useRankedEnabled";
import { useRoles } from "../lib/roles";
import { useDesignTokens } from "../hooks/useDesignTokens";
import { extractDominantColor, getAvatarUrl } from "../utils/colorExtraction";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings01 } from "@untitledui/icons";
import { getCurrentUser, getUserClaims, listenAuth } from "../auth";

export default function PersonDetail() {
  const { id } = useParams();
  const { tokens, theme } = useDesignTokens();

  const [person, setPerson] = useState<Person | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [bannerColor, setBannerColor] = useState<string>(tokens.gradients.primary);
  const [rankedEnabled] = useRankedEnabled();
  const { role } = useRoles();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentDiscordId, setCurrentDiscordId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Local editable fields for modal
  const [editName, setEditName] = useState("");
  const [editYear, setEditYear] = useState<string>("");
  const [editOptIn, setEditOptIn] = useState<boolean>(false);

  // Load core data
  useEffect(() => {
    (async () => {
      const [peopleArr, projectsArr, allTasksArr, attendanceArr] = await Promise.all([
        fetchPeople(),
        fetchProjects(),
        fetchTasks(),
        fetchAttendance(),
      ]);

      const p = peopleArr.find((pp) => pp.id === id) || null;
      setPerson(p);
      setProjects(projectsArr);
      setAllTasks(allTasksArr);
      setTasks(allTasksArr.filter((t) => t.assignee_id === id));
      setAttendance(attendanceArr);

      if (p) {
        const avatarUrl = getAvatarUrl(p);
        const c = await extractDominantColor(avatarUrl);
        setBannerColor(c);
      }

      if (id && rankedEnabled) {
        try {
          const mod = await import("../lib/firestore");
          if (typeof mod.fetchLogsForPerson === "function") {
            setLogs(await mod.fetchLogsForPerson(id));
          } else {
            setLogs([]);
          }
        } catch {
          setLogs([]);
        }
      } else {
        setLogs([]);
      }
    })();
  }, [id, rankedEnabled]);

  // Auth -> get current discord id from custom claims (discord login)
  useEffect(() => {
    const stop = listenAuth(() => {
      try {
        const u = getCurrentUser();
        if (!u) { setCurrentDiscordId(null); return; }
        const uid = u.uid || "";
        const m = uid.match(/^discord:(\d+)/);
        setCurrentDiscordId(m ? m[1] : uid);
      } catch {
        setCurrentDiscordId(null);
      }
    });
    return () => { try { stop && (stop as any)(); } catch {} };
  }, []);

  // When opening modal, seed edit fields
  useEffect(() => {
    if (settingsOpen && person) {
      setEditName(person.name || "");
      setEditYear(person.year || "");
      setEditOptIn(!!person.ranked_opt_in);
    }
  }, [settingsOpen, person]);

  // Attendance streak (meeting days Tues/Thu/Sat -> 2,4,6)
  useEffect(() => {
    if (!person) return;
    const meetingDays = new Set([2, 4, 6]);
    const datesForPerson = new Set(
      attendance.filter((a) => a.person_id === person.id).map((a) => a.date)
    );
    let s = 0;
    const d = new Date();
    for (let i = 0; i < 120; i++) {
      const dow = d.getDay();
      const iso = d.toISOString().slice(0, 10);
      if (meetingDays.has(dow)) {
        if (datesForPerson.has(iso)) s++;
        else break;
      }
      d.setDate(d.getDate() - 1);
    }
    setStreak(s);
  }, [attendance, person]);

  const displayProjects = useMemo(() => {
    if (!id) return [] as Project[];
    return projects.filter((pr) => {
      if (pr.owner_ids?.includes(id)) return true;
      const assigned = allTasks.filter(
        (t) => t.project_id === pr.id && t.assignee_id === id
      );
      return assigned.some((t) => t.status !== "Complete");
    });
  }, [projects, allTasks, id]);

  const numProjects = displayProjects.length;
  const numTasks = tasks.length;
  const numTasksTodo = tasks.filter((t) => t.status !== "Complete").length;

  // Derive ranked trophies from logs (top of pool finishes)
  const trophies = useMemo(() => {
    if (!Array.isArray(logs) || logs.length === 0) return [] as Array<{ id: string; ts: number | Date }>;
    const matches = logs.filter((l: any) => {
      const typeMatch = l?.type === "ranked_pool_top" || l?.type === "ranked_top";
      const noteStr = typeof l?.note === "string" ? l.note : "";
      const noteMatch = /(finished|placed)\s*1st|top\s*of\s*(the\s*)?pool/i.test(noteStr);
      const pos = (l && (l as any).position) ?? (l && (l as any).rank) ?? null;
      const posMatch = pos === 1;
      return Boolean(typeMatch || noteMatch || posMatch);
    });
    return matches.map((l: any, i: number) => ({ id: l?.id ?? String(i), ts: l?.ts }));
  }, [logs]);

  // Derive ranked movement history (up/down changes)
  const movements = useMemo(() => {
    if (!Array.isArray(logs) || logs.length === 0) return [] as Array<{ id: string; ts: number | Date; delta: number; note?: string }>;
    const extractDelta = (l: any): number | null => {
      if (typeof l?.delta === "number") return l.delta;
      if (typeof l?.change === "number") return l.change;
      const noteStr = typeof l?.note === "string" ? l.note : "";
      const upDown = noteStr.match(/\b(up|down)\b\s*(\d+)?/i);
      if (upDown) {
        const dir = upDown[1].toLowerCase();
        const n = upDown[2] ? parseInt(upDown[2], 10) : 1;
        return dir === "up" ? n : -n;
      }
      const signed = noteStr.match(/([+-]\d+)/);
      if (signed) return parseInt(signed[1], 10);
      return null;
    };
    const relevant = logs.filter((l: any) => {
      const typeMatch = /rank(_|-)?(change|move|movement)/i.test(String(l?.type || ""));
      const noteStr = String(l?.note || "");
      const noteMatch = /(moved|rank)/i.test(noteStr);
      return typeMatch || noteMatch || typeof l?.delta === "number" || typeof l?.change === "number";
    });
    const items = relevant.map((l: any, i: number) => ({
      id: l?.id ?? String(i),
      ts: l?.ts,
      delta: extractDelta(l) ?? 0,
      note: typeof l?.note === "string" ? l.note : undefined,
    }));
    items.sort((a, b) => {
      const ta = a.ts instanceof Date ? a.ts.getTime() : Number(a.ts || 0);
      const tb = b.ts instanceof Date ? b.ts.getTime() : Number(b.ts || 0);
      return tb - ta;
    });
    return items.slice(0, 10);
  }, [logs]);

  function ordinal(n: number) {
    return n === 1 || n === 21 || n === 31
      ? "st"
      : n === 2 || n === 22
      ? "nd"
      : n === 3 || n === 23
      ? "rd"
      : "th";
  }
  function formatMonthDay(input: number | Date) {
    const d = input instanceof Date ? input : new Date(input);
    const month = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate();
    return `${month} ${day}${ordinal(day)}`;
  }

  if (!person) return <div className="text-sm">Loading…</div>;

  const isSelf = !!(person && currentDiscordId && person.id === currentDiscordId);

  async function handleSaveProfile() {
    if (!person) return;
    try {
      setSavingProfile(true);
      await updatePerson(person.id, {
        name: editName?.trim() || person.name,
        year: editYear || undefined,
        ranked_opt_in: !!editOptIn,
      });
      // local state update
      setPerson((prev) => prev ? ({ ...prev, name: editName?.trim() || prev.name, year: editYear || undefined, ranked_opt_in: !!editOptIn }) : prev);
      setSettingsOpen(false);
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="w-full" style={{ color: tokens.color.text, fontFamily: tokens.typography.family.sans }}>
      {/* Full-bleed banner with safe side margins; avatar underlaps by half */}
      <div className="relative" style={{ paddingLeft: 6, paddingRight: 6, marginTop: -8 }}>
        <div
          aria-hidden
          className="w-full"
          style={{ height: 90, background: bannerColor, borderRadius: tokens.radii.xl }}
        />
        {/* Anchor container to align avatar with page content */}
  <div className="mx-auto" style={{ position: "relative", maxWidth: 1120, padding: 6 }}>
          <img
            src={getAvatarUrl(person)}
            alt={person.name}
            className="absolute rounded-full object-cover"
            style={{
              width: 84,
              height: 84,
              left: 8, // slight right nudge
              top: -44, // small downward nudge from previous
              border: `4px solid ${theme === 'light' ? tokens.color.border : tokens.color.bg}`,
              zIndex: 2,
            }}
          />
        </div>
      </div>

      {/* Main content container */}
      <div className="mx-auto w-full" style={{ maxWidth: 1120, padding: 12 }}>
        {/* Identity */}
  <div className="flex flex-col" style={{ gap: 0, marginTop: 20, marginBottom: tokens.spacing.md }}>
      <div className="relative flex items-center gap-2 w-full pr-10">
            <h1 className="truncate" style={{ fontSize: tokens.typography.size.heading, fontWeight: tokens.typography.weight.semibold, lineHeight: 1.1, margin: 0 }}>{person.name}</h1>
            {isSelf && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open profile settings"
        className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-7 rounded-md text-fg-quaternary hover:bg-foreground/10"
                title="Profile settings"
              >
                <Settings01 className="size-5" />
              </button>
            )}
          </div>
          {person.discord && (
            <span className="truncate" style={{ fontSize: tokens.typography.size.body, opacity: 0.9, lineHeight: 1.0, color: tokens.color.muted, marginTop: 0 }}>@{person.discord.replace(/^@/, "")}</span>
          )}
          <span style={{ fontSize: tokens.typography.size.body, opacity: 0.9, lineHeight: 1.1 }}>{person.year || person.role}</span>
        </div>

        {/* Stats row split into vertical columns with dividers */}
  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", width: "100%", marginTop: 0, marginBottom: tokens.spacing.md, fontSize: tokens.typography.size.body }}>
          {[
            { label: "Projects", value: numProjects },
            { label: "Tasks", value: numTasks },
            { label: "To Do", value: numTasksTodo },
            { label: "Streak", value: streak }
          ].map((item, i) => (
            <div key={item.label} className="flex flex-col items-center" style={{ padding: "0 8px", borderLeft: i === 0 ? "none" : `1px solid ${tokens.color.border}` }}>
              <span style={{ opacity: 0.85, fontSize: tokens.typography.size.meta }}>{item.label}</span>
              <span style={{ fontWeight: tokens.typography.weight.semibold }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div style={{ marginBottom: tokens.spacing.lg }}>
          <h2 style={{ fontSize: tokens.typography.size.section, fontWeight: tokens.typography.weight.semibold, marginBottom: 6 }}>
            Projects
          </h2>
          {displayProjects.length === 0 ? (
            <p style={{ opacity: 0.9, color: tokens.color.text }}>No active projects yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}>
              {displayProjects.map((project) => {
                const ptasksAll = allTasks.filter((t) => t.project_id === project.id);
                const total = ptasksAll.length;
                const done = ptasksAll.filter((t) => t.status === "Complete").length;
                const percent = total ? Math.round((done / total) * 100) : 0;
                return (
                  <div
                    key={project.id}
                    style={{
                      backgroundColor: tokens.color.surface,
                      border: `1px solid ${tokens.color.border}`,
                      borderRadius: tokens.radii.lg,
                      padding: tokens.spacing.md,
                    }}
                  >
                    <div className="flex items-start justify-between" style={{ marginBottom: 8 }}>
                      <div>
                        <Link
                          to={`/project/${project.id}`}
                          style={{ fontSize: tokens.typography.size.section, fontWeight: tokens.typography.weight.semibold, color: tokens.color.text, textDecoration: "none" }}
                        >
                          {project.name}
                        </Link>
                        {project.subsystem && (
                          <p style={{ fontSize: tokens.typography.size.meta, color: tokens.color.muted, opacity: 0.8, marginTop: 2 }}>{project.subsystem}</p>
                        )}
                      </div>
                    </div>

                    {/* Due date */}
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
                        const weekday = date.toLocaleString("en-US", { weekday: "long" });
                        const month = date.toLocaleString("en-US", { month: "long" });
                        const day = date.getDate();
                        const suffix = (n: number) => (n === 1 || n === 21 || n === 31 ? "st" : n === 2 || n === 22 ? "nd" : n === 3 || n === 23 ? "rd" : "th");
                        return <p style={{ color: tokens.color.muted, fontSize: tokens.typography.size.meta, marginBottom: 6 }}>Due: {weekday}, {month} {day}{suffix(day)}</p>;
                      }
                      return null;
                    })()}

                    {/* Progress */}
                    <div className="w-full" style={{ background: tokens.color["overlay-10"], borderRadius: 9999, height: 8, marginBottom: 8 }}>
                      <div style={{ width: `${percent}%`, height: 8, borderRadius: 9999, background: bannerColor }} />
                    </div>

                    {/* Active tasks */}
                    {ptasksAll.filter((t) => t.status !== "Complete").length > 0 && (
                      <div>
                        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                          <h4 style={{ fontSize: tokens.typography.size.body, fontWeight: tokens.typography.weight.medium }}>Active Tasks</h4>
                          <span style={{ fontWeight: tokens.typography.weight.medium }}>{done}/{total}</span>
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          {ptasksAll
                            .filter((t) => t.status !== "Complete")
                            .slice(0, 3)
                            .map((task) => (
                              <div key={task.id} className="flex items-start justify-between" style={{ fontSize: tokens.typography.size.meta, lineHeight: 1.2 }}>
                                <p style={{ color: tokens.color.muted }}>{task.description}</p>
                                <span style={{ padding: "2px 6px", borderRadius: 6, fontSize: tokens.typography.size.tiny, background: task.status === "In Progress" ? "rgba(255,193,7,0.15)" : "rgba(220,53,69,0.15)", color: tokens.color.text }}>
                                  {task.status}
                                </span>
                              </div>
                            ))}
                          {ptasksAll.filter((t) => t.status !== "Complete").length > 3 && (
                            <p style={{ fontSize: tokens.typography.size.meta, opacity: 0.9 }}>+{ptasksAll.filter((t) => t.status !== "Complete").length - 3} more tasks</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ranked (trophies + movement history) */}
        {rankedEnabled && (
          <div style={{ marginBottom: tokens.spacing.lg }}>
            <h2 style={{ fontSize: tokens.typography.size.section, fontWeight: tokens.typography.weight.semibold, marginBottom: 6 }}>
              Ranked
            </h2>
            {/* Trophies */}
            {trophies.length === 0 ? (
              <p style={{ opacity: 0.9, fontSize: tokens.typography.size.body, marginBottom: 8 }}>No trophies yet.</p>
            ) : (
              <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 8 }}>
                {Array.from({ length: trophies.length }).map((_, i) => (
                  <span key={i} aria-label="trophy" title="Top of pool" style={{ fontSize: 18 }}>
                    🏆
                  </span>
                ))}
              </div>
            )}

            {/* Movement history */}
            {movements.length === 0 ? (
              <p style={{ opacity: 0.9, fontSize: tokens.typography.size.body }}>No movement yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {movements.map((m) => {
                  const color = m.delta > 0 ? tokens.color.success : m.delta < 0 ? tokens.color.danger : tokens.color.muted;
                  const sign = m.delta > 0 ? "+" : m.delta < 0 ? "" : "";
                  return (
                    <div key={m.id} className="flex items-center justify-between" style={{ borderBottom: `1px solid ${tokens.color["overlay-10"]}`, paddingBottom: 4 }}>
                      <span style={{ fontSize: tokens.typography.size.meta, opacity: 0.9, width: 64 }}>{formatMonthDay(m.ts)}</span>
                      <span style={{ color, fontWeight: tokens.typography.weight.medium }}>
                        {sign}{m.delta}
                      </span>
                      <span style={{ fontSize: tokens.typography.size.meta, opacity: 0.85, textAlign: "right", flex: 1, marginLeft: 8 }}>
                        {m.note || "Rank movement"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Admin: Ranked History & Points */}
        {rankedEnabled && role === "admin" && (
          <div className="grid md:grid-cols-2" style={{ gap: 16 }}>
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <h3 style={{ fontSize: tokens.typography.size.section, fontWeight: tokens.typography.weight.semibold }}>Ranked History</h3>
              </div>
              {logs.length === 0 ? (
                <p style={{ opacity: 0.9, fontSize: tokens.typography.size.body }}>No point events yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 6, maxHeight: 256, overflow: "auto" }}>
                  {logs
                    .filter((l) => l.type === "attendance" || l.type === "task_points")
                    .slice(0, 10)
                    .map((l, i) => (
                      <div key={l.id || i} className="flex items-start gap-3" style={{ padding: 6, borderBottom: `1px solid ${tokens.color["overlay-10"]}` }}>
                        <span style={{ fontSize: tokens.typography.size.meta, opacity: 0.9, width: 64 }}>{formatMonthDay(l.ts)}</span>
                        <div className="flex-1">
                          <span style={{ fontSize: tokens.typography.size.body }}>{l.note || l.type}</span>
                          {typeof l.points === "number" && (
                            <span style={{ marginLeft: 6, color: tokens.color.success, fontWeight: tokens.typography.weight.medium, fontSize: tokens.typography.size.meta }}>
                              (+{l.points})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: tokens.typography.size.section, fontWeight: tokens.typography.weight.semibold, marginBottom: 8 }}>Points History</h3>
              {logs.length === 0 ? (
                <p style={{ opacity: 0.9, fontSize: tokens.typography.size.body }}>No point events yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 6, maxHeight: 256, overflow: "auto" }}>
                  {logs
                    .filter((l) => l.type === "attendance" || l.type === "task_points")
                    .slice(0, 10)
                    .map((l, i) => (
                      <div key={l.id || i} className="flex items-start gap-3" style={{ padding: 6, borderBottom: `1px solid ${tokens.color["overlay-10"]}` }}>
                        <span style={{ fontSize: tokens.typography.size.meta, opacity: 0.9, width: 64 }}>{formatMonthDay(l.ts)}</span>
                        <div className="flex-1">
                          <span style={{ fontSize: tokens.typography.size.body }}>{l.note || l.type}</span>
                          {typeof l.points === "number" && (
                            <span style={{ marginLeft: 6, color: tokens.color.success, fontWeight: tokens.typography.weight.medium, fontSize: tokens.typography.size.meta }}>
                              (+{l.points})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Self settings modal */}
        {isSelf && (
          <ModalOverlay isOpen={settingsOpen} onOpenChange={(v) => setSettingsOpen(!!(v as any))} className="items-center">
            <Modal>
              <Dialog className="w-full max-w-lg">
                <div className="rounded-xl border border-input bg-card text-card-foreground shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-input">
                    <h3 className="text-lg font-semibold">Profile Settings</h3>
                    <button
                      onClick={() => setSettingsOpen(false)}
                      aria-label="Close"
                      className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-foreground/10"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="mb-1 block text-sm text-muted-foreground">Full name</label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your full name" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-muted-foreground">Academic year</label>
                      <div className="flex gap-2">
                        <Select value={editYear} onValueChange={setEditYear}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year…" />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "Freshman",
                              "Sophomore",
                              "Junior",
                              "Senior",
                              "Graduate",
                              "Alumni",
                            ].map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Allow clearing year */}
                        {editYear && (
                          <button
                            type="button"
                            className="px-2 text-xs rounded border border-input"
                            onClick={() => setEditYear("")}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 flex items-center justify-between gap-3">
                      <span className="text-sm" style={{ color: tokens.color.text, fontWeight: tokens.typography.weight.medium }}>
                        Participate in ranked pool
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer select-none outline-none focus:outline-none">
                        <span className="relative inline-flex h-6 w-11 select-none ml-auto">
                          <input
                            type="checkbox"
                            checked={!!editOptIn}
                            onChange={(e)=>setEditOptIn(e.target.checked)}
                            className="peer sr-only"
                            aria-label="Participate in ranked pool"
                          />
                          <span className="pointer-events-none block h-6 w-11 rounded-full border border-border bg-black/15 dark:bg-white/15 transition-colors peer-checked:bg-[#64C7C9] peer-focus-visible:ring-2 peer-focus-visible:ring-[#64C7C9]/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background" />
                          <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white dark:bg-background shadow transition-transform peer-checked:translate-x-5" />
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="p-4 flex gap-2 border-t border-input">
                    <button
                      onClick={() => setSettingsOpen(false)}
                      className="px-3 py-2 rounded border border-input text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile || !editName.trim()}
                      className={`px-3 py-2 rounded border text-sm border-input ml-auto ${!editName.trim() || savingProfile ? 'opacity-50 cursor-not-allowed' : 'hover:bg-card/80'}`}
                    >
                      {savingProfile ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </Dialog>
            </Modal>
          </ModalOverlay>
        )}
      </div>
    </div>
  );
}