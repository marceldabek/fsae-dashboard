import React, { useState } from "react";
import type { Person } from "../types";
import PersonSelectPopover from "./PersonSelectPopover";
import { addProject } from "../lib/firestore";
import { Input } from "./ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Avatar } from "@/components/base/avatar/avatar";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";

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
    <ModalOverlay isOpen={open} onOpenChange={(v)=>{ if (!v) onClose(); }} className="items-center">
      <Modal>
        <Dialog className="w-full max-w-lg">
          <Card className="shadow-2xl border-border overflow-hidden">
            <CardHeader className="flex items-center justify-between flex-row p-4 pb-2 border-b border-input">
              <CardTitle className="text-lg">Create Project</CardTitle>
              <button onClick={onClose} aria-label="Close" className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-foreground/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
            <Input placeholder="Project name" value={prName} onChange={e=>setPrName(e.target.value)} />
            <Input placeholder="Design link (optional)" value={prDesign} onChange={e=>setPrDesign(e.target.value)} />
            <textarea className="flex h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="Project description (optional)" value={prDesc} onChange={e=>setPrDesc(e.target.value)} />
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={prSubsystem} onValueChange={setPrSubsystem}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subsystem…" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Aero","Business","Composites","Controls","Data Acquisition","Electrical IC","Electrical EV","Finance","Frame","Manufacturing","Powertrain EV","Powertrain IC","Suspension"
                  ].map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={prDue} onChange={e=>setPrDue(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground uppercase tracking-caps">Owners</div>
              {/* Avatar stack showing selected owners */}
              {prOwners.length > 0 && (
                <div className="flex -space-x-1 h-6 items-center">
                  {people
                    .filter((p) => prOwners.includes(p.id))
                    .slice(0, 6)
                    .map((o) => {
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
                  {prOwners.length > 6 && (
                    <Avatar
                      size="xs"
                      className="ring-2 ring-card dark:ring-surface"
                      placeholder={<span className="flex items-center justify-center text-[10px] font-semibold text-quaternary">+{prOwners.length - 6}</span>}
                    />
                  )}
                </div>
              )}
              <PersonSelectPopover
                mode="multi"
                people={people}
                selectedIds={prOwners}
                onAdd={toggleOwner}
                onRemove={toggleOwner}
                triggerLabel={prOwners.length ? `${prOwners.length} selected` : 'Add/Remove'}
                buttonClassName="ml-auto text-[11px] px-2 py-1 rounded border border-input"
                maxItems={5}
              />
            </div>
            </CardContent>
            <CardFooter className="p-4 pt-2 border-t border-input">
            <button
              onClick={handleSave}
              disabled={!prName.trim() || saving}
              className={`w-full px-3 py-2 rounded border text-sm text-center border-input ${prName.trim() ? 'bg-card dark:bg-surface hover:bg-card/80' : 'bg-card dark:bg-surface opacity-50 cursor-not-allowed'}`}
            >{saving ? 'Saving…' : 'Save Project'}</button>
            </CardFooter>
          </Card>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
