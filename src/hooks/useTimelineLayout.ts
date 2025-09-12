import { useMemo, useCallback } from "react";
import { Attachment } from "@/types/project";
import { packAttachments } from "@/lib/packAttachments";

interface LayoutOptions {
  rowHeight?: number; // default 44
  rowGap?: number; // default 8
  scaleX: (t: number) => number; // supplied by parent
}

export function useTimelineLayout(
  attachments: Attachment[],
  opts: LayoutOptions
) {
  const { rowHeight = 44, rowGap = 8, scaleX } = opts;

  const packed = useMemo(() => packAttachments(attachments), [attachments]);

  const rectOf = useCallback(
    (id: string) => {
      const att = attachments.find((a) => a.id === id);
      if (!att) return undefined;
      const lane = packed.laneOf.get(id) ?? 0;
      const x1 = scaleX(att.start);
      const x2 = scaleX(att.end);
      const y = lane * (rowHeight + rowGap);
      return { x: x1, y, w: x2 - x1, h: rowHeight };
    },
    [attachments, packed, rowHeight, rowGap, scaleX]
  );

  const laneOf = useCallback((id: string) => packed.laneOf.get(id) ?? 0, [packed]);

  return {
    rectOf,
    laneOf,
    laneCount: packed.laneCount,
  };
}
