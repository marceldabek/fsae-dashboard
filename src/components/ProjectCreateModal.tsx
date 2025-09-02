import React, { useState } from "react";
import type { Person } from "../types";
import PersonSelectPopover from "./PersonSelectPopover";
import { addProject } from "../lib/firestore";

export type ProjectCreateModalProps = {
  open: boolean;
  onClose: () => void;
  people: Person[];
  onCreated?: (projectId: string) => void;
};

export default function ProjectCreateModal({ open, onClose, people, onCreated }: ProjectCreateModalProps) {
  const [prName, setPrName] = useState("");
  const [prOwners, setPrOwners] = useState<string[]>([]);
  const [prDesign, setPrDesign] = useState("");
  const [prDesc, setPrDesc] = useState("");
  const [prDue, setPrDue] = useState("");
  const [prSubsystem, setPrSubsystem] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPrName("");
    setPrOwners([]);
    setPrDesign("");
    setPrDesc("");
    setPrDue("");
    setPrSubsystem("");
  };

  function toggleOwner(id: string) {
    setPrOwners(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (!prName.trim()) return;
    try {
      setSaving(true);
      const id = await addProject({
        name: prName.trim(),
        owner_ids: prOwners,
        design_link: prDesign.trim() || undefined,
        description: prDesc.trim() || undefined,
        due_date: prDue || undefined,
        subsystem: prSubsystem || undefined,
      } as any);
      onCreated?.(id as any);
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[95vw] max-w-lg rounded-2xl border border-border bg-card dark:bg-surface shadow-2xl p-5 overflow-auto max-h-[92vh]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Create Project</h3>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="space-y-3">
          <input className="px-3 py-2 rounded w-full bg-surface text-foreground border border-border placeholder:text-muted-foreground focus:outline-none" placeholder="Project name" value={prName} onChange={e=>setPrName(e.target.value)} />
          <input className="px-3 py-2 rounded w-full bg-surface text-foreground border border-border placeholder:text-muted-foreground focus:outline-none" placeholder="Design link (optional)" value={prDesign} onChange={e=>setPrDesign(e.target.value)} />
          <textarea className="px-3 py-2 rounded w-full bg-surface text-foreground border border-border placeholder:text-muted-foreground focus:outline-none" placeholder="Project description (optional)" value={prDesc} onChange={e=>setPrDesc(e.target.value)} />
          <div className="flex flex-col sm:flex-row gap-2">
            <select className="px-3 py-2 rounded w-full bg-surface text-foreground border border-border dark-select placeholder:text-muted-foreground focus:outline-none" value={prSubsystem} onChange={e=>setPrSubsystem(e.target.value)}>
              <option value="">Select subsystem…</option>
              <option>Aero</option>
              <option>Business</option>
              <option>Composites</option>
              <option>Controls</option>
              <option>Data Acquisition</option>
              <option>Electrical IC</option>
              <option>Electrical EV</option>
              <option>Finance</option>
              <option>Frame</option>
              <option>Manufacturing</option>
              <option>Powertrain EV</option>
              <option>Powertrain IC</option>
              <option>Suspension</option>
            </select>
            <input type="date" className="px-3 py-2 rounded w-full bg-surface text-foreground border border-border focus:outline-none" value={prDue} onChange={e=>setPrDue(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground uppercase tracking-caps">Owners</div>
            <PersonSelectPopover
              mode="multi"
              people={people}
              selectedIds={prOwners}
              onAdd={toggleOwner}
              onRemove={toggleOwner}
              triggerLabel={prOwners.length ? `${prOwners.length} selected` : 'Add/Remove'}
              buttonClassName="ml-auto text-[11px] px-2 py-1 rounded bg-surface text-foreground border border-border"
              maxItems={5}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!prName.trim() || saving}
            className={`w-full px-3 py-2 rounded border border-border text-sm text-center ${prName.trim() ? 'bg-card dark:bg-surface hover:bg-card/80' : 'bg-card dark:bg-surface opacity-50 cursor-not-allowed'}`}
          >{saving ? 'Saving…' : 'Save Project'}</button>
        </div>
      </div>
    </div>
  );
}
