
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchRankedSettings } from "../lib/firestore";
import { useRankedEnabled } from "../hooks/useRankedEnabled";
import ProgressBar from "./ProgressBar";
import LinkButton from "./LinkButton";
import type { Project, Task, Person } from "../types";

export default function ProjectCard({
  project,
  owners,
  tasks,
  compact = false,
}: {
  project: Project;
  owners: Person[];
  tasks: Task[];
  compact?: boolean;
}) {
  const [rankedEnabled] = useRankedEnabled();
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "Complete").length;
  const percent = total > 0 ? (done / total) * 100 : 0;
  const percentLabel = `${Math.round(percent)}%`;
  const status = total === 0 ? "none" : done === 0 ? "todo" : done === total ? "done" : "progress";
  // Use grey for to-do/not started (including no tasks), yellow for in-progress, green for complete
  const statusColor =
    status === "done"
      ? "bg-green-500"
      : status === "progress"
      ? "bg-yellow-400"
      : "bg-gray-400";
  const totalPoints = tasks.reduce((sum, t) => sum + (t.ranked_points ?? (t.status === "Complete" ? 35 : 10)), 0);

  const container = compact ? "rounded-xl bg-white/5 border border-white/10 p-2.5 space-y-2" : "rounded-2xl bg-white/5 border border-white/10 p-3 space-y-2.5";
  const nameClass = compact ? "text-base font-semibold hover:underline" : "text-lg font-semibold hover:underline";
  const progressHeight = compact ? "h-2" : "h-2.5";

  return (
    <div className={container}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} aria-hidden />
          <Link to={`/project/${project.id}`} className={`${nameClass} truncate`} title={project.name}>
            {project.name}
          </Link>
        </div>
        {project.design_link && (
          <div className="flex gap-2 shrink-0">
            {compact ? (
              <a
                href={project.design_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center h-7 px-2 rounded bg-brand-blue/40 hover:bg-brand-blue/60 text-[11px] font-medium"
              >Docs</a>
            ) : (
              <LinkButton href={project.design_link}>Design Docs</LinkButton>
            )}
          </div>
        )}
      </div>
      {project.subsystem && (
  <div className="text-xs uppercase tracking-caps font-medium text-accent/70">
          {project.subsystem}
        </div>
      )}
      {/* Owners wrap to multiple lines to prevent horizontal overflow */}
  <div className="flex items-start justify-between gap-2 text-tick text-muted">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide opacity-80 mb-1">Owners</div>
          <div className="flex flex-wrap gap-1.5">
            {owners.length ? (
              owners.map(o => (
                <span key={o.id} className="px-1.5 py-0.5 rounded bg-white/10 whitespace-normal break-words">
                  {o.name}
                </span>
              ))
            ) : (
              <span className="opacity-60">—</span>
            )}
          </div>
        </div>
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
            const weekday = date.toLocaleString('en-US', { weekday: compact ? 'short' : 'long' });
            const month = date.toLocaleString('en-US', { month: compact ? 'short' : 'long' });
            const day = date.getDate();
            const suffix = (n: number) => n === 1 || n === 21 || n === 31 ? 'st' : n === 2 || n === 22 ? 'nd' : n === 3 || n === 23 ? 'rd' : 'th';
            return <span className="whitespace-nowrap ml-2 shrink-0">Due {weekday} {month} {day}{suffix(day)}</span>;
          }
          return null;
        })()}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="text-[11px] font-semibold">{percentLabel}</div>
  <div className="text-tick text-muted flex items-center gap-2">
          <span>{total>0? `${done}/${total} tasks` : "No tasks"}</span>
          {rankedEnabled && <span className="opacity-80">·</span>}
          {rankedEnabled && <span className="font-semibold text-[10px]">Σ +{totalPoints}</span>}
        </div>
      </div>
      <ProgressBar value={percent} heightClass={progressHeight} />
    </div>
  );
}
