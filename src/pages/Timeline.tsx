import React, { useEffect, useMemo, useRef, useState } from "react";
import { listenAuth, isCurrentUserAdmin } from "../auth";
import { fetchProjects, fetchTasks, fetchProjectDependencies, addProjectDependency, deleteProjectDependency } from "../lib/firestore";
import type { Project as AppProject, Task, ProjectDependency } from "../types";
import { useRoles } from "../lib/roles";
import { Info } from "lucide-react";

// =============================================
// Timeline Page — Lanes + Grey-by-default edges, click-to-blue; clear Link flow
// =============================================
// HOW TO WIRE YOUR BACKEND
// We use your Firestore data: projects, tasks, and a new collection project_deps.
// Double-click navigates to /project/:id.

// =============================
// Types
// =============================
export type ProjectStatus = "done" | "wip" | "blocked";

export type Project = {
  id: string;
  name: string;
  // ISO string. Only the DUE DATE matters for placement.
  dueDate: string;
  status: ProjectStatus;
  milestone?: boolean; // optional: show a date pill above block
};

export type Dependency = {
  id?: string;
  fromId: string; // prerequisite project (edge starts here)
  toId: string;   // dependent project (edge ends here)
};

// =============================
// Utilities
// =============================
const MONTH_NAMES = [
  "January","February","March","April","May","June","July","August","September","October","November","December"
];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function fmtShort(d: Date) { return `${d.getMonth()+1}/${d.getDate()}`; }
function isoToDate(iso: string) { const d = new Date(iso); if (isNaN(+d)) throw new Error("Invalid date: "+iso); return d; }

// Academic year runs Aug -> Jun (11 months). We compute the window around `today` unless explicitly provided.
export function academicYearWindow(base = new Date()) {
  const y = base.getFullYear();
  const startsThisYear = base.getMonth() >= 7; // Aug = 7
  const startYear = startsThisYear ? y : y - 1;
  const start = new Date(startYear, 7, 1); // Aug 1
  const months: { idx: number; year: number; month: number; name: string; start: Date; days: number; }[] = [];
  for (let m = 7; m <= 11; m++) {
    const s = new Date(startYear, m, 1);
    months.push({ idx: months.length, year: s.getFullYear(), month: s.getMonth(), name: MONTH_NAMES[s.getMonth()].toUpperCase().slice(0,3), start: s, days: daysInMonth(s.getFullYear(), s.getMonth()) });
  }
  for (let m = 0; m <= 5; m++) {
    const s = new Date(startYear + 1, m, 1);
    months.push({ idx: months.length, year: s.getFullYear(), month: s.getMonth(), name: MONTH_NAMES[s.getMonth()].toUpperCase().slice(0,3), start: s, days: daysInMonth(s.getFullYear(), s.getMonth()) });
  }
  return { start, months };
}

// Use project palette from tokens
const STATUS_COLOR: Record<ProjectStatus, string> = {
  done: "#34D399",            // green (complete)
  wip: "hsl(var(--accent))", // blue/accent (can work)
  blocked: "#BDC0C3",        // grey (blocked by deps)
};

// =============================
// Data hooks (Firestore-backed)
// =============================
// kept for reference, but Timeline uses useRoles() for lead/admin gating
function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean>(isCurrentUserAdmin());
  useEffect(() => {
    const unsub = listenAuth(() => setIsAdmin(isCurrentUserAdmin()));
    return () => { try { unsub(); } catch {} };
  }, []);
  return isAdmin;
}

function areAllTasksDone(tasks: Task[] | undefined): boolean {
  const list = tasks || [];
  if (!list.length) return false; // must have tasks and all complete
  return list.every(t => t.status === "Complete");
}

function toIso(dateStr?: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(+d)) return null;
  return d.toISOString();
}

