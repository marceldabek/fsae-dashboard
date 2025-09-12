import { Attachment } from "@/types/project";

/**
 * packAttachments assigns each attachment to the lowest-index lane
 * such that no two attachments in the same lane overlap in time.
 * Overlap rule: intervals [start, end) overlap if start < other.end && other.start < end.
 * Items are processed in ascending (start, end, originalIndex) order for stability.
 */
export function packAttachments(items: Attachment[]): {
  laneOf: Map<string, number>;
  laneCount: number;
} {
  // Decorate with original index for stability among equal starts/ends.
  const decorated = items.map((a, i) => ({ a, i }));
  // Sort by start only; preserve original relative order for equal starts (stable by index)
  decorated.sort((x, y) => (x.a.start === y.a.start ? x.i - y.i : x.a.start - y.a.start));

  // For each lane keep the end time of the last placed attachment.
  const laneEnds: number[] = [];
  const laneOf = new Map<string, number>();

  for (const { a } of decorated) {
    const start = a.start;
    const end = a.end;
    let placed = false;
    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (start >= laneEnds[lane]) { // fits after the last one in this lane
        laneOf.set(a.id, lane);
        laneEnds[lane] = end;
        placed = true;
        break;
      }
    }
    if (!placed) {
      const lane = laneEnds.length;
      laneOf.set(a.id, lane);
      laneEnds.push(end);
    }
  }

  return { laneOf, laneCount: laneEnds.length };
}
