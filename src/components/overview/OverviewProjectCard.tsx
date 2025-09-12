import { Link } from "react-router-dom";
import { useRankedEnabled } from "../../hooks/useRankedEnabled";
import ProgressBar from "../ProgressBar";
import LinkButton from "../LinkButton";
import type { Project, Task, Person } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/base/avatar/avatar";

interface CardProps {
  project: Project;
  owners: Person[];
  tasks: Task[];
  compact?: boolean;
  onHover?: (attachmentId: string | null) => void;
  attachmentId?: string;
  dimmed?: boolean;
  scale?: number; // zoom scale (px/ms) normalized externally
}

export default function ProjectCard({ project, owners, tasks, compact = false, onHover, attachmentId, dimmed = false, scale }: CardProps) {
  function ptsToHours(p: number) {
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
  }

  const totalHours = Math.round(tasks.reduce((sum, t) => sum + (typeof t.ranked_points === "number" ? ptsToHours(t.ranked_points) : 2), 0));

  const [rankedEnabled] = useRankedEnabled();
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Complete").length;
  const percent = total > 0 ? (done / total) * 100 : 0;
  const percentLabel = `${Math.round(percent)}%`;
  const status = total === 0 ? "none" : done === 0 ? "todo" : done === total ? "done" : "progress";
  const statusColor =
    status === "done" ? "bg-green-500" : status === "progress" ? "bg-yellow-400" : "bg-gray-400";
  const totalPoints = tasks.reduce(
    (sum, t) => sum + (t.ranked_points ?? (t.status === "Complete" ? 35 : 10)),
    0
  );

  // Density mode selection
  let mode: 'full' | 'compact' | 'mini' | 'dot' = 'full';
  if (typeof scale === 'number') {
    if (scale < 0.5) mode = 'dot';
    else if (scale < 0.8) mode = 'mini';
    else if (scale < 1.2) mode = 'compact';
    else mode = 'full';
  } else if (compact) mode = 'compact';

  const initials = project.name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 3).join('').toUpperCase();

  const base = "border border-border bg-card dark:bg-surface shadow-sm transition-opacity";
  const container = mode === 'full' ? `rounded-2xl p-3 ${base}`
    : mode === 'compact' ? `rounded-xl p-2.5 ${base}`
    : mode === 'mini' ? `rounded-lg px-2.5 py-2 ${base}`
    : `rounded-md px-1 py-0.5 h-[14px] flex items-center ${base}`;
  const nameClass = mode === 'full' ? "text-lg font-semibold hover:underline mb-0"
    : mode === 'compact' ? "text-base font-semibold hover:underline mb-0"
    : mode === 'mini' ? "text-[11px] font-medium leading-tight"
    : "text-[10px] font-semibold tracking-wide";
  const progressHeight = mode === 'full' ? 'h-2.5' : 'h-2';

  return (
    <div
      className={container + (dimmed ? ' opacity-60 transition-opacity' : ' transition-opacity')}
      onMouseEnter={() => onHover?.(attachmentId || null)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Title + actions */}
      <div className="flex items-start justify-between gap-0">
        <div className="flex items-center min-w-0">
          <Link
            to={`/project/${project.id}`}
            className={`${nameClass} truncate`}
            title={project.name}
          >
            {mode === 'dot' ? initials.slice(0, 3) : mode === 'mini' ? project.name.slice(0, 12) + (project.name.length > 12 ? '…' : '') : project.name}
          </Link>
        </div>

  {project.design_link && mode !== 'dot' && (
          <div className="flex gap-2 shrink-0">
            {compact ? (
              <a
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-1.5 py-0 rounded bg-card dark:bg-surface text-xs border border-[#24304F] transition outline outline-2 outline-[#24304F] font-normal"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  borderColor: "#24304F",
                  color: "#FFFFFF",
                  fontWeight: "400",
                }}
              >
                Link
              </a>
            ) : (
              <LinkButton href={project.design_link}>Design Docs</LinkButton>
            )}
          </div>
        )}
      </div>

      {mode !== 'dot' && mode !== 'mini' && (
        <div className="min-h-4 h-4 flex items-center mb-2">
          {project.subsystem ? (
            <div className="text-xs uppercase tracking-caps font-normal text-muted leading-none">{project.subsystem}</div>
          ) : (
            <Skeleton className="h-3 w-16 invisible" />
          )}
        </div>
      )}

  {mode !== 'dot' && (
  <div className="flex items-center justify-between gap-2 text-tick text-muted leading-none">
        <>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide opacity-80">OWNERS</span>
              {owners.length > 0 ? (
                <div className="flex -space-x-1 h-6 items-center">
                  {owners.slice(0, 6).map((o) => {
                    const initials = o.name
                      ? o.name
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((s) => s[0]?.toUpperCase())
                          .join("")
                      : undefined;
                    return (
                      <Avatar
                        key={o.id}
                        size="xs"
                        alt={o.name}
                        src={o.avatar_url || undefined}
                        initials={!o.avatar_url ? initials : undefined}
                        className="ring-2 ring-card dark:ring-surface"
                      />
                    );
                  })}
                  {owners.length > 6 && (
                    <Avatar
                      size="xs"
                      className="ring-2 ring-card dark:ring-surface"
                      placeholder={<span className="flex items-center justify-center text-[10px] font-semibold text-quaternary">+{owners.length - 6}</span>}
                    />
                  )}
                </div>
              ) : (
                <div className="h-6 flex items-center px-1.5 rounded bg-white/10 whitespace-normal break-words">
                  <span className="text-[10px] leading-none">N/A</span>
                </div>
              )}
            </div>
          </div>
          {project.due_date && (() => {
            let date: Date | null = null;
            const s = project.due_date;
            const m = s.match(/(\d{4})[\/\-]?(\d{2})[\/\-]?(\d{2})/);
            if (m) {
              const [, y, mo, d] = m;
              date = new Date(Number(y), Number(mo) - 1, Number(d));
            } else if (!isNaN(Date.parse(s))) {
              date = new Date(s);
            }
            if (date) {
              const weekday = date.toLocaleString("en-US", { weekday: compact ? "short" : "long" });
              const month = date.toLocaleString("en-US", { month: compact ? "short" : "long" });
              const day = date.getDate();
              const suffix = (n: number) =>
                n === 1 || n === 21 || n === 31
                  ? "st"
                  : n === 2 || n === 22
                  ? "nd"
                  : n === 3 || n === 23
                  ? "rd"
                  : "th";
              return (
                <span className="text-[10px] uppercase tracking-wide opacity-80 whitespace-nowrap ml-2 shrink-0 leading-none">
                  {weekday} {month} {day}{suffix(day)}
                </span>
              );
            }
            return null;
          })()}
        </>
  </div>)}

  {mode === 'full' && (
  <div className="flex items-center justify-between gap-2 leading-none">
        <div className="text-[11px] text-muted font-normal">{percentLabel}</div>
        <div className="text-muted flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide opacity-80">
            {total > 0 ? `${done}/${total} tasks` : "No tasks"}
          </span>
          <span className="opacity-80">·</span>
          <span className="text-[10px] font-normal opacity-80">{totalHours} hours</span>
          {rankedEnabled && <span className="opacity-80">·</span>}
          {rankedEnabled && (
            <span className="text-[10px] font-normal" style={{ color: "#94a3b8" }}>
              {`Σ +${totalPoints}`}
            </span>
          )}
        </div>
  </div>)}

      {mode !== 'dot' && (
        <div className="mt-1">
          <ProgressBar value={percent} heightClass={progressHeight} color={percent === 100 ? "linear-gradient(90deg,#22c55e,#16a34a)" : undefined} />
        </div>
      )}
    </div>
  );
}
