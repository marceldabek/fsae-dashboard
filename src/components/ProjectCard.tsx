import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchRankedSettings } from "../lib/firestore";
import { useRankedEnabled } from "../hooks/useRankedEnabled";
import ProgressBar from "./ProgressBar";
import LinkButton from "./LinkButton";
import type { Project, Task, Person } from "../types";
import { Skeleton } from "@/components/ui/skeleton";

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

  const totalHours = Math.round(
    tasks.reduce(
      (sum, t) => sum + (typeof t.ranked_points === "number" ? ptsToHours(t.ranked_points) : 2),
      0
    )
  );

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

  const container = compact
    ? "rounded-xl bg-white/5 border border-white/10 p-2.5"
    : "rounded-2xl bg-white/5 border border-white/10 p-3";
  const nameClass = compact
    ? "text-base font-semibold hover:underline mb-0"
    : "text-lg font-semibold hover:underline mb-0";
  const progressHeight = compact ? "h-2" : "h-2.5";

  return (
    <div className={container}>
      {/* Title + actions */}
      <div className="flex items-start justify-between gap-0">
        <div className="flex items-center min-w-0">
          <Link
            to={`/project/${project.id}`}
            className={`${nameClass} truncate`}
            title={project.name}
          >
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
                className="inline-flex items-center px-1.5 py-0 rounded bg-white/10 text-xs border border-[#24304F] transition outline outline-2 outline-[#24304F] font-normal"
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

  {/* Subsystem slot (fixed height so cards stay equal, with margin below) */}
  <div className="min-h-4 h-4 flex items-center mb-2">
        {project.subsystem ? (
          <div className="text-xs uppercase tracking-caps font-normal text-muted leading-none">
            {project.subsystem}
          </div>
        ) : (
          // Invisible skeleton keeps the exact same height without showing anything
          <Skeleton className="h-3 w-16 invisible" />
        )}
      </div>

      {/* Row 1: Owners + Due date (dense, no bottom margin) */}
      <div className="flex items-center justify-between gap-2 text-tick text-muted leading-none">
        <>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide opacity-80">OWNERS</span>
              {owners.length > 0 ? (
                <span
                  className="px-1.5 py-0.5 rounded bg-white/10 whitespace-normal break-words text-[10px] leading-none"
                  style={{ paddingTop: "1px", paddingBottom: "1px" }}
                >
                  {owners.length}
                </span>
              ) : (
                <span
                  className="px-1.5 py-0.5 rounded bg-white/10 whitespace-normal break-words text-[10px] leading-none"
                  style={{ paddingTop: "1px", paddingBottom: "1px" }}
                >
                  N/A
                </span>
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
      </div>

      {/* Row 2: % / tasks / hours (no top margin -> sits right under row 1) */}
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
      </div>

      <div className="mt-1">
        <ProgressBar
          value={percent}
          heightClass={progressHeight}
          color={percent === 100 ? "linear-gradient(90deg,#22c55e,#16a34a)" : undefined}
        />
      </div>
    </div>
  );
}
