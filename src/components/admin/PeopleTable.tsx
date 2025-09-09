import { memo, useCallback, useMemo, useState } from "react";
import type { RankLevel } from "@/types";
import { addLogEvent } from "@/lib/firestore";
import { Table, TableCard, TableRowActionsDropdown } from "@/components/application/table";
import QuickAttendanceButton from "./QuickAttendanceButton";
import clsx from "clsx";

type PersonRow = {
  id: string; name: string; role?: string; year?: string;
  discord_id?: string; discord_avatar?: string; discord_username?: string;
  avatar_url?: string; discord_avatar_url?: string;
  // ranked fields
  rank?: RankLevel;
  ranked_opt_in?: boolean;
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

  // Pagination: 25 per page
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  // Clamp page when filters/search change
  const pageClamped = Math.min(page, totalPages);
  if (pageClamped !== page) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    setPage(pageClamped);
  }
  const pageRows = useMemo(() => rows.slice((pageClamped - 1) * pageSize, pageClamped * pageSize), [rows, pageClamped]);

  // Edit modal state: store selected id and a local draft to avoid churning the whole list
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editingDraft, setEditingDraft] = useState<PersonRow|null>(null);
  const [editingOriginalRank, setEditingOriginalRank] = useState<RankLevel | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Memoized helpers to avoid churn in react-aria collections
  const columnsDef = useMemo(() => [{}, {}, {}, {}] as Array<Record<string, never>>, []);
  const rowsIds = useMemo(() => pageRows.map(r => r.id), [pageRows]);
  const selectedIds = useMemo(() => (selected === 'all' ? rowsIds : Array.from(selected as Set<string>)), [selected, rowsIds]);

  const copyUsername = useCallback((p: PersonRow) => {
    const u = getDiscordUser(p);
    if (!u) { toast("No username"); return; }
    navigator.clipboard.writeText(`@${u}`).then(()=>toast("Username copied"));
  }, [toast]);

  const onEditOpen = useCallback((p: PersonRow) => {
    setEditingId(p.id);
    // make a shallow copy so edits don't mutate the table row object
    setEditingDraft({ ...p });
    setEditingOriginalRank(p.rank);
  }, []);
  const onDeleteId = useCallback((id: string) => { onDelete(id); }, [onDelete]);

  async function saveEdit() {
    if (!editingId || !editingDraft) return;
    setSaving(true);
    try {
      const patch: Partial<PersonRow> = {
        name: editingDraft.name,
        year: editingDraft.year,
        role: editingDraft.role,
        ranked_opt_in: editingDraft.ranked_opt_in,
        rank: editingDraft.rank,
      };
      await onUpdate(editingId, patch);
      // Optional: log rank change if forced via modal
      if (editingOriginalRank && editingDraft.rank && editingOriginalRank !== editingDraft.rank) {
        try {
          await addLogEvent({ ts: Date.now(), type: "rank_change", person_id: editingId, from_rank: editingOriginalRank, to_rank: editingDraft.rank });
        } catch {}
      }
      toast("Saved");
      setEditingId(null);
      setEditingDraft(null);
      setEditingOriginalRank(undefined);
    } catch { toast("Save failed"); } finally { setSaving(false); }
  }

  return (
    <TableCard.Root className="rounded-2xl bg-card border border-border ring-0 shadow-xs">
      <div className="flex items-center justify-between gap-2 flex-nowrap border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <input id="peopleSearch" name="peopleSearch" autoComplete="off"
                 value={q} onChange={(e)=>{ setQ(e.target.value); setPage(1); }} placeholder="Search people…"
                 className="h-9 min-w-0 flex-1 md:w-80 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-focus-ring" />
          {/* Hide filters on small screens to keep header single-row and keep Quick attendance at top-right */}
          {hasRoleFilter && (
            <select id="roleFilter" name="roleFilter" value={roleF} onChange={(e)=>{ setRoleF(e.target.value); setPage(1); }}
                    className="hidden md:inline-block h-9 rounded-lg border border-border bg-surface px-2 text-sm">
              <option>All</option>{roles.map(r=> <option key={r}>{r as string}</option>)}
            </select>
          )}
          {hasYearFilter && (
            <select id="yearFilter" name="yearFilter" value={yearF} onChange={(e)=>{ setYearF(e.target.value); setPage(1); }}
                    className="hidden md:inline-block h-9 rounded-lg border border-border bg-surface px-2 text-sm">
              <option>All</option>{years.map(y=> <option key={y}>{y as string}</option>)}
            </select>
          )}
        </div>
        <div className="ml-2 shrink-0">
          <QuickAttendanceButton people={people} toast={toast} selectedIds={selectedIds} />
        </div>
      </div>

      <Table aria-label="People" selectionMode="multiple" selectionBehavior="toggle" onSelectionChange={(keys:any)=>{
        // keys is a Set or the string 'all'; store directly to avoid expensive re-computes
        setSelected(keys as SelectedKeys);
      }}>
  <Table.Header columns={columnsDef} className="bg-surface/80">
          <Table.Head id="member" label="Member" isRowHeader />
          <Table.Head id="role" label="Role" className="hidden sm:table-cell" />
          <Table.Head id="year" label="Year" className="hidden sm:table-cell" />
          <Table.Head id="actions" />
        </Table.Header>

  <Table.Body items={pageRows}>
          {(p: PersonRow) => (
            <PersonRowView
              key={p.id}
              p={p}
              columnsDef={columnsDef}
              onEdit={onEditOpen}
              onCopyUsername={copyUsername}
              onDelete={onDeleteId}
            />
          )}
  </Table.Body>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 md:px-6">
        <div className="text-xs text-fg-secondary">Showing {(rows.length === 0 ? 0 : (pageClamped - 1) * pageSize + 1)}–{Math.min(pageClamped * pageSize, rows.length)} of {rows.length}</div>
        <div className="flex items-center gap-1">
          <button
            className="px-2 py-1.5 text-sm rounded border border-border bg-surface disabled:opacity-50"
            disabled={pageClamped <= 1}
            onClick={()=>setPage(p=>Math.max(1, p-1))}
          >Prev</button>
          <span className="text-xs text-fg-secondary px-2">Page {pageClamped} / {totalPages}</span>
          <button
            className="px-2 py-1.5 text-sm rounded border border-border bg-surface disabled:opacity-50"
            disabled={pageClamped >= totalPages}
            onClick={()=>setPage(p=>Math.min(totalPages, p+1))}
          >Next</button>
        </div>
      </div>

      {editingId && editingDraft && (
        <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={()=>{ setEditingId(null); setEditingDraft(null); }} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={avatarFor(editingDraft)} className="h-12 w-12 rounded-full" loading="lazy" decoding="async" />
                  <div className="min-w-0">
                    <div className="text-sm text-fg-secondary truncate">{getDiscordUser(editingDraft) ? `@${getDiscordUser(editingDraft)}` : ""}</div>
                  </div>
                </div>
                <button className="rounded border border-border bg-overlay-6 px-3 py-1.5 text-sm" onClick={()=>{ setEditingId(null); setEditingDraft(null); }}>Close</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="mb-1 text-fg-secondary">Full name</div>
        <input id="editFullName" name="fullName" autoComplete="name"
      value={editingDraft.name} onChange={(e)=>setEditingDraft({...editingDraft!, name: e.target.value})}
                         className="w-full rounded border border-border bg-surface px-3 py-2 text-sm" />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-fg-secondary">Year</div>
                  <select
                    id="editYear"
                    name="year"
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
                    value={editingDraft.year || ""}
                    onChange={(e)=>setEditingDraft({...editingDraft!, year: (e.target.value || undefined)})}
                  >
                    {/* Show current value if it’s a legacy value (e.g. 2026) */}
                    {editingDraft.year && !["Freshman","Sophomore","Junior","Senior"].includes(editingDraft.year) && (
                      <option value={editingDraft.year}>{editingDraft.year}</option>
                    )}
                    <option value="">—</option>
                    <option value="Freshman">Freshman</option>
                    <option value="Sophomore">Sophomore</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                  </select>
                </label>
              </div>

              {/* Ranked controls */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="mb-1 text-fg-secondary">Rank (force change)</div>
                  <select
                    id="editRank"
                    name="rank"
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
                    value={editingDraft.rank || "Bronze"}
                    onChange={(e)=>setEditingDraft({...editingDraft!, rank: (e.target.value as RankLevel)})}
                  >
                    <option>Bronze</option>
                    <option>Silver</option>
                    <option>Gold</option>
                    <option>Platinum</option>
                    <option>Diamond</option>
                  </select>
                </label>
              </div>
              {/* Roles field */}
              <div className="mt-3">
                <label className="text-sm block">
                  <div className="mb-1 text-fg-secondary">Roles (comma-separated)</div>
                  <input
                    id="editRoles"
                    name="roles"
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
                    placeholder="e.g. Lead, Member"
                    value={editingDraft.role || ""}
                    onChange={(e)=>setEditingDraft({...editingDraft!, role: e.target.value || undefined})}
                  />
                </label>
              </div>
              {/* Ranked opt-in switch at the very bottom */}
              <div className="mt-6 flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
                  <span className="text-sm text-muted-foreground tracking-caps uppercase">OPT INTO RANKED POOL</span>
                  <span className="relative inline-flex h-6 w-11 select-none ml-auto">
                    <input
                      type="checkbox"
                      checked={!!editingDraft.ranked_opt_in}
                      onChange={(e)=>setEditingDraft({...editingDraft!, ranked_opt_in: e.target.checked})}
                      className="peer sr-only"
                    />
                    <span className="pointer-events-none block h-6 w-11 rounded-full border border-border bg-black/15 dark:bg-white/15 transition-colors peer-checked:bg-[#64C7C9] peer-focus-visible:ring-2 peer-focus-visible:ring-[#64C7C9]/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background" />
                    <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white dark:bg-background shadow transition-transform peer-checked:translate-x-5" />
                  </span>
                </label>
                <div className="flex justify-end gap-2">
                  <button className="rounded border border-border bg-overlay-6 px-3 py-2 text-sm" onClick={()=>{ setEditingId(null); setEditingDraft(null); }}>Cancel</button>
                  <button disabled={saving} className="rounded bg-accent text-foreground border border-accent px-3 py-2 text-sm disabled:opacity-50" onClick={saveEdit}>Save changes</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </TableCard.Root>
  );
}

// Memoized row view to avoid re-rendering 250 rows when opening modals, etc.
const PersonRowView = memo(function PersonRowView({ p, columnsDef, onEdit, onCopyUsername, onDelete }: {
  p: PersonRow;
  columnsDef: Array<Record<string, never>>;
  onEdit: (p: PersonRow) => void;
  onCopyUsername: (p: PersonRow) => void;
  onDelete: (id: string) => void;
}) {
  const username = getDiscordUser(p);
  return (
  <Table.Row id={p.id} columns={columnsDef} className="bg-card hover:bg-card/80">
      <Table.Cell>
        <div className="flex items-center gap-3">
          <img src={avatarFor(p)} alt="" className="h-8 w-8 rounded-full" loading="lazy" decoding="async" />
          <div className="min-w-0">
            <div className="font-medium truncate">{p.name}</div>
            <div className="text-xs text-fg-secondary truncate">{username ? `@${username}` : ""}</div>
          </div>
        </div>
      </Table.Cell>
  <Table.Cell className="hidden sm:table-cell">
        <div className="flex flex-wrap gap-1">
          {renderRolePills(p.role)}
        </div>
      </Table.Cell>
  <Table.Cell className="hidden sm:table-cell text-fg-secondary">{p.year || "—"}</Table.Cell>
      <Table.Cell>
        <TableRowActionsDropdown
          onEdit={() => onEdit(p)}
          onCopyUsername={() => onCopyUsername(p)}
          onDelete={() => onDelete(p.id)}
        />
      </Table.Cell>
    </Table.Row>
  );
}, (prev, next) => prev.p === next.p);

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
