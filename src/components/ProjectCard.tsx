
import { Link } from "react-router-dom";
import ProgressBar from "./ProgressBar";
import LinkButton from "./LinkButton";
import type { Project, Task, Person } from "../types";

export default function ProjectCard({
  project,
  owners,
  tasks,
}: {
  project: Project;
  owners: Person[];
  tasks: Task[];
}) {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "Complete").length;
  const percent = total > 0 ? (done / total) * 100 : 0;
  const percentLabel = `${Math.round(percent)}%`;
  const status = total === 0 ? "none" : done === 0 ? "todo" : done === total ? "done" : "progress";
  const statusColor = status === "done" ? "bg-green-500" : status === "progress" ? "bg-yellow-400" : total === 0 ? "bg-white/30" : "bg-red-500";

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} aria-hidden />
          <Link to={`/project/${project.id}`} className="text-lg font-semibold hover:underline">
            {project.name}
          </Link>
        </div>
        <div className="flex gap-2">
          <LinkButton href={project.design_link}>Slides</LinkButton>
        </div>
      </div>
      <div className="text-sm text-uconn-muted">
        Owners: {owners.map(o => o.name).join(", ") || "—"}
      </div>
      {project.due_date && (() => {
        const dt = new Date(project.due_date);
        const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "numeric", day: "numeric", year: "numeric" });
        return <div className="text-xs text-uconn-muted">Due {fmt.format(dt)}</div>;
      })()}
      <div className="text-xs font-semibold">{percentLabel}</div>
      <ProgressBar value={percent} heightClass="h-2.5" />
      <div className="text-xs text-uconn-muted mt-0.5">
        {total > 0 ? `${done}/${total} tasks complete` : "No tasks yet"}
      </div>
    </div>
  );
}
