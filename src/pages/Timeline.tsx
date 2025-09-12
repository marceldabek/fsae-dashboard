import React, { useEffect, useMemo, useRef, useState } from "react";
import '@/components/EdgesLayer.css';
import { routeEdge, EdgeLaneAllocator, Rect as EdgeRect } from '@/lib/routeEdge';
import { useTimeZoom } from '@/hooks/useTimeZoom';
import { useLayoutCache } from '../hooks/useLayoutCache';
// Legend moved to floating tooltip trigger beside timeline (see implementation below)
import { listenAuth, isCurrentUserAdmin } from "../auth";
import { fetchProjects, fetchTasks, fetchProjectDependencies, addProjectDependency, deleteProjectDependency, updateProject, deleteProject } from "../lib/firestore";
import type { Project as AppProject, Task, ProjectDependency } from "../types";
import { useRoles } from "../lib/roles";
import { Info } from "lucide-react";
import ProjectBlock from '@/components/timeline/ProjectBlock';
import { Edit03, Link02, Trash03 } from '@untitledui/icons';
import ProjectCreateModal from "../components/ProjectCreateModal";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import type { Person } from "../types";
import { useDiscordMembers } from '@/hooks/useDiscordMembers';
import { discordMembersToPersons } from '@/utils/discordMapping';

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
  const startYear = base.getMonth() >= 7 ? y : y - 1; // academic year always starts Aug
  const start = new Date(startYear, 7, 1);
  const months: { idx: number; year: number; month: number; name: string; start: Date; days: number; }[] = [];
  // Build Aug..Dec of startYear then Jan..Jun of next year
  for (let m = 7; m <= 11; m++) {
    const s = new Date(startYear, m, 1);
    months.push({ idx: months.length, year: s.getFullYear(), month: s.getMonth(), name: MONTH_NAMES[m].toUpperCase().slice(0,3), start: s, days: daysInMonth(s.getFullYear(), s.getMonth()) });
  }
  for (let m = 0; m <= 5; m++) {
    const s = new Date(startYear + 1, m, 1);
    months.push({ idx: months.length, year: s.getFullYear(), month: s.getMonth(), name: MONTH_NAMES[m].toUpperCase().slice(0,3), start: s, days: daysInMonth(s.getFullYear(), s.getMonth()) });
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
  const [people, setPeople] = useState<Person[] | null>(null);
  const { members } = useDiscordMembers();

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
  // derive people from discord members
  setPeople(discordMembersToPersons(members));
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
  }, [members]);

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

  async function refreshAll() {
    try {
      setLoading(true);
  const [projs, tasks, deps] = await Promise.all([
        fetchProjects(),
        fetchTasks(),
        fetchProjectDependencies(),
      ]);
  setPeople(discordMembersToPersons(members));
      const tasksByProject = new Map<string, Task[]>();
      for (const t of tasks) {
        const arr = tasksByProject.get(t.project_id) || [];
        arr.push(t); tasksByProject.set(t.project_id, arr);
      }
      const edgesRaw: Dependency[] = deps
        .filter(d => !!d.from_id && !!d.to_id)
        .map((d: ProjectDependency) => ({ id: d.id, fromId: d.from_id, toId: d.to_id }));
      const seen = new Set<string>();
      const edges: Dependency[] = [];
      for (const e of edgesRaw) { const key = `${e.fromId}|${e.toId}`; if (seen.has(key)) continue; seen.add(key); edges.push(e); }
      const incoming = new Map<string, string[]>();
      edges.forEach(e => { if (!incoming.has(e.toId)) incoming.set(e.toId, []); incoming.get(e.toId)!.push(e.fromId); });
      const doneSet = new Set<string>();
      for (const p of projs) { if ((p as any).archived) continue; if (areAllTasksDone(tasksByProject.get(p.id))) doneSet.add(p.id); }
      const mapped: Project[] = projs
        .filter(p => !(p as any).archived)
        .map((p: AppProject) => {
          const iso = toIso(p.due_date); if (!iso) return null;
          const isDone = doneSet.has(p.id);
          let status: ProjectStatus;
          if (isDone) status = "done"; else { const inc = incoming.get(p.id) || []; const blockedBy = inc.some(fid => !doneSet.has(fid)); status = blockedBy ? "blocked" : "wip"; }
          return { id: p.id, name: p.name, dueDate: iso, status } as Project;
        })
        .filter(Boolean) as Project[];
      setProjects(mapped);
      setDependencies(edges);
    } finally {
      setLoading(false);
    }
  }

  return { projects, setProjects, dependencies, setDependencies, loading, error, createDependency, people, refreshAll };
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
// Renamed to avoid collision with new attachments-based EdgesLayer component
function DueDateEdgesLayer({ items, dependencies, highlightId, monthWidth, months }:{ items: Map<string,LayoutItem>; dependencies: Dependency[]; highlightId?: string | null; monthWidth: number; months: ReturnType<typeof academicYearWindow>["months"]; }){
  const width = monthWidth * months.length;
  let maxBottom = 0; items.forEach(r => { maxBottom = Math.max(maxBottom, r.y + r.h); });
  const allocator = useMemo(() => new EdgeLaneAllocator(12), [items]);
  // Build boxes array once per render
  const boxes: EdgeRect[] = useMemo(() => Array.from(items.values()).map(r => ({ x:r.x, y:r.y, w:r.w, h:r.h })), [items]);

  // Path cache ref keyed by dependency id -> last key + path
  const pathCacheRef = useRef<Map<string,{ key:string; d:string }>>(new Map());

  const depsForPaths = dependencies.filter(e => items.has(e.fromId) && items.has(e.toId));
  // Include highlightId in key so active styling applies immediately without waiting for scroll / relayout
  const compositeKey = depsForPaths.map(e => {
    const a = items.get(e.fromId)!; const b = items.get(e.toId)!;
    return `${e.id}:${a.x},${a.y},${a.w},${a.h}|${b.x},${b.y},${b.w},${b.h}`;
  }).join(";") + `|hi:${highlightId||''}`;

  const paths = useLayoutCache(compositeKey, () => {
    const out: { id:string; d:string; active:boolean; back:boolean }[] = [];
    // Build fast lookup for immediate edges of highlighted node
    const immediate = new Set<string>();
    if (highlightId) {
      for (const e of depsForPaths) {
        if (e.fromId === highlightId || e.toId === highlightId) immediate.add(e.id || `${e.fromId}->${e.toId}`);
      }
    }
    for (const e of depsForPaths) {
      const depId = e.id || `${e.fromId}->${e.toId}`;
      const a = items.get(e.fromId)!; const b = items.get(e.toId)!;
      const key = `${e.fromId}->${e.toId}|${a.x},${a.y},${a.w},${a.h}|${b.x},${b.y},${b.w},${b.h}`;
      const cached = pathCacheRef.current.get(depId);
      let d: string;
      if (cached && cached.key === key) {
        d = cached.d;
      } else {
        d = routeEdge(a, b, {
          padding: 8,
          boxes,
          reserveShelfY: (yMin,yMax,x1,x2) => allocator.reserve(yMin,yMax,x1,x2),
        });
        pathCacheRef.current.set(depId, { key, d });
      }
  // Only highlight immediate (one-hop) edges of the selected project
  const active = !!highlightId && immediate.has(depId);
      const back = (a.x + a.w) > b.x; // back edge
      out.push({ id: depId, d, active, back });
    }
    return out;
  });

  const svgH = maxBottom + 220; // extra space for shelves
  return (
    <svg width={width} height={svgH} className="absolute left-0 top-0 pointer-events-none z-0">
  {paths.map((p: { id:string; d:string; active:boolean; back:boolean }) => {
  const cls = `edge ${p.active ? 'edge--focus edge--active-blue' : ''} ${p.back ? 'edge--back' : ''}`;
  return <path key={p.id} d={p.d} className={cls} strokeOpacity={p.active?1:0.18} />;
      })}
    </svg>
  );
}

