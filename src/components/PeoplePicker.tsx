
import { useMemo, useState } from "react";
import type { Person } from "../types";

export default function PeoplePicker({
  people,
  selectedIds,
  onAdd,
  onRemove,
}: {
  people: Person[];
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const qq = q.toLowerCase();
    return people.filter(p =>
      p.name.toLowerCase().includes(qq) ||
      (p.skills || []).join(" ").toLowerCase().includes(qq)
    );
  }, [people, q]);

  const selected = new Set(selectedIds);

  return (
    <div className="space-y-2">
      <input
        className="px-3 py-2 rounded bg-white text-black text-sm w-full"
        placeholder="Search by name or skill…"
        value={q}
        onChange={e=>setQ(e.target.value)}
      />
      <ul className="max-h-56 overflow-auto rounded border border-white/10 divide-y divide-white/10">
        {filtered.map(p => {
          const isSelected = selected.has(p.id);
          return (
            <li key={p.id} className="p-2 flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted uppercase tracking-caps">{p.skills?.join(", ")}</div>
              </div>
              {isSelected ? (
                <button onClick={()=>onRemove(p.id)} className="text-xs px-2 py-1 rounded border border-red-400 text-red-300">
                  Remove
                </button>
              ) : (
                <button onClick={()=>onAdd(p.id)} className="text-xs px-2 py-1 rounded border">
                  Add
                </button>
              )}
            </li>
          );
        })}
  {filtered.length===0 && <li className="p-2 text-xs text-muted uppercase tracking-caps">No matches</li>}
      </ul>
    </div>
  );
}
