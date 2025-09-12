import React, { useEffect, useState } from "react";
import type { Person, Project, Task } from "../types";
import PersonSelectPopover from "./PersonSelectPopover";
import { addTask, updateTask } from "../lib/firestore";
import { Input } from "./ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";

interface TaskCreateModalProps {
  open: boolean;
  onClose: () => void;
  people: Person[];
  projects?: Project[]; // required if fixedProjectId not provided
  fixedProjectId?: string; // if provided, hides project selector
  onCreated?: () => void; // callback after successful creation or update
  taskToEdit?: Task; // if provided, opens in edit mode with prefilled fields
}

export default function TaskCreateModal({ open, onClose, people, projects = [], fixedProjectId, onCreated, taskToEdit }: TaskCreateModalProps) {
  const isEdit = !!taskToEdit;
  const [projectId, setProjectId] = useState<string>(fixedProjectId || "");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<"Todo" | "In Progress" | "Complete">("In Progress");
  // Single assignee used only in edit mode
  const [assignee, setAssignee] = useState<string>("");
  // Multi-assign used only in create mode
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [points, setPoints] = useState<number | "">("");
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    if (!open) return;
    if (isEdit && taskToEdit) {
      setProjectId(taskToEdit.project_id);
      setDesc(taskToEdit.description || "");
      setStatus(taskToEdit.status);
      setAssignee(taskToEdit.assignee_id || "");
  setAssigneeIds([]);
      setPoints(taskToEdit.ranked_points ?? "");
    } else {
      setProjectId(fixedProjectId || "");
      setDesc("");
      setStatus("In Progress");
  setAssignee("");
  setAssigneeIds([]);
      setPoints("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, taskToEdit]);

  async function handleSave() {
    if (saving) return;
    if (!desc.trim()) return;
    const pid = fixedProjectId || projectId;
    if (!pid) return;
    setSaving(true);
    try {
      if (isEdit && taskToEdit) {
        try { console.log("[TaskCreateModal] update", { id: taskToEdit.id, project_id: pid, description: desc.trim(), status, assignee_id: assignee || undefined, ranked_points: points || undefined }); } catch {}
        await updateTask(taskToEdit.id, { description: desc.trim(), status, assignee_id: assignee || undefined, ranked_points: (points || undefined) as any });
        onCreated?.();
        onClose();
      } else {
        // Create one task per selected assignee; if none selected, create a single unassigned task.
        const ids = assigneeIds.length > 0 ? assigneeIds : [""];
        for (const aId of ids) {
          try { console.log("[TaskCreateModal] create", { project_id: pid, description: desc.trim(), status, assignee_id: aId || undefined, ranked_points: points || undefined }); } catch {}
          // Status is set to current state (default In Progress); completion should be done via 3-dot menu later.
          // Each assignee gets the same ranked_points value.
          // Use undefined when aId is empty to keep task unassigned.
          // eslint-disable-next-line no-await-in-loop
          await addTask({ project_id: pid, description: desc.trim(), status, assignee_id: aId || undefined, ranked_points: (points || undefined) as any });
        }
        setDesc("");
        setStatus("In Progress");
        setAssignee("");
        setAssigneeIds([]);
        setPoints("");
        if (!fixedProjectId) setProjectId("");
        onCreated?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  const disable = !desc.trim() || saving || !(fixedProjectId || projectId);

  return open ? (
  <ModalOverlay isOpen={open} onOpenChange={(v)=>{ if (!v) onClose(); }} className="items-center">
      <Modal>
  <Dialog aria-label={isEdit ? "Edit Task" : "Add Task"} className="w-full max-w-md">
          <Card className="shadow-2xl border-border overflow-hidden">
            <CardHeader className="flex items-center justify-between flex-row p-4 pb-2 border-b border-input">
        <CardTitle className="text-lg">{isEdit ? "Edit Task" : "Add Task"}</CardTitle>
              <button onClick={onClose} aria-label="Close" className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-foreground/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
        {!fixedProjectId && !isEdit && (
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select project…" />
                  </SelectTrigger>
          <SelectContent disablePortal>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

  <div className="flex gap-2">
                <Input
                  className="h-9 text-sm rounded-md flex-1"
                  placeholder="Task title"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {isEdit ? (
                  <PersonSelectPopover
                    mode="single"
                    people={people}
                    selectedId={assignee || null}
                    onSelect={(id) => setAssignee(id || "")}
                    triggerLabel={assignee ? (people.find((p) => p.id === assignee)?.name || "Assignee") : "Assign to…"}
                    buttonClassName="px-3 h-9 rounded-md text-sm border border-input flex items-center whitespace-nowrap"
                    maxItems={5}
                  />
                ) : (
                  <PersonSelectPopover
                    mode="multi"
                    people={people}
                    selectedIds={assigneeIds}
                    onAdd={(id) => setAssigneeIds((prev) => prev.includes(id) ? prev : [...prev, id])}
                    onRemove={(id) => setAssigneeIds((prev) => prev.filter((x) => x !== id))}
                    triggerLabel={assigneeIds.length ? (() => {
                      const names = assigneeIds.map((id) => people.find((p) => p.id === id)?.name || id);
                      const head = names[0];
                      const extra = names.length - 1;
                      return extra > 0 ? `${head} (+${extra})` : head;
                    })() : "Assign to…"}
                    buttonClassName="px-3 h-9 rounded-md text-sm border border-input flex items-center whitespace-nowrap"
                    maxItems={5}
                  />
                )}
                <Select value={points === "" ? "none" : String(points)} onValueChange={(v) => setPoints(v === "none" ? "" : Number(v))}>
                  <SelectTrigger className="flex-1 text-sm rounded-md h-9">
                    <SelectValue placeholder="Points (by estimated hours)" />
                  </SelectTrigger>
                  <SelectContent disablePortal>
                    <SelectItem value="none">No estimate</SelectItem>
                    <SelectItem value="1">1 pt ~ 0.5 hr</SelectItem>
                    <SelectItem value="3">3 pts ~ 1 hr</SelectItem>
                    <SelectItem value="6">6 pts ~ 2 hrs</SelectItem>
                    <SelectItem value="10">10 pts ~ 3 hrs</SelectItem>
                    <SelectItem value="15">15 pts ~ 5 hrs</SelectItem>
                    <SelectItem value="40">40 pts ~ 10 hrs</SelectItem>
                    <SelectItem value="65">65 pts ~ 15 hrs</SelectItem>
                    <SelectItem value="98">98 pts ~ 20 hrs</SelectItem>
                    <SelectItem value="150">150 pts ~ 25 hrs</SelectItem>
                    <SelectItem value="200">200 pts ~ 30 hrs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isEdit && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Selecting multiple people will create one task per person with identical title and points.
                </p>
              )}
            </CardContent>
            <CardFooter className="p-4 pt-2 border-t border-input">
              <button
                onClick={handleSave}
                disabled={disable}
                className={`w-full h-9 rounded-md text-sm text-center font-semibold transition-colors border border-transparent ${
                  !disable
                    ? 'bg-[hsl(var(--accent-soft))] text-white hover:bg-[hsl(var(--accent-hover))] focus:outline-none'
                    : 'bg-[hsl(var(--accent-soft))]/40 text-white/60 cursor-not-allowed'
                }`}
              >
                {saving
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : assigneeIds.length > 1
                      ? `Save (${assigneeIds.length} tasks)`
                      : "Save"}
              </button>
            </CardFooter>
          </Card>
        </Dialog>
      </Modal>
    </ModalOverlay>
  ) : null;
}
