
import { useEffect, useState } from "react";

import { fetchPeople } from "../lib/firestore";
import type { Person } from "../types";
import { Link } from "react-router-dom";

export default function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => setPeople(await fetchPeople()))();
  }, []);

  const filtered = people.filter(p =>
    (p.name || "").toLowerCase().includes(q.toLowerCase()) ||
    (p.skills || []).join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">People</h1>
        <input
          className="px-3 py-2 rounded text-sm w-56"
          placeholder="Search by name or skill…"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
      </div>

  <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <li key={p.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
    <Link to={`/person/${p.id}`} className="text-base font-medium hover:underline">{p.name}</Link>
    <div className="text-xs text-uconn-muted">{p.year}</div>
    {p.discord && <div className="text-xs text-uconn-muted">@{p.discord.replace(/^@/, '')}</div>}
            <div className="text-xs text-uconn-muted mt-2">Skills: {p.skills?.join(", ") || "—"}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
