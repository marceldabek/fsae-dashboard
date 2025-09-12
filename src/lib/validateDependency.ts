import { Attachment, Dependency } from "@/types/project";

/** Ensures a dependency is valid on the same timeline and non-self. */
export function validateDependency(
  dep: Omit<Dependency, "id">,
  attachmentsById: Map<string, Attachment>
): { ok: true } | { ok: false; reason: string } {
  const { fromAttachmentId, toAttachmentId } = dep as any;
  if (!fromAttachmentId || !toAttachmentId) return { ok: false, reason: "missing-endpoints" };
  if (fromAttachmentId === toAttachmentId) return { ok: false, reason: "self" };
  const a = attachmentsById.get(fromAttachmentId);
  const b = attachmentsById.get(toAttachmentId);
  if (!a || !b) return { ok: false, reason: "missing-attachment" };
  if (a.timelineId !== b.timelineId) return { ok: false, reason: "different-timeline" };

  // Build adjacency for cycle detection (include the new dep)
  const adj = new Map<string, string[]>();
  for (const att of attachmentsById.values()) adj.set(att.id, []);
  // We don't have all deps list here, so we just check a simple temporal cycle using times + new edge path.
  // Basic DFS using times: if new edge creates a path where b ends before a starts, it's temporal inconsistent.
  // More robust: detect graph cycle with the single proposed edge assuming existing edges are implicit by ordering.
  const visit = (id: string, stack: Set<string>): boolean => {
    if (id === a.id) return true; // cycle reached back to source
    if (stack.has(id)) return false;
    stack.add(id);
    const next = adj.get(id) || [];
    for (const n of next) if (visit(n, stack)) return true;
    stack.delete(id);
    return false;
  };
  // Without existing dependency list we approximate by temporal ordering: disallow if a.start < b.start but b.end <= a.end forming containment? skip.
  // Minimal: ensure not creating backward impossible FS relationship: if type fs and b.start < a.start.
  if (dep.type === 'fs' || !dep.type) {
    if (b.start < a.start) return { ok: false, reason: "temporal-order" };
  }
  // Placeholder cycle detection stub (real impl needs full dep graph)
  const cycle = visit(b.id, new Set());
  if (cycle) return { ok: false, reason: "cycle" };
  return { ok: true };
}