// =============================
// Presentational pieces
// =============================
// Adaptive header with variable tick density (quarters -> months -> weeks -> days)
function AdaptiveTimeHeader({ months, zoom, timeWindow }: { months: ReturnType<typeof academicYearWindow>["months"]; zoom: ReturnType<typeof useTimeZoom>; timeWindow: { start:number; end:number }; }) {
  const pxPerDay = zoom.scale * 864e5;
  const showDays = pxPerDay >= 30;
  const showWeeks = !showDays && pxPerDay >= 8;
  const showMonths = !showWeeks && !showDays;
  const ticks: { x:number; label:string; key:string; className?:string }[] = [];
  if (showMonths) {
    months.forEach(m => {
      const start = new Date(m.year, m.month, 1).getTime();
      const next = new Date(m.year, m.month+1, 1).getTime();
      const mid = start + (next-start)/2;
      ticks.push({ x: zoom.toX(mid), label: MONTH_NAMES[m.month].slice(0,3).toUpperCase(), key:`mo-${m.idx}`, className:'text-[11px] font-semibold' });
    });
  } else if (showWeeks) {
    const startD = new Date(timeWindow.start); startD.setHours(0,0,0,0);
    const day = startD.getDay(); const diff = (day + 6) % 7; startD.setDate(startD.getDate() - diff);
    for (let t = startD.getTime(); t < timeWindow.end; t += 7*864e5) {
      const dt = new Date(t);
      const label = `${dt.getMonth()+1}/${dt.getDate()}`;
      ticks.push({ x: zoom.toX(t), label, key:`wk-${label}`, className:'text-[10px]' });
    }
  } else if (showDays) {
    // Iterate calendar days defensively (avoids DST or arithmetic drift) and ensure unique keys.
    const daySet = new Set<string>();
    const dt = new Date(timeWindow.start);
    dt.setHours(0,0,0,0);
    while (dt.getTime() <= timeWindow.end) {
      const stamp = dt.getTime();
      const iso = dt.toISOString().slice(0,10); // YYYY-MM-DD
      if (!daySet.has(iso)) {
        daySet.add(iso);
        ticks.push({
          x: zoom.toX(stamp),
          label: String(dt.getDate()),
          key: `d-${iso}`,
          className: 'text-[10px]'
        });
      }
      dt.setDate(dt.getDate()+1);
    }
  }
  let currentMonthLabel: string | null = null;
  if (showDays) {
    const centerT = zoom.toT(window.innerWidth/2);
    const d = new Date(centerT);
    currentMonthLabel = `${MONTH_NAMES[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
  }
  return (
    <div className="sticky top-0 z-10 bg-card/80 dark:bg-surface/80 backdrop-blur border-b border-border h-10 select-none flex items-center">
      <div className="relative w-full h-full">
        {ticks.map(t => (
          <div key={t.key} className={`absolute top-1/2 -translate-y-1/2 px-1 text-mutedToken-foreground ${t.className||''}`} style={{ left: t.x, transform:'translate(-50%, -50%)' }}>
            {t.label}
          </div>
        ))}
        {currentMonthLabel && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-foreground/80 pointer-events-none">{currentMonthLabel}</div>
        )}
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

// ProjectBlock extracted to components/timeline/ProjectBlock.tsx

// =============================
// Main Page Component
// =============================

const LINK_ARMED = "__ARMED__"; // sentinel meaning: user clicked "Link" and is choosing a source

export default function TimelinePageBlue() {
  const { role } = useRoles();
  const canEdit = role === 'admin' || role === 'lead';
  const { projects, setProjects, dependencies, setDependencies: _setDependencies, loading, error, createDependency, people, refreshAll } = useProjects();
  const [toast, setToast] = useState<string>("");
  const showToast = (msg: string) => { setToast(msg); window.setTimeout(()=>setToast(""), 2500); };
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [initialCreateDate, setInitialCreateDate] = useState<Date | null>(null);

  // Unified view (month drill removed)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [linkActive, setLinkActive] = useState<boolean>(false);
  const linkLabel = linkActive ? "Linking..." : "Link";

  // Layout constants (baseline before zoom; we will derive from time span)
  const monthWidth = 640; // base reference width per month prior to zoom rewrite
  const rowHeight = 74; // reduced spacing between rows
  const block = { w: 96, h: 56 }; // slightly taller boxes (reduced base width)
  const headerH = 56; // space under month header before rows start

  const { months, layout } = useYearLayout(projects, { monthWidth, rowHeight, block, headerH });
  // Academic year hard range (Aug -> Jul 1) to prevent panning past June
  const academicStart = useMemo(() => months[0].start.getTime(), [months]);
  const academicEnd = useMemo(() => new Date(months[months.length-1].year, months[months.length-1].month+1, 1).getTime(), [months]);
  const timeWindow = useMemo(() => ({ start: academicStart, end: academicEnd }), [academicStart, academicEnd]);
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  // Focus roughly one month ahead of today by default
  const todayT = Date.now();
  const monthAheadCenter = todayT + 15*864e5; // midpoint of next ~30 day span
  const zoom = useTimeZoom({
    viewportWidth,
    timeWindow,
    initialScale: 1/(864e5), // fallback if initialSpanDays not applied
    minScale: 1/(30*864e5),
    maxScale: 8/(3600e3),
    wheelZoomNoCtrl: true,
    initialSpanDays: 32,
    initialCenterTime: monthAheadCenter,
  });
  const yearWidth = (timeWindow.end - timeWindow.start) * zoom.scale; // dynamic canvas width
  const monthNameFull = (idx: number) => `${MONTH_NAMES[months[idx].month]} ${months[idx].year}`;
  const projById = useMemo(() => new Map((projects||[]).map(p => [p.id, p] as const)), [projects]);
  const today = new Date();
  // --- View badge derived from zoom scale (px per ms -> per hour) ---
  const pxPerHour = zoom.scale * 3600e3;
  const viewBadge = pxPerHour >= 6 ? 'Day' : pxPerHour >= 0.25 ? 'Week' : pxPerHour >= 0.02 ? 'Month' : 'Year';
  const [badge, setBadge] = useState(viewBadge);
  useEffect(()=>{ setBadge(viewBadge); }, [viewBadge]);
  const isSameYMD = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

  // Background context menu state (right-click anywhere to create project on that date)
  const [rcDate, setRcDate] = useState<Date | null>(null);

  // Year view: primary scroller + synced bottom scrollbar
  const yearScrollRef = useRef<HTMLDivElement | null>(null);
  const yearBottomBarRef = useRef<HTMLDivElement | null>(null); // now overflow hidden; used for coordinate mapping
  const isSyncing = useRef(false);
  // Holds dynamically placed (collision-resolved) item rectangles for edge routing at current zoom
  const currentPlacedItemsRef = useRef<{ map: Map<string, LayoutItem>; farOut: boolean; shrink: boolean } | null>(null);
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
  }, [yearWidth]);

  // Removed legacy month view state & layout

  // Handlers
  async function handleProjectClick(id: string) {
    if (linkActive && canEdit) {
      if (linkFrom && linkFrom !== LINK_ARMED && id !== linkFrom) {
        // Always link from earlier due date to later due date (forward-only)
        const a = projById.get(linkFrom);
        const b = projById.get(id);
        if (!a || !b) { setLinkFrom(LINK_ARMED); return; }
        const ad = isoToDate(a.dueDate);
        const bd = isoToDate(b.dueDate);
        const aYMD = `${ad.getFullYear()}-${String(ad.getMonth()+1).padStart(2,'0')}-${String(ad.getDate()).padStart(2,'0')}`;
        const bYMD = `${bd.getFullYear()}-${String(bd.getMonth()+1).padStart(2,'0')}-${String(bd.getDate()).padStart(2,'0')}`;
        if (aYMD === bYMD) {
          showToast('Links must move forward (different dates).');
          setLinkFrom(LINK_ARMED); setSelectedId(id); return;
        }
        const earlier = ad < bd ? a : b;
        const later = ad < bd ? b : a;
        const fromId = earlier.id;
        const toId = later.id;
        const sName = earlier.name; const tName = later.name;
        const deps = (dependencies || []);
        const forward = deps.find(e => e.fromId === fromId && e.toId === toId);
        const reverse = deps.find(e => e.fromId === toId && e.toId === fromId);
        if (forward) {
          // Toggle off existing forward link
          try { if (forward.id) await deleteProjectDependency(forward.id); } catch {}
          _setDependencies?.(prev => (prev || []).filter(d => !(d.fromId === fromId && d.toId === toId)));
          showToast(`Unlinked ${sName} — ${tName}`);
        } else {
          // If reverse exists, convert it: delete reverse, then create forward
          if (reverse) {
            try { if (reverse.id) await deleteProjectDependency(reverse.id); } catch {}
            _setDependencies?.(prev => (prev || []).filter(d => !(d.fromId === toId && d.toId === fromId)));
          }
          await createDependency(fromId, toId);
          showToast(`Linked ${sName} → ${tName}`);
          // Auto-disable linking mode after one successful link creation
          setLinkActive(false);
          setLinkFrom(null);
          setSelectedId(id);
          return;
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

  // ==== Long-press drag-to-adjust due date ====
  const holdTimer = useRef<number | null>(null);
  const longPressActive = useRef<boolean>(false);
  const dragState = useRef<{ id: string; startClientX: number; startIso: string } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; iso: string } | null>(null);
  const justDragged = useRef<boolean>(false);
  const timelineDragLock = useRef<boolean>(false);

  function clearHoldTimer() {
    if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
  }

  function ymd(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }

  function mapClientXToDate(clientX: number): Date {
    // Map depending on view
  const scroller = yearScrollRef.current;
  if (!scroller) return new Date(isoToDate(dragState.current!.startIso)); // no native scroll; translate handled by zoom
  const rect = scroller.getBoundingClientRect();
  const viewportX = clientX - rect.left; // no native scroll; translate handled by zoom
  const t = zoom.toT(viewportX);
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function onBlockMouseDown(e: React.MouseEvent<HTMLDivElement>, id: string) {
    if (!canEdit) return;
    if (linkActive) return; // don't conflict with linking mode
  // Don't let the pointer event arm timeline panning
  e.stopPropagation();
    clearHoldTimer();
    const p = projById.get(id);
    if (!p) return;
    const startIso = p.dueDate;
    longPressActive.current = false;
    dragState.current = { id, startClientX: e.clientX, startIso };
    holdTimer.current = window.setTimeout(() => {
      longPressActive.current = true;
      setDragPreview({ id, iso: startIso });
  timelineDragLock.current = true; // lock timeline panning while dragging a block
      // add listeners
      window.addEventListener('mousemove', onGlobalMouseMove);
      window.addEventListener('mouseup', onGlobalMouseUp, { once: true });
      // prevent text selection while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
    }, 350);
  }

  function onBlockMouseUpOrLeave() {
    // If long-press hasn't activated yet, cancel the timer
    if (!longPressActive.current) {
      clearHoldTimer();
      dragState.current = null;
    }
  }

  function onGlobalMouseMove(e: MouseEvent) {
    if (!longPressActive.current || !dragState.current) return;
    const d = mapClientXToDate(e.clientX);
    const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
    setDragPreview(prev => prev && prev.id === dragState.current!.id ? { id: prev.id, iso } : { id: dragState.current!.id, iso });
  }

  async function onGlobalMouseUp(e: MouseEvent) {
    clearHoldTimer();
    const wasDragging = longPressActive.current && !!dragState.current;
    longPressActive.current = false;
  timelineDragLock.current = false; // release timeline pan lock
    const state = dragState.current; dragState.current = null;
    // restore selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', onGlobalMouseMove);
    if (!state) { setDragPreview(null); return; }
    if (!wasDragging) { setDragPreview(null); return; }
    justDragged.current = true; window.setTimeout(()=>{ justDragged.current = false; }, 250);
    const p = projById.get(state.id);
    setDragPreview(null);
    if (!p) return;
    const newDate = mapClientXToDate(e.clientX);
    const oldYmd = ymd(isoToDate(p.dueDate));
    const newY = ymd(newDate);
    if (newY === oldYmd) return; // no change
    // Persist to Firestore as YYYY-MM-DD
    try {
      await updateProject(state.id, { due_date: newY } as any);
      // optimistic update in UI
      setProjects?.(prev => {
        if (!prev) return prev;
        return prev.map(pr => pr.id === state.id ? { ...pr, dueDate: new Date(Date.UTC(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())).toISOString() } : pr);
      });
      showToast(`Due date moved to ${newY}`);
      // Trigger a refresh to recompute layout and statuses
      setTimeout(() => { refreshAll().catch(()=>{}); }, 50);
    } catch {
      showToast('Failed to update due date');
    }
  }

  if (error) {
    return <div className="p-6 text-danger">Failed to load timeline. {String(error)}</div>;
  }

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col bg-background relative">
      {/* Top bar (sub-header under your global navbar) */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card dark:bg-surface sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            Timeline
            <InfoPopover canEdit={canEdit} />
          </h1>
          <span key={badge} className="inline-block rounded bg-foreground/10 dark:bg-white/10 px-2 py-1 text-[11px] font-medium text-foreground/70 dark:text-white/70" aria-label="Current zoom granularity">{badge}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* month drill removed */}
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
                className="px-3 py-1.5 rounded border text-sm border-accent/40 bg-accent/15 text-accent hover:bg-accent/25"
                onClick={() => setShowCreateProject(true)}
                aria-label="Create project"
                title="Create project"
              >
                + Project
              </button>
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

  <div className="flex-1 flex flex-col">
          {/* Main scroll area */}
          <div
            ref={yearScrollRef}
            className="relative overflow-hidden flex-1"
              onWheel={(e)=>{ if (!timelineDragLock.current) zoom.onWheel(e.nativeEvent); }}
              onPointerDown={(e)=>{ if (!timelineDragLock.current) zoom.onPointerDown(e.nativeEvent); }}
              onPointerMove={(e)=>{ if (!timelineDragLock.current) zoom.onPointerMove(e.nativeEvent); }}
              onPointerUp={(e)=>{ if (!timelineDragLock.current) zoom.onPointerUp(e.nativeEvent); }}
            onTouchStart={(e)=>{ if (e.touches.length===2) zoom.onTouchPinchStart(e.nativeEvent); }}
            onTouchMove={(e)=>{ if (e.touches.length===2) zoom.onTouchPinchMove(e.nativeEvent); }}
            onTouchEnd={(e)=>{ if (e.touches.length<2) zoom.onTouchPinchEnd(e.nativeEvent); }}
          >
            <ContextMenu onOpenChange={(open)=>{ if (!open) setRcDate(null); }}>
              <ContextMenuTrigger asChild>
                <div
                  className="relative"
                  style={{ width: yearWidth, height: layout.containerH, minHeight: '100vh' }}
                  onContextMenu={(e)=>{
                    // Capture date under cursor for background menu
                    try {
                      const scroller = yearScrollRef.current;
                      if (!scroller) return;
                      const rect = scroller.getBoundingClientRect();
                      const viewportX = e.clientX - rect.left;
                      const t = zoom.toT(viewportX);
                      const d = new Date(t);
                      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                      setRcDate(day);
                    } catch {}
                  }}
                >
            <AdaptiveTimeHeader months={months} zoom={zoom} timeWindow={timeWindow} />

            {/* Month boundaries */}
            {months.map((m,i) => {
              const startT = new Date(m.year, m.month, 1).getTime();
              const x = zoom.toX(startT);
              return <div key={i} className="absolute top-0 bottom-0 border-r border-border/40" style={{ left: x, width: 0 }} />;
            })}

            {/* Right-end hard wall (end of June) */}
            {(() => {
              const endJune = months[months.length-1];
              const wallT = new Date(endJune.year, endJune.month+1, 1).getTime(); // July 1
              const x = zoom.toX(wallT);
              return <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: x, width:0 }}>
                <div className="absolute top-0 bottom-0 w-[3px] bg-gradient-to-b from-red-500/70 via-red-500 to-red-500/70 rounded-sm" />
              </div>;
            })()}

            {/* Today vertical line (follows pan/zoom) */}
            {(() => {
              const t = today.getTime();
              const x = zoom.toX(t);
              if (x < -50 || x > yearWidth + 50) return null; // offscreen
              return <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: x, width: 0 }}>
                <div className="absolute top-0 bottom-0 border-r" style={{ borderColor: '#E11D48' }} />
              </div>;
            })()}

            {(() => {
              const pxPerDay = zoom.scale * 864e5;
              // Derive visible day span (how many days fit in viewport) to decide shrink mode.
              const visibleDays = viewportWidth / pxPerDay; // bigger span => smaller pxPerDay
              // Enter shrink mode once roughly >= ~60 days (about 2 months) are visible.
              const shrink = visibleDays >= 60; // primary trigger (shows ~2-3 months)
              // Far-out tiny mode when >= ~120 days (semester wide) are in view.
              const farOut = visibleDays >= 120;
              const firstItemY = (() => { try { const it = layout.items.values().next(); return it && it.value ? it.value.y : headerH; } catch { return headerH; } })();

              const placed: { id:string; x:number; y:number; w:number; h:number }[] = [];
              // Unified vertical gap (10px) across ALL zoom levels (near, shrink, far) including same-date stacks
              const gap = 10;
              const entries: { id:string; xStart:number; w:number; h:number; baseY:number; due:Date }[] = [];
              (projects || []).forEach(p => {
                const baseRect = layout.items.get(p.id); if (!baseRect) return;
                const due = isoToDate(dragPreview?.id === p.id ? dragPreview.iso : p.dueDate);
                const xCenter = zoom.toX(due.getTime());
                let dynW: number; if (pxPerDay < 0.5) dynW = 16; else if (pxPerDay < 0.8) dynW = 24; else if (pxPerDay < 1.2) dynW = 36; else if (pxPerDay < 2.5) dynW = 48; else if (pxPerDay < 5) dynW = 60; else if (pxPerDay < 10) dynW = 76; else dynW = 96;
                const h = farOut ? 14 : shrink ? 32 : baseRect.h;
                const baseY = shrink ? firstItemY + 4 : baseRect.y;
                entries.push({ id: p.id, xStart: xCenter - dynW/2, w: dynW, h, baseY, due });
              });
              entries.sort((a,b)=> a.xStart - b.xStart || a.id.localeCompare(b.id));
              if (shrink) {
                // Use same collision stacking logic as non-shrink, but anchoring all blocks to the same baseY for uniform columns.
                const verticalGap = gap;
                entries.forEach(e => {
                  let y = firstItemY + 4; // unified starting line
                  while (true) {
                    const collisions = placed.filter(r => {
                      const horiz = !(e.xStart + e.w <= r.x || r.x + r.w <= e.xStart);
                      if (!horiz) return false;
                      const vertOverlap = !(y + e.h <= r.y || r.y + r.h <= y);
                      return vertOverlap;
                    });
                    if (collisions.length === 0) break;
                    const maxBottom = Math.max(...collisions.map(r => r.y + r.h));
                    y = maxBottom + verticalGap;
                  }
                  placed.push({ id: e.id, x: e.xStart, y, w: e.w, h: e.h });
                });
              } else {
                // Non-shrink: deterministic vertical stacking for overlapping wide blocks.
                const verticalGap = gap; // match fully zoomed-out spacing
                entries.forEach(e => {
                  let y = e.baseY;
                  // Reposition until no vertical overlap with any horizontally-overlapping prior block.
                  // Instead of incremental +2 nudges, jump to just below the lowest colliding block for stability.
                  while (true) {
                    const collisions = placed.filter(r => {
                      const horiz = !(e.xStart + e.w <= r.x || r.x + r.w <= e.xStart);
                      if (!horiz) return false;
                      const vertOverlap = !(y + e.h <= r.y || r.y + r.h <= y);
                      return vertOverlap;
                    });
                    if (collisions.length === 0) break;
                    const maxBottom = Math.max(...collisions.map(r => r.y + r.h));
                    y = maxBottom + verticalGap;
                  }
                  placed.push({ id: e.id, x: e.xStart, y, w: e.w, h: e.h });
                });
              }

              // Build map for edges with updated positions
              const placedMap = new Map<string, LayoutItem>();
              placed.forEach(r => placedMap.set(r.id, { id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, monthIdx: 0 } as any));
              currentPlacedItemsRef.current = { map: placedMap, farOut, shrink }; // store in ref for edge layer below

              const scaleForBlock = Math.min(2, Math.max(0, pxPerHour / 0.25));
              return placed.map(r => {
                const p = projById.get(r.id)!;
                const due = isoToDate(dragPreview?.id === p.id ? dragPreview.iso : p.dueDate);
                return (
                  <ContextMenu key={p.id}>
                    <ContextMenuTrigger asChild>
                      <div>
                        <ProjectBlock
                          name={p.name}
                          dueDate={due}
                          color={STATUS_COLOR[p.status]}
                          rect={{ x: r.x, y: r.y, w: r.w, h: r.h }}
                          selected={selectedId === p.id}
                          milestone={p.milestone}
                          elevate={selectedId === p.id || dragPreview?.id === p.id}
                          hideDate={shrink}
                          onClick={() => { if (justDragged.current) return; handleProjectClick(p.id); }}
                          onDoubleClick={() => handleProjectDoubleClick(p.id)}
                          onMouseDown={(e)=>onBlockMouseDown(e, p.id)}
                          onMouseUp={onBlockMouseUpOrLeave}
                          onMouseLeave={onBlockMouseUpOrLeave}
                          scale={scaleForBlock}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-52 bg-card dark:bg-surface border border-border/60 shadow-xl">
                      <ContextMenuItem onClick={() => { setShowCreateProject(true); setSelectedId(p.id); }}>
                        <Edit03 className="w-4 h-4 mr-2 opacity-80" /> Edit…
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => { const url = (projById.get(p.id) as any)?.design_url; if (url) window.open(url, '_blank'); }} disabled={!(projById.get(p.id) as any)?.design_url}>
                        <Link02 className="w-4 h-4 mr-2 opacity-80" /> Open Design Link
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem className="text-danger focus:text-danger hover:text-danger" onClick={async () => { if (confirm('Delete project?')) { try { await deleteProject(p.id); refreshAll(); showToast('Deleted'); } catch { showToast('Delete failed'); } } }}>
                        <Trash03 className="w-4 h-4 mr-2" /> Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              });
            })()}

            {(() => {
              const map = currentPlacedItemsRef.current?.map;
              if (!map) return null;
              return <DueDateEdgesLayer items={map} dependencies={(dependencies || [])} highlightId={selectedId} monthWidth={monthWidth} months={months} />;
            })()}
            {/* Aggregated month counts at far zoom */}
            {(() => {
              const pxPerDay = zoom.scale * 864e5;
              if (pxPerDay >= 0.7) return null; // only show when very zoomed out
              const counts = months.map(m => {
                const startT = new Date(m.year, m.month, 1).getTime();
                const endT = new Date(m.year, m.month+1, 1).getTime();
                const count = (projects||[]).filter(p => {
                  const t = isoToDate(p.dueDate).getTime();
                  return t >= startT && t < endT;
                }).length;
                return { m, count, x: zoom.toX(startT + (endT-startT)/2) };
              });
              return counts.filter(c => c.count>0).map(c => (
                <div key={c.m.idx} className="absolute -top-2 text-[10px] font-semibold text-mutedToken-foreground pointer-events-none" style={{ left: c.x, transform:'translateX(-50%)' }}>
                  {c.count}
                </div>
              ));
            })()}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56 bg-card dark:bg-surface border border-border/60 shadow-xl">
                <ContextMenuItem
                  onClick={() => {
                    setInitialCreateDate(rcDate || null);
                    setShowCreateProject(true);
                  }}
                >
                  + Create project{rcDate ? ` on ${rcDate.getMonth()+1}/${rcDate.getDate()}` : ''}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-mutedToken-foreground pointer-events-none">Loading timeline...</div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[100] px-3 py-2 rounded shadow-lg bg-accent/90 text-white text-sm border border-accent">
          {toast}
        </div>
      )}

      {/* Create Project Modal */}
      <ProjectCreateModal
        open={!!showCreateProject && !!people}
        onClose={() => { setShowCreateProject(false); setInitialCreateDate(null); }}
        people={people || []}
        projectToEdit={selectedId ? (projById.get(selectedId) as any) : null}
        initialDate={selectedId ? null : initialCreateDate}
        onCreated={async () => { await refreshAll(); showToast("Project saved"); }}
      />
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
        <li key={row.id} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-xs px-2 py-1 rounded hover:bg-surface/70">
                <span className="truncate" title={`${row.from}`}>{row.from}</span>
                <span className="text-center w-16 shrink-0">→</span>
                <span className="truncate" title={`${row.to}`}>{row.to}</span>
                <button
          className="px-2 py-0.5 rounded border text-[11px] border-border bg-card dark:bg-surface hover:bg-card/70 justify-self-end"
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
// Notes
// =============================
// • Boxes are positioned purely by dueDate; only the project name is shown.
// • Single-click: highlights its connected edges (accent). Others remain grey.
// • Edit: admins see Edit to toggle edit mode.
// • Link flow: press Link (goes to "Linking...") → click a source → click a target. Press Done to stop linking.
// • Month view: click a month name from the header to drill in; Back to Year returns to the full year.
// • Lanes keep forward/backward edges separated and ports are right-out / left-in under blocks.
