/** Allocates sparse Y-tracks for vertical edge runs to reduce overlap. */
export class EdgeLaneAllocator {
  private step: number;
  // Map of y -> list of occupied x-intervals for that horizontal track
  private lanes: Map<number, { x1: number; x2: number }[]> = new Map();

  constructor(step: number = 10) {
    this.step = step;
  }

  /**
   * Reserve a horizontal track (y) that can visually span from x1..x2 while logically
   * associated with a vertical segment constrained between y1..y2.
   * Attempts to pick the lowest available y inside [min(y1,y2), max(y1,y2)] such that
   * it does not horizontally overlap an existing reservation on that same y.
   * If all candidate y positions are occupied, reuses the one with the fewest overlaps.
   *
   * Overlap rule (half-open): (x1 < other.x2 && other.x1 < x2)
   *
   * @returns chosen y coordinate for the horizontal run.
   *
   * @example
   * const alloc = new EdgeLaneAllocator(12);
   * const yA = alloc.reserveBetween(0, 50, 100, 140); // 0
   * const yB = alloc.reserveBetween(0, 50, 100, 140); // 12
   * const yC = alloc.reserveBetween(0, 50, 100, 140); // 24
   * // Another overlapping request will pick 36, etc., until the range is exhausted.
   */
  reserveBetween(y1: number, y2: number, x1: number, x2: number): number {
    if (x2 < x1) [x1, x2] = [x2, x1];
    let minY = Math.min(y1, y2);
    let maxY = Math.max(y1, y2);
    if (maxY < minY) [minY, maxY] = [maxY, minY];

    // Normalize to step grid starting at minY.
    const first = minY;
    const candidates: number[] = [];
    for (let y = first; y <= maxY; y += this.step) {
      candidates.push(y);
    }
    if (candidates.length === 0) candidates.push(first);

    // Try to find a free lane (no horizontal overlap)
    for (const y of candidates) {
      const intervals = this.lanes.get(y) || [];
      const conflict = intervals.some((iv) => x1 < iv.x2 && iv.x1 < x2);
      if (!conflict) {
        intervals.push({ x1, x2 });
        this.lanes.set(y, intervals);
        return y;
      }
    }

    // All occupied; choose the candidate with least number of overlapping intervals.
    let bestY = candidates[0];
    let bestScore = Infinity;
    for (const y of candidates) {
      const intervals = this.lanes.get(y) || [];
      const count = intervals.reduce(
        (acc, iv) => acc + (x1 < iv.x2 && iv.x1 < x2 ? 1 : 0),
        0
      );
      if (count < bestScore) {
        bestScore = count;
        bestY = y;
      }
    }
    const list = this.lanes.get(bestY) || [];
    list.push({ x1, x2 });
    this.lanes.set(bestY, list);
    return bestY;
  }

  /** Clear all reservations. */
  reset(): void {
    this.lanes.clear();
  }
}
