import { useEffect, useState } from "react";
import { fetchPeople } from "../lib/firestore";
import type { Person } from "../types";
import { Link } from "react-router-dom";
import { useRankedEnabled } from "../hooks/useRankedEnabled";
import { useRoles } from "../lib/roles";

function rankIconSrc(rank?: string) {
  const base = import.meta.env.BASE_URL || '/';
  const r = (rank || 'Bronze').toLowerCase();
  const ext = 'png';
  return `${base}icons/rank-${r}.${ext}`;
}

export default function Members() {
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [rankedEnabled] = useRankedEnabled();
  const { role, ready } = useRoles();

  useEffect(() => {
    (async () => setPeople(await fetchPeople()))();
  }, []);

  const filtered = people.filter(p =>
    (p.name || "").toLowerCase().includes(q.toLowerCase()) ||
    ((p.role || p.year) || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Members</h1>
        <input
          className="px-3 py-2 rounded text-sm w-40 md:w-52 border border-border bg-card dark:bg-surface text-foreground focus:bg-card/80 focus:outline-none"
          placeholder="Search"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
      </div>

      <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <li key={p.id} className="relative rounded-2xl bg-card dark:bg-surface border border-border p-4">
            {rankedEnabled && role === 'admin' && p.rank && (
              <img
                src={rankIconSrc(p.rank)}
                alt={p.rank}
                className="absolute top-2 right-2 h-12 w-12 md:h-16 md:w-16 object-contain opacity-90"
              />
            )}
            <Link to={`/person/${p.id}`} className="text-base font-medium hover:underline">{p.name}</Link>
            {p.discord && <div className="text-xs text-muted-foreground uppercase tracking-caps">@{p.discord.replace(/^@/, '')}</div>}
            <div className="text-xs text-muted-foreground uppercase tracking-caps">{p.role || p.year}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
