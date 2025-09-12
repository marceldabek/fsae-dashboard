import { Attachment, Dependency } from "@/types/project";

/**
 * Computes longest path (by sum of durations) in a DAG formed by attachments and dependencies.
 * Throws Error("cycle") if a cycle is detected.
 */
export function criticalPath(
  attachments: Attachment[],
  deps: Dependency[]
): { ids: string[]; totalDuration: number } {
  const byId = new Map<string, Attachment>();
  for (const a of attachments) byId.set(a.id, a);

  // Build adjacency (from -> to)
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const a of attachments) indeg.set(a.id, 0);
  for (const d of deps) {
    if (!byId.has(d.fromAttachmentId) || !byId.has(d.toAttachmentId)) continue;
    const arr = adj.get(d.fromAttachmentId) || [];
    arr.push(d.toAttachmentId);
    adj.set(d.fromAttachmentId, arr);
    indeg.set(d.toAttachmentId, (indeg.get(d.toAttachmentId) || 0) + 1);
  }

  // Kahn topological order
  const q: string[] = [];
  for (const [id, deg] of indeg.entries()) if (deg === 0) q.push(id);
  const topo: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    topo.push(id);
    for (const nxt of adj.get(id) || []) {
      indeg.set(nxt, (indeg.get(nxt) || 0) - 1);
      if (indeg.get(nxt) === 0) q.push(nxt);
    }
  }
  if (topo.length !== attachments.length) throw new Error("cycle");

  // Longest path DP
  const dur = (a: Attachment) => a.end - a.start;
  const best: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  for (const id of topo) {
    best[id] = dur(byId.get(id)!);
    prev[id] = null;
  }
  for (const id of topo) {
    for (const nxt of adj.get(id) || []) {
      const cand = best[id] + dur(byId.get(nxt)!);
      if (cand > best[nxt]) {
        best[nxt] = cand;
        prev[nxt] = id;
      }
    }
  }

  // Find max
  let endId = topo[0];
  for (const id of topo) if (best[id] > best[endId]) endId = id;

  // Reconstruct path
  const ids: string[] = [];
  let cur: string | null = endId;
  while (cur) {
    ids.push(cur);
    cur = prev[cur];
  }
  ids.reverse();
  return { ids, totalDuration: best[endId] };
}
