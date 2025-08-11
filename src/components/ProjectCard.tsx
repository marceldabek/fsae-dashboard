
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

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Link to={`/project/${project.id}`} className="text-lg font-semibold hover:underline">
          {project.name}
        </Link>
        <div className="flex gap-2">
          <LinkButton href={project.design_link}>Design</LinkButton>
        </div>
      </div>
      <div className="text-sm text-uconn-muted">
        Owners: {owners.map(o => o.name).join(", ") || "—"}
      </div>
      <ProgressBar value={percent} />
      <div className="text-xs text-uconn-muted">
        {total > 0 ? `${done}/${total} tasks complete` : "No tasks yet (using project.progress fallback)"}
      </div>
    </div>
  );
}