function useProjects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [dependencies, setDependencies] = useState<Dependency[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [projs, tasks, deps] = await Promise.all([
          fetchProjects(),
          fetchTasks(),
          fetchProjectDependencies(),
        ]);
        if (!mounted) return;
        const tasksByProject = new Map<string, Task[]>();
        for (const t of tasks) {
          const arr = tasksByProject.get(t.project_id) || [];
          arr.push(t); tasksByProject.set(t.project_id, arr);
        }
        // Build dependencies and statuses: done if all tasks complete; blocked if any incoming dep not done; else wip
        const edgesRaw: Dependency[] = deps
          .filter(d => !!d.from_id && !!d.to_id)
          .map((d: ProjectDependency) => ({ id: d.id, fromId: d.from_id, toId: d.to_id }));
        // Dedupe edges by fromId|toId
        const seen = new Set<string>();
        const edges: Dependency[] = [];
        for (const e of edgesRaw) {
          const key = `${e.fromId}|${e.toId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          edges.push(e);
        }
        const incoming = new Map<string, string[]>();
        edges.forEach(e => { if (!incoming.has(e.toId)) incoming.set(e.toId, []); incoming.get(e.toId)!.push(e.fromId); });
        const doneSet = new Set<string>();
        for (const p of projs) {
          if ((p as any).archived) continue;
          if (areAllTasksDone(tasksByProject.get(p.id))) doneSet.add(p.id);
        }
        const mapped: Project[] = projs
          .filter(p => !(p as any).archived)
          .map((p: AppProject) => {
            const iso = toIso(p.due_date);
            if (!iso) return null;
            const isDone = doneSet.has(p.id);
            let status: ProjectStatus;
            if (isDone) status = "done";
            else {
              const inc = incoming.get(p.id) || [];
              const blockedBy = inc.some(fid => !doneSet.has(fid));
              status = blockedBy ? "blocked" : "wip";
            }
            return { id: p.id, name: p.name, dueDate: iso, status } as Project;
          })
          .filter(Boolean) as Project[];
        setProjects(mapped);
        setDependencies(edges);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load timeline");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function createDependency(fromId: string, toId: string) {
    if (fromId === toId) return; // no self edge
    try {
      const id = await addProjectDependency({ from_id: fromId, to_id: toId } as any);
      setDependencies(prev => {
        const cur = prev || [];
  if (cur.some(e => e.fromId === fromId && e.toId === toId)) return cur; // prevent duplicates
        return [...cur, { id, fromId, toId }];
      });
    } catch (e) {
      // best-effort; keep UI stable
    }
  }

  return { projects, dependencies, setDependencies, loading, error, createDependency };
}

// =============================
// Layout calculation
// =============================
export type LayoutItem = { id: string; x: number; y: number; w: number; h: number; monthIdx: number };

type LayoutCfg = { monthWidth: number; rowHeight: number; block: { w: number; h: number }; headerH: number };

export function computeYearLayout(projects: Project[] | null, months: ReturnType<typeof academicYearWindow>["months"], cfg: LayoutCfg) {
  const { monthWidth, rowHeight, block, headerH } = cfg;
  if (!projects) return { items: new Map<string, LayoutItem>(), containerH: headerH + rowHeight * 8 };

  const items = new Map<string, LayoutItem>();
  const perMonthDayRow: Record<number, Record<number, number>> = {};

  projects.forEach(p => {
    const d = isoToDate(p.dueDate);
    const mIdx = months.findIndex(m => d.getFullYear() === m.year && d.getMonth() === m.month);
    if (mIdx === -1) return;
    const day = d.getDate();
    if (!perMonthDayRow[mIdx]) perMonthDayRow[mIdx] = {} as Record<number, number>;
    const row = perMonthDayRow[mIdx][day] !== undefined ? perMonthDayRow[mIdx][day] : 0;
    perMonthDayRow[mIdx][day] = row + 1;

    const month = months[mIdx];
    const dayWidth = monthWidth / month.days;
    const xMonthStart = monthWidth * mIdx;
    const x = xMonthStart + dayWidth * (day - 1) + Math.max(0, (dayWidth - block.w) / 2);
    const y = headerH + row * rowHeight;
    items.set(p.id, { id: p.id, x, y, w: block.w, h: block.h, monthIdx: mIdx });
  });

  let maxRow = 1;
  Object.values(perMonthDayRow).forEach(dayMap => {
    Object.values(dayMap).forEach(r => { if (r > maxRow) maxRow = Math.max(maxRow, r); });
  });

  const containerH = headerH + (Math.max(3, maxRow) * cfg.rowHeight) + 160;
  return { items, containerH };
}

function useYearLayout(projects: Project[] | null, cfg: LayoutCfg) {
  const { months } = academicYearWindow();
  const layout = useMemo(() => computeYearLayout(projects, months, cfg), [projects, months, cfg.monthWidth, cfg.rowHeight, cfg.block.w, cfg.block.h, cfg.headerH]);
  return { months, layout };
}

// =============================
// Edge routing (lanes + side ports; grey by default, blue on highlight)
// =============================
function EdgesLayer({ items, dependencies, highlightId, monthWidth, months }:{ items: Map<string,LayoutItem>; dependencies: Dependency[]; highlightId?: string | null; monthWidth: number; months: ReturnType<typeof academicYearWindow>["months"]; }){
  const width = monthWidth * months.length;
  let maxBottom = 0; items.forEach(r => { maxBottom = Math.max(maxBottom, r.y + r.h); });
  const base = maxBottom + 12; // just under the lowest row

  const valid = dependencies.filter(e => items.has(e.fromId) && items.has(e.toId));

  // Compute minimal baselines per y-row to avoid dropping all the way down
  const rowBottoms: number[] = [];
  items.forEach(r => rowBottoms.push(r.y + r.h));
  rowBottoms.sort((a,b) => a-b);
  const bottoms: number[] = rowBottoms.filter((v,i,a)=> i===0 || v!==a[i-1]);

  // Build adjacency for fan-out/fan-in slotting
  const keyOf = (e: Dependency) => `${e.fromId}|${e.toId}`;
  const outMap = new Map<string, Dependency[]>();
  const inMap = new Map<string, Dependency[]>();
  valid.forEach(e => {
    const a = items.get(e.fromId)!; const b = items.get(e.toId)!;
    if (!outMap.has(e.fromId)) outMap.set(e.fromId, []);
    if (!inMap.has(e.toId)) inMap.set(e.toId, []);
    outMap.get(e.fromId)!.push(e);
    inMap.get(e.toId)!.push(e);
  });
  // Sort adjacency by geometric order for stable visual lanes
  outMap.forEach((arr) => arr.sort((e1, e2) => (items.get(e1.toId)!.x - items.get(e2.toId)!.x) || e1.toId.localeCompare(e2.toId)));
  inMap.forEach((arr) => arr.sort((e1, e2) => (items.get(e1.fromId)!.x - items.get(e2.fromId)!.x) || e1.fromId.localeCompare(e2.fromId)));
  const outSlot = new Map<string, number>(); const outCount = new Map<string, number>();
  const inSlot = new Map<string, number>();  const inCount  = new Map<string, number>();
  outMap.forEach((arr, fromId) => { outCount.set(fromId, arr.length); arr.forEach((e, i)=> outSlot.set(keyOf(e), i)); });
  inMap.forEach((arr, toId)   => { inCount.set(toId,   arr.length); arr.forEach((e, i)=> inSlot.set(keyOf(e), i)); });

  const gap = 14; // px spacing between adjacent lanes near ports
  const pad = 14; // stub pad from block edge to port lane

  const paths = valid.map((e, i) => {
    const a = items.get(e.fromId)!; const b = items.get(e.toId)!;
  // Ports: right-out of source, left-in of target with vertical distribution
  const sx = a.x + a.w;
  const tx = b.x;

    // Fan-out/fan-in slot offsets
    const k = keyOf(e);
    const fCount = outCount.get(e.fromId) || 1;
    const fSlot = outSlot.get(k) || 0;
    const tCount = inCount.get(e.toId) || 1;
    const tSlot = inSlot.get(k) || 0;
  const fOffset = (fSlot - (fCount - 1) / 2) * gap;
  const tOffset = (tSlot - (tCount - 1) / 2) * gap;
  const sy = a.y + ((fSlot + 1) / (fCount + 1)) * a.h; // vertically spaced out ports
  const ty = b.y + ((tSlot + 1) / (tCount + 1)) * b.h; // vertically spaced in ports

  let startX = sx + pad + fOffset;
    const endX = tx - pad - tOffset;
    const x1 = Math.min(startX, endX);
    const x2 = Math.max(startX, endX);
    let neededBottom = Math.max(a.y + a.h, b.y + b.h);
    // Check for obstacles between source and target horizontally
    items.forEach(r => {
      const rx1 = r.x, rx2 = r.x + r.w;
      const overlap = !(rx2 < x1 || rx1 > x2);
      if (!overlap) return;
      neededBottom = Math.max(neededBottom, r.y + r.h);
    });
  const laneY = (neededBottom + 8);
  // extend further for higher slots to reduce overlap
  const extraReach = (fCount - fSlot) * 18;
  startX = Math.min(startX + extraReach, endX - 16);

    // If no substantial drop is needed, route straight across then into target
    const crossing = endX <= startX + 2; // not enough horizontal room after offsets
    const needsDrop = laneY > Math.max(sy, ty) + 6 || crossing;
    const d = needsDrop
      // Drop to minimal lane, run horizontally using fanned ports, then rise into target
      ? `M ${sx} ${sy} H ${startX} V ${laneY} H ${endX} V ${ty} H ${tx}`
      // Go straight with pre-target fanned verticals
      : `M ${sx} ${sy} H ${endX} V ${ty} H ${tx}`;

    const active = !!(highlightId && (e.fromId === highlightId || e.toId === highlightId));
    return (
      <path key={i} d={d} stroke={active ? "hsl(var(--accent))" : "rgb(var(--overlay-10))"} strokeWidth={active ? 3 : 2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.9} />
    );
  });

  const guideYs = bottoms.map(b => b + 8);
  const svgH = Math.max(base + 24, (guideYs[guideYs.length-1] || base) + 24);
  return (
    <svg width={width} height={svgH} className="absolute left-0 top-0 pointer-events-none z-0">
      {/* alignment guides hidden per request */}
      {paths}
    </svg>
  );
}

// =============================
// Presentational pieces
// =============================
function MonthHeader({ months, monthWidth, onPickMonth }: { months: ReturnType<typeof academicYearWindow>["months"]; monthWidth: number; onPickMonth?: (idx:number)=>void; }) {
  return (
  <div className="sticky top-0 z-10 bg-card/80 dark:bg-surface/80 backdrop-blur border-b border-border">
      <div className="relative" style={{ width: monthWidth * months.length }}>
        {months.map((m, i) => (
          <div
            key={i}
            className="inline-flex items-center justify-center font-medium text-sm uppercase tracking-wide text-mutedToken-foreground hover:bg-surface/60 cursor-pointer select-none"
            style={{ width: monthWidth, height: 36 }}
            onClick={() => { if (onPickMonth) onPickMonth(i); }}
          >
            {m.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-mutedToken-foreground leading-snug">
      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background: STATUS_COLOR.done}} /> done</span>
  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background: STATUS_COLOR.wip}} /> active</span>
      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background: STATUS_COLOR.blocked}} /> blocked</span>
      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background: 'rgb(var(--overlay-10))'}} /> deps</span>
  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{background: 'hsl(var(--accent))'}} /> highlight</span>
    </div>
  );
}

function InfoPopover({ canEdit }: { canEdit: boolean }){
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative inline-flex items-center group"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="p-1 rounded group-hover:bg-surface/60" aria-label="Info">
        <Info size={16} className="text-mutedToken-foreground" />
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 rounded-md border border-border bg-card dark:bg-surface shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95">
          <div className="text-xs font-semibold mb-2">Legend</div>
          <MiniLegend />
          <div className="h-px my-2 bg-border" />
          <div className="text-[11px] leading-snug text-mutedToken-foreground space-y-1">
            <div>Click a project: highlight edges</div>
            <div>Double-click a project: open details</div>
            {canEdit && <div>Edit → Link: create dependency</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectBlock({ p, rect, selected, onClick, onDoubleClick }:{ p: Project; rect: LayoutItem; selected: boolean; onClick: ()=>void; onDoubleClick: ()=>void; }){
  const color = STATUS_COLOR[p.status];
  const due = isoToDate(p.dueDate);
  return (
    <div
      role="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`absolute z-10 rounded shadow-sm border border-black/50 dark:border-white/40 overflow-hidden text-black dark:text-white hover:scale-[1.02] transition-transform ${selected ? "ring-2 ring-[hsl(var(--accent))]" : ""}`}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, background: color }}
      title={`${p.name} - due ${fmtShort(due)}`}
    >
      {/* top-right date */}
      <div className="absolute top-0.5 right-1 text-[9px] font-semibold leading-none text-black/80 dark:text-white/90 select-none">
        {fmtShort(due)}
      </div>
      {/* centered title with more padding to avoid date overlap */}
      <div className="absolute inset-0 grid place-items-center px-1.5 pt-3 pb-1.5 text-center">
        <div className="text-[11px] leading-tight break-words" style={{ display: '-webkit-box', WebkitLineClamp: 3 as any, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
      </div>
      {p.milestone && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] bg-black text-white px-1.5 py-[2px] rounded">
          {fmtShort(due)}
        </div>
      )}
    </div>
  );
}

// =============================
// Main Page Component
// =============================

type ViewMode = { kind: "year" } | { kind: "month"; monthIdx: number };
const LINK_ARMED = "__ARMED__"; // sentinel meaning: user clicked "Link" and is choosing a source

export default function TimelinePageBlue() {
  const { role } = useRoles();
  const canEdit = role === 'admin' || role === 'lead';
  const { projects, dependencies, setDependencies: _setDependencies, loading, error, createDependency } = useProjects();
  const [toast, setToast] = useState<string>("");
  const showToast = (msg: string) => { setToast(msg); window.setTimeout(()=>setToast(""), 2500); };

  // UI state
  const [view, setView] = useState<ViewMode>({ kind: "year" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [linkActive, setLinkActive] = useState<boolean>(false);
  const linkLabel = linkActive ? "Linking..." : "Link";

  // Layout constants
  const monthWidth = 640; // px per month in the year view
  const rowHeight = 74; // reduced spacing between rows
  const block = { w: 104, h: 56 }; // slightly taller boxes
  const headerH = 56; // space under month header before rows start

  const { months, layout } = useYearLayout(projects, { monthWidth, rowHeight, block, headerH });
  const yearWidth = monthWidth * months.length;
  const monthNameFull = (idx: number) => `${MONTH_NAMES[months[idx].month]} ${months[idx].year}`;
  const projById = useMemo(() => new Map((projects||[]).map(p => [p.id, p] as const)), [projects]);
  const today = new Date();
  const isSameYMD = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

  // Year view: primary scroller + synced bottom scrollbar
  const yearScrollRef = useRef<HTMLDivElement | null>(null);
  const yearBottomBarRef = useRef<HTMLDivElement | null>(null);
  const isSyncing = useRef(false);
  useEffect(() => {
    const top = yearScrollRef.current;
    const bottom = yearBottomBarRef.current;
    if (!top || !bottom) return;
    const onTop = () => {
      if (isSyncing.current) return; isSyncing.current = true;
      bottom.scrollLeft = top.scrollLeft; isSyncing.current = false;
    };
    const onBottom = () => {
      if (isSyncing.current) return; isSyncing.current = true;
      top.scrollLeft = bottom.scrollLeft; isSyncing.current = false;
    };
    top.addEventListener('scroll', onTop, { passive: true });
    bottom.addEventListener('scroll', onBottom, { passive: true });
    return () => { top.removeEventListener('scroll', onTop); bottom.removeEventListener('scroll', onBottom); };
  }, [view, yearWidth]);

  // Month view sizing
  // Month view dynamic sizing using ResizeObserver
  const [monthHostWidth, setMonthHostWidth] = useState<number>(0);
  const daysInSelectedMonth = view.kind === "month" ? months[view.monthIdx].days : 0;
  const baseDayCellW = 56;
  const dayCellW = view.kind === "month" && monthHostWidth ? Math.max(baseDayCellW, Math.floor(monthHostWidth / daysInSelectedMonth)) : baseDayCellW;
  const monthViewW = view.kind === "month" ? dayCellW * (months[view.monthIdx].days) : 0;

  // Month view layout map with per-day stacking
  const filteredProjectsThisMonth = useMemo(() => {
    if (!projects || view.kind !== "month") return [] as Project[];
    const m = months[view.monthIdx];
    return projects
      .filter(p => { const d = isoToDate(p.dueDate); return d.getFullYear() === m.year && d.getMonth() === m.month; })
      .sort((a,b) => isoToDate(a.dueDate).getDate() - isoToDate(b.dueDate).getDate() || a.id.localeCompare(b.id));
  }, [projects, view, months]);

  const monthItemsMap: Map<string, LayoutItem> = useMemo(() => {
    if (view.kind !== "month") return new Map<string, LayoutItem>();
    const map = new Map<string, LayoutItem>();
    const dayRow: Record<number, number> = {};
    filteredProjectsThisMonth.forEach(p => {
      const day = isoToDate(p.dueDate).getDate();
      const row = dayRow[day] !== undefined ? dayRow[day] : 0; dayRow[day] = row + 1;
      const x = (day - 1) * dayCellW + (dayCellW - block.w) / 2;
      const y = 70 + row * 60; // tighter vertical margins
      map.set(p.id, { id: p.id, x, y, w: block.w, h: block.h, monthIdx: view.monthIdx });
    });
    return map;
  }, [view, filteredProjectsThisMonth, dayCellW, block.w, block.h]);

  // Handlers
  async function handleProjectClick(id: string) {
    if (linkActive && canEdit) {
      if (linkFrom && linkFrom !== LINK_ARMED && id !== linkFrom) {
        // Toggle link/unlink for linkFrom → id
        const s = projById.get(linkFrom)?.name || linkFrom;
        const t = projById.get(id)?.name || id;
        const existing = (dependencies || []).find(e => e.fromId === linkFrom && e.toId === id);
        if (existing) {
          try { if (existing.id) await deleteProjectDependency(existing.id); } catch {}
          _setDependencies?.(prev => (prev || []).filter(d => !(d.fromId === linkFrom && d.toId === id)));
          showToast(`Unlinked ${s} — ${t}`);
        } else {
          await createDependency(linkFrom, id);
          showToast(`Linked ${s} → ${t}`);
        }
        setSelectedId(id);
        // remain in linking mode but reset to choose a new source next
        setLinkFrom(LINK_ARMED);
        return;
      }
      if (linkFrom === LINK_ARMED) {
        // Choose the source now
        setLinkFrom(id);
        setSelectedId(id);
        return;
      }
      if (!linkFrom) {
        // Click to set the source
        setLinkFrom(id);
        setSelectedId(id);
        return;
      }
      if (linkFrom === id) {
        setSelectedId(id);
        return;
      }
    }
    // Normal highlight toggle
    setSelectedId(prev => prev === id ? null : id);
  }

  function handleProjectDoubleClick(id: string) {
    window.location.assign(`/project/${id}`);
  }

  if (error) {
    return <div className="p-6 text-danger">Failed to load timeline. {String(error)}</div>;
  }

  return (
    <div className="w-full min-h-screen flex flex-col bg-background">
      {/* Top bar (sub-header under your global navbar) */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card dark:bg-surface sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold flex items-center gap-1">
            {view.kind === 'month' ? monthNameFull(view.monthIdx) : 'Timeline'}
            <InfoPopover canEdit={canEdit} />
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {view.kind === 'month' && (
            <button className="px-3 py-1.5 rounded border text-sm border-border bg-card dark:bg-surface" onClick={() => setView({ kind: 'year' })}>Back to Year</button>
          )}
          {view.kind !== 'year' && (
            <button className="px-3 py-1.5 rounded border text-sm bg-card dark:bg-surface border-border" onClick={() => setView({ kind: 'year' })}>Year</button>
          )}
          {/* Dependencies manager (Admin) */}
          {canEdit && (
            <DependenciesManager
              projects={projects || []}
              dependencies={(dependencies || [])}
              onDeleted={(depId) => _setDependencies?.(prev => (prev || []).filter(d => (d.id && d.id === depId) ? false : (`${d.fromId}|${d.toId}` === depId) ? false : true))}
            />
          )}
          {canEdit && (
            <>
              <div className="mx-2 w-px h-6 bg-border" />
              <button
                className={linkActive ? 'px-3 py-1.5 rounded border text-sm border-border bg-[hsl(var(--accent))] text-white' : 'px-3 py-1.5 rounded border text-sm border-border bg-card dark:bg-surface'}
                onClick={() => {
                  if (linkActive) { setLinkActive(false); setLinkFrom(null); }
                  else { setLinkActive(true); setLinkFrom(LINK_ARMED); }
                }}
              >
                {linkLabel}
              </button>
            </>
          )}
        </div>
      </div>

      {/* YEAR VIEW */}
      {view.kind === "year" && (
        <div className="flex-1 flex flex-col">
          {/* Main scroll area */}
          <div ref={yearScrollRef} className="relative overflow-x-auto overflow-y-hidden flex-1">
            <div className="relative" style={{ width: yearWidth, height: layout.containerH, minHeight: '100vh' }}>
            <MonthHeader months={months} monthWidth={monthWidth} onPickMonth={(i) => setView({ kind: 'month', monthIdx: i })} />

            {/* Month vertical separators */}
            {months.map((_,i) => (
              <div key={i} className="absolute border-r border-border" style={{ left: i*monthWidth, top: 0, height: '100vh', width: 0 }} />
            ))}

            {/* Today vertical line (year view) */}
            {(() => {
              // find month and day position
              const idx = months.findIndex(m => m.year===today.getFullYear() && m.month===today.getMonth());
              if (idx === -1) return null;
              const m = months[idx];
              const dayW = monthWidth / m.days;
              const x = idx*monthWidth + (today.getDate()-1)*dayW + dayW/2;
              return <div className="absolute top-0 bottom-0" style={{ left: x, width: 0 }}>
                <div className="absolute top-0 bottom-0 border-r" style={{ borderColor: '#E11D48' }} />
              </div>;
            })()}

            {/* Project blocks */}
            {(projects || []).map(p => {
              const rect = layout.items.get(p.id); if (!rect) return null;
              return (
                <ProjectBlock
                  key={p.id}
                  p={p}
                  rect={rect}
                  selected={selectedId === p.id}
                  onClick={() => handleProjectClick(p.id)}
                  onDoubleClick={() => handleProjectDoubleClick(p.id)}
                />
              );
            })}

            {/* Dependencies layer (SVG) */}
            <EdgesLayer items={layout.items} dependencies={(dependencies || [])} highlightId={selectedId} monthWidth={monthWidth} months={months} />
            </div>
          </div>
          {/* Bottom synced scrollbar */}
          <div className="border-t border-border">
            <div
              ref={yearBottomBarRef}
              className="overflow-x-auto overflow-y-hidden h-4"
              style={{ scrollbarGutter: 'stable both-edges' as any }}
            >
              <div style={{ width: yearWidth, height: 1 }} />
            </div>
          </div>
        </div>
      )}

      {/* MONTH VIEW */}
      {view.kind === "month" && (
        <div className="relative overflow-x-auto overflow-y-hidden flex-1" ref={(el) => {
          if (!el) return;
          // Observe width changes to stretch days
          const ro = new ResizeObserver(entries => {
            for (const e of entries) {
              const w = Math.floor(e.contentRect.width);
              if (w && w !== monthHostWidth) setMonthHostWidth(w);
            }
          });
          ro.observe(el);
        }}>

          {/* Month canvas */}
    <div className="relative" style={{ width: monthViewW, height: 520 }}>
            {/* Day columns */}
            {Array.from({ length: months[view.monthIdx].days }).map((_, d) => {
              const date = new Date(months[view.monthIdx].year, months[view.monthIdx].month, d+1);
              const dow = date.getDay();
              const dowLabel = DOW[dow];
              const isMeeting = dow === 2 || dow === 4 || dow === 6; // Tue/Thu/Sat
              return (
                <React.Fragment key={d}>
      <div className={"absolute top-0 bottom-0" + (isMeeting ? " bg-accent/5" : "") } style={{ left: d*dayCellW, width: dayCellW, zIndex: 0, pointerEvents: 'none' }} />
      <div className="absolute top-0 bottom-0 border-r border-border/40" style={{ left: d*dayCellW, width: dayCellW, zIndex: 0, pointerEvents: 'none' }} />
                  <div className="absolute top-0 bottom-0" style={{ left: d*dayCellW, width: dayCellW, zIndex: 0, pointerEvents: 'none' }}>
                    <div className="sticky top-8 text-[10px] leading-tight text-center">
                      <div className="font-medium text-foreground/80">{d+1}</div>
                      <div className={"uppercase tracking-wide " + (isMeeting ? "text-accent" : "text-mutedToken-foreground")}>{dowLabel}</div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Today vertical line (month view) */}
            {(() => {
              const m = months[view.monthIdx];
              if (today.getFullYear() !== m.year || today.getMonth() !== m.month) return null;
              const x = (today.getDate()-1) * dayCellW + dayCellW/2;
              return <div className="absolute top-0 bottom-0" style={{ left: x, width: 0 }}>
                <div className="absolute top-0 bottom-0 border-r" style={{ borderColor: '#E11D48' }} />
              </div>;
            })()}

            {/* Month projects */}
            {filteredProjectsThisMonth.map((p) => {
              const rect = monthItemsMap.get(p.id);
              if (!rect) return null;
              return (
                <ProjectBlock key={p.id} p={p} rect={rect} selected={selectedId === p.id} onClick={() => handleProjectClick(p.id)} onDoubleClick={() => handleProjectDoubleClick(p.id)} />
              );
            })}

            {/* Month edges including in/out-of-month connections (partial) */}
            {(() => {
              // create ghost endpoints at left/right edges if the other endpoint is out of this month
              const ghosts = new Map(monthItemsMap);
              const m = months[view.monthIdx];
              const leftX = 0, rightX = monthViewW;
              const edgeDeps = (dependencies || []).filter(e => {
                const aIn = monthItemsMap.has(e.fromId); const bIn = monthItemsMap.has(e.toId);
                return aIn || bIn;
              });
              edgeDeps.forEach(e => {
                if (!ghosts.has(e.fromId) && monthItemsMap.has(e.toId)) {
                  // create a left ghost for source
                  const target = monthItemsMap.get(e.toId)!;
                  ghosts.set(e.fromId, { id: e.fromId, x: leftX, y: target.y, w: 0, h: target.h, monthIdx: view.monthIdx });
                }
                if (!ghosts.has(e.toId) && monthItemsMap.has(e.fromId)) {
                  // create a right ghost for target
                  const source = monthItemsMap.get(e.fromId)!;
                  ghosts.set(e.toId, { id: e.toId, x: rightX, y: source.y, w: 0, h: source.h, monthIdx: view.monthIdx });
                }
              });
              return (
                <EdgesLayer
                  items={ghosts}
                  dependencies={edgeDeps}
                  highlightId={selectedId}
                  monthWidth={monthViewW}
                  months={months.slice(view.monthIdx, view.monthIdx + 1)}
                />
              );
            })()}
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-mutedToken-foreground">Loading timeline...</div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[100] px-3 py-2 rounded shadow-lg bg-accent/90 text-white text-sm border border-accent">
          {toast}
        </div>
      )}
    </div>
  );
}

// --- Admin-only Dependencies Manager ---
function DependenciesManager({ projects, dependencies, onDeleted }:{ projects: Project[]; dependencies: Dependency[]; onDeleted: (depId: string) => void; }) {
  const [open, setOpen] = useState(false);
  const projById = useMemo(() => new Map(projects.map(p => [p.id, p] as const)), [projects]);
  const sorted = [...dependencies].map((d, i) => ({
    idx: i,
    id: d.id || `${d.fromId}|${d.toId}`,
    from: projById.get(d.fromId)?.name || d.fromId,
    to: projById.get(d.toId)?.name || d.toId,
  })).sort((a,b)=> a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return (
    <div className="relative inline-block">
      <button className="px-3 py-1.5 rounded border text-sm border-border bg-card dark:bg-surface" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup>
        Deps
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-[560px] max-h-[420px] overflow-auto rounded-md border border-border bg-card dark:bg-surface shadow-2xl z-50">
          <div className="px-3 py-2 text-xs text-mutedToken-foreground border-b border-border sticky top-0 bg-card dark:bg-surface">Dependencies</div>
          <ul className="p-3 space-y-1">
            {sorted.length === 0 && (
              <li className="text-xs text-mutedToken-foreground px-2 py-1">No dependencies yet.</li>
            )}
            {sorted.map(row => (
              <li key={row.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs px-2 py-1 rounded hover:bg-surface/70">
                <span className="truncate" title={`${row.from}`}>{row.from}</span>
                <span className="text-center w-16 shrink-0">→</span>
                <span className="truncate" title={`${row.to}`}>{row.to}</span>
                <button
                  className="ml-auto px-2 py-0.5 rounded border text-[11px] border-border bg-card dark:bg-surface hover:bg-card/70"
                  onClick={async ()=>{
                    try {
                      // Try to delete by stored id; if synthetic, find server id
                      if (row.id.includes('|')) {
                        // synthetic id: lookup server dep first
                        const server = dependencies.find(d => `${d.fromId}|${d.toId}` === row.id);
                        if (server?.id) await deleteProjectDependency(server.id);
                        onDeleted(server?.id || row.id);
                      } else {
                        await deleteProjectDependency(row.id);
                        onDeleted(row.id);
                      }
                    } catch {}
                  }}
                >Delete</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================
// Dev sanity checks (simple runtime asserts)
// =============================
if (import.meta.env.DEV) {
  try {
    const w = academicYearWindow(new Date());
    console.assert(w.months.length === 11, "Expected 11 months in academic window");
    const layoutCfg = { monthWidth: 640, rowHeight: 84, block: { w: 100, h: 48 }, headerH: 56 };
    const sample: Project[] = [
      { id: 't1', name: 'A', dueDate: new Date(2025,7,12).toISOString(), status: 'done' },
      { id: 't2', name: 'B', dueDate: new Date(2025,7,12).toISOString(), status: 'wip' },
      { id: 't3', name: 'C', dueDate: new Date(2025,7,13).toISOString(), status: 'blocked' }
    ];
    const lay = computeYearLayout(sample, w.months, layoutCfg);
    console.assert(lay.items.size === 3, "Expected 3 layout items for sample projects");
    const a = lay.items.get('t1')!; const b = lay.items.get('t2')!; const c = lay.items.get('t3')!;
    console.assert(!!a && !!b && !!c, "Items missing");
    console.assert(a.y !== b.y, "Same-day projects should stack to different rows (different y)");
    console.assert(Array.isArray(w.months.slice(0,1)) && w.months.slice(0,1).length === 1, "Month slice should return single-month array");
  } catch {}
}

// =============================
// Notes
// =============================
// • Boxes are positioned purely by dueDate; only the project name is shown.
// • Single-click: highlights its connected edges (accent). Others remain grey.
// • Edit: admins see Edit to toggle edit mode.
// • Link flow: press Link (goes to "Linking...") → click a source → click a target. Press Done to stop linking.
// • Month view: click a month name from the header to drill in; Back to Year returns to the full year.
// • Lanes keep forward/backward edges separated and ports are right-out / left-in under blocks.
