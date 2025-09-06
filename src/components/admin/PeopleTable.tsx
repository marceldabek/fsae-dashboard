import { useMemo, useState } from "react";
import { Table, TableCard, TableRowActionsDropdown } from "@/components/application/table";
import QuickAttendanceButton from "./QuickAttendanceButton";
import clsx from "clsx";

type PersonRow = {
  id: string; name: string; role?: string; year?: string;
  discord_id?: string; discord_avatar?: string; discord_username?: string;
  avatar_url?: string; discord_avatar_url?: string;
};

function avatarFor(p: PersonRow) {
  if (p.avatar_url) return p.avatar_url;
  if (p.discord_avatar_url) return p.discord_avatar_url;
  if (p.discord_id && p.discord_avatar) return `https://cdn.discordapp.com/avatars/${p.discord_id}/${p.discord_avatar}.png?size=64`;
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p.name)}`;
}

export default function PeopleTable({
  people,
  toast,
  onUpdate,
  onDelete,
}: {
  people: PersonRow[];
  toast: (s: string)=>void;
  onUpdate: (id: string, patch: Partial<PersonRow>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const roles = useMemo(()=>Array.from(new Set(people.map(p=>p.role).filter(Boolean))) as string[], [people]);
  const years = useMemo(()=>Array.from(new Set(people.map(p=>p.year).filter(Boolean))) as string[], [people]);
  const [roleF, setRoleF] = useState("All");
  const [yearF, setYearF] = useState("All");
  type SelectedKeys = 'all' | Set<string>;
  const [selected, setSelected] = useState<SelectedKeys>(new Set());
  const hasRoleFilter = roles.length > 0;
  const hasYearFilter = years.length > 0;

  const rows = useMemo(()=> people
    .filter(p => (roleF==="All"||p.role===roleF) && (yearF==="All"||p.year===yearF))
    .filter(p => {
      if (!q) return true;
      const s = q.toLowerCase();
      return p.name.toLowerCase().includes(s) || (p.discord_username||"").toLowerCase().includes(s);
    })
    .sort((a,b)=>a.name.localeCompare(b.name)), [people, q, roleF, yearF]);

  const [editing, setEditing] = useState<PersonRow|null>(null);
  const [saving, setSaving] = useState(false);

  // Memoized helpers to avoid churn in react-aria collections
  const columnsDef = useMemo(() => [{}, {}, {}, {}] as Array<Record<string, never>>, []);
  const rowsIds = useMemo(() => rows.map(r => r.id), [rows]);
  const selectedIds = useMemo(() => (selected === 'all' ? rowsIds : Array.from(selected as Set<string>)), [selected, rowsIds]);

  function copyUsername(p: PersonRow) {
    const u = getDiscordUser(p);
    if (!u) { toast("No username"); return; }
    navigator.clipboard.writeText(`@${u}`).then(()=>toast("Username copied"));
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const patch: Partial<PersonRow> = { name: editing.name, year: editing.year };
      await onUpdate(editing.id, patch);
      toast("Saved");
      setEditing(null);
    } catch { toast("Save failed"); } finally { setSaving(false); }
  }

  return (
    <TableCard.Root className="ring-1 ring-border">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border bg-secondary px-4 py-4 md:px-6">
        <div className="flex items-center gap-2">
          <input id="peopleSearch" name="peopleSearch" autoComplete="off"
                 value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search people…"
                 className="h-9 w-64 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-focus-ring" />
          {hasRoleFilter && (
            <select id="roleFilter" name="roleFilter" value={roleF} onChange={(e)=>setRoleF(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-sm">
              <option>All</option>{roles.map(r=> <option key={r}>{r as string}</option>)}
            </select>
          )}
          {hasYearFilter && (
            <select id="yearFilter" name="yearFilter" value={yearF} onChange={(e)=>setYearF(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-sm">
              <option>All</option>{years.map(y=> <option key={y}>{y as string}</option>)}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <QuickAttendanceButton people={people} toast={toast} selectedIds={selectedIds} />
        </div>
      </div>

      <Table aria-label="People" selectionMode="multiple" selectionBehavior="toggle" onSelectionChange={(keys:any)=>{
        // keys is a Set or the string 'all'; store directly to avoid expensive re-computes
        setSelected(keys as SelectedKeys);
      }}>
  <Table.Header columns={columnsDef}>
          <Table.Head id="member" label="Member" isRowHeader />
          <Table.Head id="role" label="Role" />
          <Table.Head id="year" label="Year" />
          <Table.Head id="actions" />
        </Table.Header>

  <Table.Body items={rows}>
          {(p: PersonRow) => (
            <Table.Row id={p.id} columns={columnsDef}>
              <Table.Cell>
                <div className="flex items-center gap-3">
                  <img src={avatarFor(p)} alt="" className="h-8 w-8 rounded-full" />
                  <div className="min-w-0">
    <div className="font-medium truncate">{p.name}</div>
    <div className="text-xs text-fg-secondary truncate">{getDiscordUser(p) ? `@${getDiscordUser(p)}` : ""}</div>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <div className="flex flex-wrap gap-1">
                  {renderRolePills(p.role)}
                </div>
              </Table.Cell>
              <Table.Cell className="text-fg-secondary">{p.year || "—"}</Table.Cell>
              <Table.Cell>
                <TableRowActionsDropdown
                  onEdit={()=>setEditing(p)}
                  onCopyUsername={()=>copyUsername(p)}
                  onDelete={()=>onDelete(p.id)}
                />
              </Table.Cell>
            </Table.Row>
          )}
  </Table.Body>
      </Table>

      {editing && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setEditing(null)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold">Edit user</div>
                <button className="rounded border border-border bg-overlay-6 px-3 py-1.5 text-sm" onClick={()=>setEditing(null)}>Close</button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <img src={avatarFor(editing)} className="h-12 w-12 rounded-full" />
                <div className="min-w-0">
                  <div className="text-sm text-fg-secondary truncate">{getDiscordUser(editing) ? `@${getDiscordUser(editing)}` : ""}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="mb-1 text-fg-secondary">Full name</div>
        <input id="editFullName" name="fullName" autoComplete="name"
          value={editing.name} onChange={(e)=>setEditing({...editing, name: e.target.value})}
                         className="w-full rounded border border-border bg-surface px-3 py-2 text-sm" />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-fg-secondary">Year</div>
        <input id="editYear" name="year" autoComplete="off"
          value={editing.year || ""} onChange={(e)=>setEditing({...editing, year: e.target.value || undefined})}
                         placeholder="e.g. 2026" className="w-full rounded border border-border bg-surface px-3 py-2 text-sm" />
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button className="rounded border border-border bg-overlay-6 px-3 py-2 text-sm" onClick={()=>setEditing(null)}>Cancel</button>
                <button disabled={saving} className="rounded bg-accent text-foreground border border-accent px-3 py-2 text-sm disabled:opacity-50" onClick={saveEdit}>Save changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TableCard.Root>
  );
}

function renderRolePills(role?: string) {
  if (!role) return <span className="text-fg-secondary">—</span>;
  const roles = role.split(",").map(r=>r.trim()).filter(Boolean);
  return roles.map((r) => (
    <span
      key={r}
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
        r.toLowerCase().includes("lead") ? "bg-utility-purple-50 text-utility-purple-700 ring-utility-purple-200" :
        r.toLowerCase().includes("member") ? "bg-utility-blue-50 text-utility-blue-700 ring-utility-blue-200" :
        "bg-utility-gray-50 text-utility-gray-700 ring-utility-gray-200"
      )}
    >{r}</span>
  ));
}

function getDiscordUser(p: any): string | "" {
  if (p.discord_username) return p.discord_username as string;
  const discord = (p.discord as string | undefined) || ""; // may be like "@name"
  return discord.startsWith("@") ? discord.slice(1) : discord;
}

// removed Discord column in favor of showing @username under the member name
