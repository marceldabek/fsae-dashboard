import { useState } from "react";
import PersonSelectPopover from "@/components/PersonSelectPopover";
import { addAttendance } from "@/lib/firestore";

export default function QuickAttendanceButton({
  people,
  toast,
  selectedIds,
}: {
  people: { id: string; name: string }[];
  toast: (s: string) => void;
  selectedIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const targetIds = selectedIds ?? ids;
    if (!targetIds.length) return;
    setBusy(true);
    try {
      const res = await Promise.allSettled(targetIds.map(id => addAttendance({ person_id: id, date, points: 10 })));
      const ok = res.filter(r => r.status === "fulfilled").length;
      toast(`${ok} marked present (+10 pts)`); setOpen(false); setIds([]);
    } catch { toast("Attendance failed"); } finally { setBusy(false); }
  }

  const effectiveIds = selectedIds ?? ids;

  const disabled = (selectedIds ? selectedIds.length === 0 : ids.length === 0) && !open;

  return (
    <>
      <button
        className={`h-9 rounded-lg border px-3 text-sm ${disabled ? 'bg-overlay-6 border-border/60 text-fg-secondary/60 cursor-not-allowed' : 'bg-surface border-border'}`}
        onClick={() => { if (!disabled) setOpen(true); }}
        disabled={disabled}
        title={disabled ? 'Select people to mark attendance' : 'Quick attendance'}
      >
        Quick attendance
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)} />
          <div className="relative w-[95vw] max-w-lg rounded-2xl border border-border bg-card p-4">
            <div className="text-lg font-semibold mb-2">Quick attendance</div>
            <input id="qaDate" name="qaDate" autoComplete="off" type="date" className="w-full mb-3 px-3 py-2 rounded border border-border bg-surface"
                   value={date} onChange={(e)=>setDate(e.target.value)} />
            {!selectedIds && (
              <PersonSelectPopover
                people={people as any} mode="multi" selectedIds={ids}
                onAdd={(id)=>setIds(v=>v.includes(id)?v:[...v,id])}
                onRemove={(id)=>setIds(v=>v.filter(x=>x!==id))}
                triggerLabel={ids.length ? `${ids.length} selected` : "Select people…"}
                buttonClassName="w-full px-3 py-2 rounded bg-surface border border-border text-sm"
                allowScroll maxItems={100}
              />
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button className="rounded border border-border bg-overlay-6 px-3 py-2 text-sm" onClick={()=>setOpen(false)}>Cancel</button>
              <button disabled={!effectiveIds.length || busy}
                      className="rounded bg-accent text-foreground border border-accent px-3 py-2 text-sm disabled:opacity-50"
                      onClick={submit}>Give 10 pts</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
