import React, { useState } from "react";
// Removed CalendarDate usage for due date in favor of plain Date
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Person } from "../types";
import PersonSelectPopover from "./PersonSelectPopover";
import { addProject, fetchPeople } from "../lib/firestore";
import { Input } from "./ui/input";
import { DueDateField as DueDateFieldUntitled } from "./DueDateFieldUntitled";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Avatar } from "@/components/base/avatar/avatar";
import { getAvatarUrl } from "../utils/colorExtraction";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";

export type ProjectCreateModalProps = {
  open: boolean;
  onClose: () => void;
  people: Person[];
  onCreated?: (projectId: string) => void;
  projectToEdit?: { id: string; name: string; owner_ids?: string[]; design_link?: string; description?: string; due_date?: string; subsystem?: string } | null;
  initialDate?: Date | null; // prefill due date when creating
};

export default function ProjectCreateModal({ open, onClose, people, onCreated, projectToEdit, initialDate }: ProjectCreateModalProps) {
  // Maintain a local people list so we can augment (fetch missing) without mutating parent prop.
  const [localPeople, setLocalPeople] = React.useState<Person[]>(people);
  React.useEffect(() => { setLocalPeople(people); }, [people]);
  const [prName, setPrName] = useState("");
  const [prOwners, setPrOwners] = useState<string[]>([]);
  const [prDesign, setPrDesign] = useState("");
  const [prDesc, setPrDesc] = useState("");
  // Due date stored as JS Date | null
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [prSubsystem, setPrSubsystem] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Ensure owners list never contains duplicates (defensive – toggler already prevents, but prefill or external data may include dupes)
  React.useEffect(() => {
    if (prOwners.length > 1) {
      const uniq = Array.from(new Set(prOwners));
      if (uniq.length !== prOwners.length) setPrOwners(uniq);
    }
  }, [prOwners]);

  const uniqueOwners = React.useMemo(() => Array.from(new Set(prOwners)), [prOwners]);
  
  // Use shared resolver that falls back to discord fields when avatar_url is missing
  const resolveAvatar = (p: any): string | undefined => (p ? getAvatarUrl(p) : undefined);

  function parseDueDateString(raw: string | undefined | null): Date | null {
    if (!raw) return null;
    let s = raw.trim();
    if (s.includes("T")) s = s.split("T")[0];
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) s = s.replaceAll('/', '-');
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function isoToYmd(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(+d)) return iso; // fallback to original
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth()+1).padStart(2,'0');
    const da = String(d.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }

  // initialize from global edit context if present (legacy)
  React.useEffect(() => {
    const existing = (typeof window !== 'undefined' ? (window as any).__EDITING_DUE_DATE__ : undefined) as string | undefined;
    if (existing) setDueDate(parseDueDateString(existing));
  }, []);

  // When opening in create mode, prefer an explicit initialDate prop (timeline right-click),
  // fall back to global window flag if present.
  React.useEffect(() => {
    if (!open) return;
    if (projectToEdit) return; // don't override when editing
    if (initialDate instanceof Date && !isNaN(+initialDate)) {
      setDueDate(initialDate);
      return;
    }
    const existing = (typeof window !== 'undefined' ? (window as any).__EDITING_DUE_DATE__ : undefined) as string | undefined;
    if (existing) {
      const parsed = parseDueDateString(existing);
      setDueDate(parsed);
      // clear once consumed to avoid stale reuse
      try { if (typeof window !== 'undefined') delete (window as any).__EDITING_DUE_DATE__; } catch {}
    }
  }, [open, projectToEdit, initialDate]);

  const reset = () => {
    setPrName("");
    setPrOwners([]);
    setPrDesign("");
    setPrDesc("");
  setDueDate(null);
    setPrSubsystem("");
  };

  // Prefill when editing
  React.useEffect(() => {
    if (open && projectToEdit) {
      // Support both API shapes (snake_case from Firestore and camelCase from timeline mapping)
      const anyPr: any = projectToEdit;
    const dueRawOriginal: string = anyPr.due_date || anyPr.dueDate || "";
    const dueRaw: string = anyPr.due_date ? anyPr.due_date : (anyPr.dueDate ? isoToYmd(anyPr.dueDate) : "");
      setPrName(anyPr.name || "");
    const initialOwners: string[] = [...new Set([...(anyPr.owner_ids || anyPr.ownerIds || [])])];
    setPrOwners(initialOwners);
      setPrDesign(anyPr.design_link || anyPr.designLink || "");
      setPrDesc(anyPr.description || anyPr.desc || "");
  setPrSubsystem(anyPr.subsystem || anyPr.subSystem || "");
  setDueDate(parseDueDateString(dueRaw));

      // If critical fields missing (e.g., owner_ids, subsystem, due_date) attempt to fetch full doc.
            const needsFetch = (
              (anyPr.owner_ids === undefined && anyPr.ownerIds === undefined) ||
              (anyPr.subsystem === undefined && anyPr.subSystem === undefined) ||
              (anyPr.description === undefined && anyPr.desc === undefined) ||
              (anyPr.design_link === undefined && anyPr.designLink === undefined)
            );
  if (needsFetch && anyPr.id) {
        (async () => {
          try {
            const snap = await getDoc(doc(db, 'projects', anyPr.id));
            if (snap.exists()) {
              const full: any = snap.data();
      // Only override owners if we had none (avoid flashing selection count changes)
      setPrOwners(prev => prev.length ? prev : [...(new Set<string>(full.owner_ids || []))]);
              setPrDesign(full.design_link || "");
              setPrDesc(full.description || "");
              setPrSubsystem(full.subsystem || "");
              setDueDate(parseDueDateString(full.due_date));
            }
          } catch { /* ignore fetch errors silently */ }
        })();
      }
      // Fetch people if any selected owners are not present locally (to get avatars)
      if (prOwners.length > 0) {
        const missing = prOwners.filter(id => !localPeople.some(p => p.id === id));
        if (missing.length) {
          (async () => {
            try {
              const fetched = await fetchPeople();
              setLocalPeople(fetched);
            } catch { /* ignore */ }
          })();
        }
      }
  } else if (open && !projectToEdit) {
      reset();
      if (initialDate instanceof Date && !isNaN(+initialDate)) {
        setDueDate(initialDate);
      } else {
        const existing = (typeof window !== 'undefined' ? (window as any).__EDITING_DUE_DATE__ : undefined) as string | undefined;
        if (existing) {
          setDueDate(parseDueDateString(existing));
          try { if (typeof window !== 'undefined') delete (window as any).__EDITING_DUE_DATE__; } catch {}
        } else {
          setDueDate(null);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectToEdit?.id]);

  // Ensure we have freshest people (with avatar_url) when modal opens
  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const fetched = await fetchPeople();
        // Merge by id, prefer fetched (has avatar_url from Discord)
        const map = new Map<string, Person>();
        for (const p of [...localPeople, ...fetched]) map.set(p.id, p);
        setLocalPeople(Array.from(map.values()));
      } catch {}
    })();
    // one-shot when opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // (debug logging removed)

  function toggleOwner(id: string) {
    setPrOwners(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (!prName.trim()) return;
    try {
      setSaving(true);
      if (projectToEdit) {
        await addProject({
          id: projectToEdit.id,
          name: prName.trim(),
          owner_ids: prOwners,
          design_link: prDesign.trim() || undefined,
          description: prDesc.trim() || undefined,
          due_date: dueDate ? dueDate.toISOString() : undefined,
          subsystem: prSubsystem || undefined,
        } as any);
        onCreated?.(projectToEdit.id);
      } else {
        const id = await addProject({
          name: prName.trim(),
          owner_ids: prOwners,
          design_link: prDesign.trim() || undefined,
          description: prDesc.trim() || undefined,
          due_date: dueDate ? dueDate.toISOString() : undefined,
          subsystem: prSubsystem || undefined,
        } as any);
        onCreated?.(id as any);
      }
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
  <Dialog aria-label={projectToEdit ? 'Edit Project' : 'Create Project'} className="w-full max-w-lg outline-none ring-0 focus:outline-none focus-visible:outline-none">
          <Card className="border border-border overflow-hidden shadow-md focus-visible:outline-none focus-visible:ring-0">
            <CardHeader className="flex items-center justify-between flex-row p-4 pb-2 border-b border-input">
              <CardTitle className="text-lg">{projectToEdit ? 'Edit Project' : 'Create Project'}</CardTitle>
              <button onClick={onClose} aria-label="Close" className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-foreground/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
            <Input placeholder="Project name" value={prName} onChange={e=>setPrName(e.target.value)} />
            <Input placeholder="Design link (optional)" value={prDesign} onChange={e=>setPrDesign(e.target.value)} />
            <textarea className="flex h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="Project description (optional)" value={prDesc} onChange={e=>setPrDesc(e.target.value)} />
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="w-full">
                  <label className="sr-only" id="subsystem-label">Subsystem</label>
                  <Select value={prSubsystem} onValueChange={setPrSubsystem}>
                    <SelectTrigger aria-labelledby="subsystem-label" aria-label={prSubsystem ? `Subsystem ${prSubsystem}` : 'Select subsystem'}>
                      <SelectValue placeholder="Select subsystem…" />
                    </SelectTrigger>
                    <SelectContent disablePortal>
                      {[
                        "Aero","Business","Composites","Controls","Data Acquisition","Electrical IC","Electrical EV","Finance","Frame","Manufacturing","Powertrain EV","Powertrain IC","Suspension"
                      ].map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DueDateFieldUntitled value={dueDate} onChange={setDueDate} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide opacity-80">Owners</span>
        {uniqueOwners.length > 0 ? (
                <div className="flex -space-x-1 h-6 items-center">
                  {uniqueOwners.slice(0, 6).map(id => {
          const o: any = localPeople.find(p => p.id === id);
          const initials = o?.name
                      ? o.name
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((s: string) => s[0]?.toUpperCase())
                          .join("")
                      : undefined;
          const src = resolveAvatar(o);
                    return (
                      <Avatar
            key={id}
                        size="xs"
            alt={o?.name || id}
                        src={src}
            initials={!src ? (initials || id.slice(0,2).toUpperCase()) : undefined}
                        className="ring-2 ring-card dark:ring-surface"
                      />
                    );
                  })}
                  {uniqueOwners.length > 6 && (
                    <Avatar
                      size="xs"
                      className="ring-2 ring-card dark:ring-surface"
                      placeholder={<span className="flex items-center justify-center text-[10px] font-semibold text-quaternary">+{uniqueOwners.length - 6}</span>}
                    />
                  )}
                </div>
              ) : (
                <div className="h-6 flex items-center px-1.5 rounded bg-white/10">
                  <span className="text-[10px] leading-none opacity-80">N/A</span>
                </div>
              )}
              <PersonSelectPopover
                mode="multi"
                people={people}
                selectedIds={uniqueOwners}
                onAdd={toggleOwner}
                onRemove={toggleOwner}
                triggerLabel={uniqueOwners.length ? `${uniqueOwners.length} selected` : 'Add/Remove'}
                buttonClassName="ml-auto text-[11px] px-2 py-1 rounded border border-input"
                maxItems={5}
              />
            </div>
            </CardContent>
            <CardFooter className="p-4 pt-2 border-t border-input">
            <button
              onClick={handleSave}
              disabled={!prName.trim() || saving}
              className={`w-full px-3 py-2 rounded text-sm text-center font-semibold transition-colors border border-transparent
                ${prName.trim() ? 'bg-[hsl(var(--accent-soft))] text-white hover:bg-[hsl(var(--accent-hover))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent-hover))]/60' : 'bg-[hsl(var(--accent-soft))]/40 text-white/60 cursor-not-allowed'}
              `}
            >{saving ? 'Saving…' : projectToEdit ? 'Update Project' : 'Save Project'}</button>
            </CardFooter>
          </Card>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
