import { useState } from "react";
import PersonSelectPopover from "./PersonSelectPopover";
import type { Person, Project } from "../types";
import { addTask } from "../lib/firestore";

interface TaskCreateCardProps {
  people: Person[];
  projects?: Project[]; // required if fixedProjectId not provided
  fixedProjectId?: string; // if provided, hides project selector
  onCreated?: () => void; // callback after successful creation
  className?: string;
  hideTitle?: boolean; // suppress internal heading (e.g., when parent provides one)
  unstyled?: boolean; // render without outer card wrapper
}

export default function TaskCreateCard({ people, projects = [], fixedProjectId, onCreated, className = "", hideTitle = false, unstyled = false }: TaskCreateCardProps) {
  const [projectId, setProjectId] = useState<string>(fixedProjectId || "");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<"Todo" | "In Progress" | "Complete">("In Progress");
  const [assignee, setAssignee] = useState<string>("");
  const [points, setPoints] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    if (!desc.trim()) return;
    const pid = fixedProjectId || projectId;
    if (!pid) return;
    setSaving(true);
    try {
      await addTask({ project_id: pid, description: desc.trim(), status, assignee_id: assignee || undefined, ranked_points: (points || undefined) as any });
      setDesc("");
      setStatus("In Progress");
      setAssignee("");
      setPoints("");
      if (!fixedProjectId) setProjectId("");
      onCreated?.();
    } finally {
      setSaving(false);
    }
  }

  const disable = !desc.trim() || saving || !(fixedProjectId || projectId);

  const content = (
    <div className="space-y-3 text-white">
      {!hideTitle && <h3 className="text-sm font-semibold">Add Task</h3>}
      {!fixedProjectId && (
        <select
            className="px-3 h-10 rounded text-sm w-full dark-select form-control"
          value={projectId}
          onChange={e=>setProjectId(e.target.value)}
        >
          <option value="">Select project…</option>
          {projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <input
    className="px-3 h-10 rounded text-sm w-full bg-surface/60 border border-border focus:outline-none form-control"
        placeholder="Description"
        value={desc}
        onChange={e => setDesc(e.target.value)}
      />
      <div className="flex gap-2">
        <select
            className="px-3 h-10 rounded text-sm dark-select flex-1 min-w-0 form-control"
          value={status}
          onChange={e => setStatus(e.target.value as any)}
        >
          <option>Todo</option>
          <option>In Progress</option>
          <option>Complete</option>
        </select>
        <PersonSelectPopover
            mode="single"
            people={people}
            selectedId={assignee || null}
            onSelect={(id)=> setAssignee(id || "")}
            triggerLabel={assignee ? (people.find(p=>p.id===assignee)?.name || 'Assignee') : 'Assign to…'}
            buttonClassName="px-3 h-10 rounded text-sm bg-white/10 border border-white/20 flex items-center hover:bg-white/15 whitespace-nowrap form-control"
            maxItems={5}
        />
      </div>
      <select
    className="px-3 h-10 rounded text-sm dark-select w-full form-control"
        value={(points as any)}
        onChange={(e)=> setPoints((e.target.value? Number(e.target.value) : "") as any)}
      >
  <option value="">Points (by estimated hours)</option>
  <option value="1">1 pt ~ 0.5 hr</option>
  <option value="3">3 pts ~ 1 hr</option>
  <option value="6">6 pts ~ 2 hrs</option>
  <option value="10">10 pts ~ 3 hrs</option>
  <option value="15">15 pts ~ 5 hrs</option>
  <option value="40">40 pts ~ 10 hrs</option>
  <option value="65">65 pts ~ 15 hrs</option>
  <option value="98">98 pts ~ 20 hrs</option>
  <option value="150">150 pts ~ 25 hrs</option>
  <option value="200">200 pts ~ 30 hrs</option>
      </select>
      <button
        onClick={handleSave}
        disabled={disable}
        className="w-full h-10 rounded bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >{saving ? 'Saving…' : 'Save'}</button>
    </div>
  );

  if (unstyled) return content;

  return (
    <div className={"rounded-2xl bg-white/5 border border-white/10 p-4 " + className}>{content}</div>
  );
}
