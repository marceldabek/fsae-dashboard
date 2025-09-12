import React, { useMemo } from "react";
import "./EdgesLayer.css";
import { Dependency } from "@/types/project";
import { routeEdge } from "@/lib/routeEdge";

type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  deps: Dependency[];
  rectOf: (id: string) => Rect | undefined;
  hoveredAttachmentId?: string | null;
  mode?: "all" | "selected" | "incoming" | "outgoing" | "critical"; // future filtering strategies
  fadedOpacity?: number;
};

export default function EdgesLayer({
  deps,
  rectOf,
  hoveredAttachmentId,
  mode = "all",
  fadedOpacity = 0.15,
}: Props): JSX.Element {
  const hover = hoveredAttachmentId ?? null;

  const paths = useMemo(() => {
    return deps
      .map((d) => {
        const from = rectOf(d.fromAttachmentId);
        const to = rectOf(d.toAttachmentId);
        if (!from || !to) return null;

        // Mode filtering (placeholder for future logic)
        switch (mode) {
          case "incoming":
            if (hover && d.toAttachmentId !== hover) return null;
            break;
          case "outgoing":
            if (hover && d.fromAttachmentId !== hover) return null;
            break;
          case "selected":
            if (hover && d.fromAttachmentId !== hover && d.toAttachmentId !== hover)
              return null;
            break;
          case "critical":
            // For now treat same as selected.
            if (hover && d.fromAttachmentId !== hover && d.toAttachmentId !== hover)
              return null;
            break;
          case "all":
          default:
            break;
        }

        const dAttr = routeEdge(from, to);
        const incident = hover && (d.fromAttachmentId === hover || d.toAttachmentId === hover);
        return {
          id: d.id,
          d: dAttr,
          incident: !!incident,
        };
      })
      .filter(Boolean) as { id: string; d: string; incident: boolean }[];
  }, [deps, rectOf, hover, mode]);

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      aria-hidden="true"
    >
      {paths.map((p) => {
        const cls = p.incident ? "edge edge--focus" : "edge";
        return (
          <path
            key={p.id}
            d={p.d}
            className={cls}
            strokeOpacity={p.incident ? 1 : fadedOpacity}
          />
        );
      })}
    </svg>
  );
}
