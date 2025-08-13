

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchPeople, fetchProjects, fetchTasks, fetchSettings } from "../lib/firestore";
import type { Person, Project, Task, RankLevel } from "../types";
import { useRankedEnabled } from "../hooks/useRankedEnabled";

export default function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState<Person | null>(null);
  // All projects (we'll derive which to show)
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]); // tasks assigned to this person
  const [allTasks, setAllTasks] = useState<Task[]>([]); // all tasks (for leaderboard rank)
  const [settings, setSettings] = useState<{rulebook_url?: string; sharepoint_url?: string} | null>(null);
  const [rankedEnabled] = useRankedEnabled();

  useEffect(() => {
    (async () => {
  const [people, projects, allTasks, settings] = await Promise.all([
        fetchPeople(), fetchProjects(), fetchTasks(), fetchSettings()
      ]);
      const p = people.find(pp => pp.id === id) || null;
      setPerson(p);
  // Keep all projects; we'll filter for display later (include ownership OR assigned tasks)
  setProjects(projects);
  setAllTasks(allTasks);
  setTasks(allTasks.filter(t => t.assignee_id === id));
  setSettings(settings);
    })();
  }, [id]);

  if (!person) return <div className="text-sm">Loading…</div>;

  // Stats
  // Derive list of projects to display: owned OR has at least one task assigned to this person
  const displayProjects = projects.filter(pr =>
    pr.owner_ids?.includes(id!) || allTasks.some(t => t.project_id === pr.id && t.assignee_id === id)
  );
  const numProjects = displayProjects.length;
  const numTasks = tasks.length;
  const numTasksTodo = tasks.filter(t => t.status !== "Complete").length;

  // Remove old leaderboard rank on personal page per request

  function rankIcon(rank: RankLevel | undefined) {
    const base = import.meta.env.BASE_URL || '/';
    const r = (rank || "Bronze").toLowerCase();
    const ext = (r === 'bronze' || r === 'silver') ? 'png' : 'svg';
    return `${base}icons/rank-${r}.${ext}`;
  }

  // Sort rank history newest first for display
  const history = (person.rank_history || []).slice().sort((a,b)=>b.ts-a.ts);

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-6">
      {/* Profile Card */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1.5 relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xl font-semibold leading-tight truncate flex items-center gap-2">
              <span className="truncate">{person.name}</span>
            </div>
            {person.discord && (
              <div className="text-xs text-uconn-muted leading-snug truncate">@{person.discord.replace(/^@/, '')}</div>
            )}
            <div className="text-xs text-uconn-muted leading-snug">{person.year || person.role}</div>
          </div>
          {rankedEnabled && person.rank && (
            <img src={rankIcon(person.rank)} alt={person.rank} className="shrink-0 h-8 w-8 object-contain" />
          )}
        </div>
        {person.skills && person.skills.length > 0 && (
          <div className="text-sm">Skills: {person.skills.join(", ")}</div>
        )}
        <div className="flex gap-4 mt-1">
          <div className="text-center">
            <div className="text-lg font-semibold">{numProjects}</div>
            <div className="text-xs text-uconn-muted">Projects</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{numTasks}</div>
            <div className="text-xs text-uconn-muted">Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{numTasksTodo}</div>
            <div className="text-xs text-uconn-muted">To Do</div>
          </div>
        </div>
      </div>

      {/* Quick Links Card */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
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
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
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
              <li key={p.id} className="rounded-xl bg-white/10 border border-white/10 p-3">
                <div className="flex items-center justify-between">
                  <Link className="underline font-semibold" to={`/project/${p.id}`}>{p.name}</Link>
                  <div className="text-xs text-uconn-muted">{done}/{total} · {percent}%</div>
                </div>
                <div className="text-xs text-uconn-muted">
                  {p.description || "—"}
                  {p.due_date && <> · Due {due}</>}
                </div>
                {ptasksAll.length>0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {ptasksAll.map(t => <li key={t.id}>{t.description} <span className="text-uconn-muted">({t.status})</span></li>)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

  {/* Ranked History (hidden when ranked disabled) */}
  {rankedEnabled && (
  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
        <h2 className="font-semibold mb-2">Ranked History</h2>
        {history.length === 0 ? (
          <div className="text-xs text-uconn-muted">No rank changes yet.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-xs text-uconn-muted w-28">{new Date(h.ts).toLocaleDateString('en-US')}</span>
                <span className="inline-flex items-center gap-1">
                  <img src={rankIcon(h.from)} alt={h.from} className="h-4 w-4 object-contain" />
                  <span>{h.from}</span>
                </span>
                <span className="text-uconn-muted">→</span>
                <span className="inline-flex items-center gap-1">
                  <img src={rankIcon(h.to)} alt={h.to} className="h-4 w-4 object-contain" />
                  <span>{h.to}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
  )}
    </div>
  );
}
