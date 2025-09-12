export type Rect = { x: number; y: number; w: number; h: number };

export type RouteOpts = {
  r?: number;                 // corner radius
  shelf?: "auto" | number;    // explicit shelf or auto
  padding?: number;           // horizontal exit/entry and default vertical gap
  boxes?: Rect[];             // other boxes to avoid crossing horizontally
  reserveShelfY?: (yMin:number, yMax:number, x1:number, x2:number)=>number; // allocator hook
};

/**
 * Single-shelf edge router producing exactly one descent + one ascent for forward edges,
 * and one ascent + one descent (above) for back-edges. No oscillations.
 */
export function routeEdge(A:Rect, B:Rect, opts: RouteOpts = {}): string {
  const r = Math.max(0, opts.r ?? 8);
  const pad = opts.padding ?? 8;
  const aRight = A.x + A.w;
  const aMidY = A.y + A.h/2;
  const bLeft = B.x;
  const bMidY = B.y + B.h/2;
  const forward = aRight <= bLeft;

  // Decide if we can skip shelf (short span)
  const spanX = bLeft - aRight;
  const directThreshold = 3 * pad; // heuristic

  // Compute shelfY similar to previous logic (kept for lane separation)
  let shelfY: number;
  if (forward) {
    const base = Math.max(A.y + A.h, B.y + B.h) + pad;
    shelfY = typeof opts.shelf === 'number' ? opts.shelf : base;
    if (opts.reserveShelfY) shelfY = opts.reserveShelfY(base, base + 200, aRight, bLeft);
  } else {
    const top = Math.min(A.y, B.y) - pad;
    shelfY = typeof opts.shelf === 'number' ? opts.shelf : top;
    if (opts.reserveShelfY) shelfY = opts.reserveShelfY(top - 200, top, B.x, aRight);
  }

  if (opts.boxes && opts.boxes.length) {
    const boxes = opts.boxes;
    const dir = forward ? 1 : -1;
    let guard = 0;
    while (guard < 50 && boxes.some(b => shelfY > b.y - 0.5 && shelfY < b.y + b.h + 0.5)) {
      shelfY += dir * 8;
      guard++;
    }
  }

  // Helper to build rounded orthogonal path using quadratic corners.
  function roundedPath(points: {x:number;y:number}[]): string {
    if (points.length === 0) return '';
    const segs: string[] = [`M ${points[0].x} ${points[0].y}`];
    for (let i=1;i<points.length;i++) {
      const prev = points[i-1];
      const curr = points[i];
      const next = points[i+1];
      if (!next) { // last straight segment
        segs.push(`L ${curr.x} ${curr.y}`);
        continue;
      }
      // If orthogonal corner at curr
      const dx1 = curr.x - prev.x; const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x; const dy2 = next.y - curr.y;
      const ortho = (Math.abs(dx1) < 0.001 && Math.abs(dy2) < 0.001 && dx2 !== 0 && dy1 !== 0) || (Math.abs(dy1) < 0.001 && Math.abs(dx2) < 0.001 && dy2 !== 0 && dx1 !== 0);
      if (!ortho || r === 0) {
        segs.push(`L ${curr.x} ${curr.y}`);
        continue;
      }
      // shorten segments
      const dir1x = Math.sign(dx1); const dir1y = Math.sign(dy1);
      const dir2x = Math.sign(dx2); const dir2y = Math.sign(dy2);
      const cornerStart = { x: curr.x - dir1x * r - (dir1y!==0?0:0), y: curr.y - dir1y * r - (dir1x!==0?0:0) };
      const cornerEnd = { x: curr.x + dir2x * r + (dir2y!==0?0:0), y: curr.y + dir2y * r + (dir2x!==0?0:0) };
      // line into corner start
      segs.push(`L ${cornerStart.x} ${cornerStart.y}`);
      // quadratic curve via actual corner
      segs.push(`Q ${curr.x} ${curr.y} ${cornerEnd.x} ${cornerEnd.y}`);
      // Skip adding straight to curr; next loop continues from cornerEnd as implicit current point
      // Update prev reference logically by mutating points[i]
      points[i] = cornerEnd; // so following segment starts at end of curve
    }
    // Add last point if not already
    const last = points[points.length-1];
    segs.push(`L ${last.x} ${last.y}`);
    return segs.join(' ');
  }

  if (forward) {
    // If same row (centers aligned) and clear corridor, draw straight line
    if (Math.abs(aMidY - bMidY) < 0.5 && opts.boxes && opts.boxes.length) {
      const corridorBlocked = opts.boxes.some(box => {
        if (box === A || box === B) return false;
        const boxLeft = box.x;
        const boxRight = box.x + box.w;
        const overlapsX = boxLeft < bLeft && boxRight > aRight; // spans between
        const overlapsY = aMidY >= box.y - 0.5 && aMidY <= box.y + box.h + 0.5;
        return overlapsX && overlapsY;
      });
      if (!corridorBlocked) {
        return `M ${aRight} ${aMidY} L ${bLeft} ${bMidY}`;
      }
    }
    // If short span, draw simple direct bezier (slight curve) instead of shelf
    if (spanX > 0 && spanX < directThreshold) {
      const start = { x: aRight, y: aMidY };
      const end = { x: bLeft, y: bMidY };
      const midX = (start.x + end.x)/2;
      const ctrl1 = { x: midX, y: start.y };
      const ctrl2 = { x: midX, y: end.y };
      return `M ${start.x} ${start.y} C ${ctrl1.x} ${ctrl1.y} ${ctrl2.x} ${ctrl2.y} ${end.x} ${end.y}`;
    }
    const pts = [
      { x: aRight, y: aMidY },
      { x: aRight + pad, y: aMidY },
      { x: aRight + pad, y: shelfY },
      { x: bLeft - pad, y: shelfY },
      { x: bLeft - pad, y: bMidY },
      { x: bLeft, y: bMidY }
    ];
    return roundedPath(pts);
  } else {
    const backSpan = aRight - bLeft;
    if (backSpan > 0 && backSpan < directThreshold) {
      // slight arch above
      const start = { x: A.x, y: aMidY };
      const end = { x: B.x, y: bMidY };
      const peakY = Math.min(A.y, B.y) - pad - 12;
      const ctrl1 = { x: start.x - (pad*0.6), y: peakY };
      const ctrl2 = { x: end.x + (pad*0.6), y: peakY };
      return `M ${start.x} ${start.y} C ${ctrl1.x} ${ctrl1.y} ${ctrl2.x} ${ctrl2.y} ${end.x} ${end.y}`;
    }
    const pts = [
      { x: A.x, y: aMidY },
      { x: A.x - pad, y: aMidY },
      { x: A.x - pad, y: shelfY },
      { x: B.x - pad, y: shelfY },
      { x: B.x - pad, y: bMidY },
      { x: B.x, y: bMidY }
    ];
    return roundedPath(pts);
  }
}

/** Edge lane allocator for shelf Y tracks */
export class EdgeLaneAllocator {
  private step: number;
  private tracks: { y: number; spans: [number, number][] }[] = [];
  constructor(stepPx: number = 12) { this.step = stepPx; }
  reset(): void { this.tracks = []; }
  reserve(yMin:number, yMax:number, x1:number, x2:number): number {
    if (x2 < x1) { const t = x1; x1 = x2; x2 = t; }
    // Try existing tracks sorted by distance from yMin
    const ordered = [...this.tracks].sort((a,b)=>Math.abs(a.y - yMin) - Math.abs(b.y - yMin));
    for (const track of ordered) {
      if (track.y < yMin || track.y > yMax) continue;
      if (!track.spans.some(s => !(x2 <= s[0] || x1 >= s[1]))) {
        track.spans.push([x1,x2]);
        return track.y;
      }
    }
    // Need new track
    const baseY = this.tracks.length ? Math.max(yMin, Math.min(yMax, yMin + this.tracks.length * this.step)) : yMin;
    const newY = baseY;
    this.tracks.push({ y: newY, spans: [[x1,x2]] });
    return newY;
  }
}
