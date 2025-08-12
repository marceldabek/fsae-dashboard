
import { Link } from "react-router-dom";
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
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "Complete").length;
  const percent = total > 0 ? (done / total) * 100 : 0;
  const percentLabel = `${Math.round(percent)}%`;
  const status = total === 0 ? "none" : done === 0 ? "todo" : done === total ? "done" : "progress";
  const statusColor = status === "done" ? "bg-green-500" : status === "progress" ? "bg-yellow-400" : total === 0 ? "bg-white/30" : "bg-red-500";

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
        <div className="text-[10px] uppercase tracking-wide font-medium text-brand-teal/70">
          {project.subsystem}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-[11px] text-uconn-muted">
        <span className="truncate">Owners: {owners.map(o => o.name).join(", ") || "—"}</span>
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
            return <span className="whitespace-nowrap ml-2">Due {weekday} {month} {day}{suffix(day)}</span>;
          }
          return null;
        })()}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="text-[11px] font-semibold">{percentLabel}</div>
        <div className="text-[10px] text-uconn-muted">{total>0? `${done}/${total} tasks` : "No tasks"}</div>
      </div>
      <ProgressBar value={percent} heightClass={progressHeight} />
      <div className="text-[10px] text-uconn-muted mt-1">
        {total > 0 ? `${done}/${total} tasks complete` : 'No tasks yet'}
      </div>
    </div>
  );
}
