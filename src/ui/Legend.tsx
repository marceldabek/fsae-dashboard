import React from 'react';

/**
 * Legend component explaining dependency line semantics.
 * Solid line — Forward (Finish→Start) dependency.
 * Dotted line — Back-edge / Non-forward (SS / FF / SF) or earlier-scheduled target.
 * Hover tooltip clarifies dotted semantics.
 */
export const Legend: React.FC = () => {
  return (
    <div className="flex items-start gap-3 text-xs select-none" title="Dotted lines indicate a dependency to an earlier-scheduled project or a non-FS link.">
      <div className="px-2 py-1 rounded-md bg-muted/40 border border-border backdrop-blur-sm">
        <div className="font-medium text-[11px] tracking-wide mb-1 text-muted-foreground">Dependencies</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <svg width={44} height={10} className="overflow-visible">
              <path d="M2 5 H42" className="edge edge--focus" />
            </svg>
            <span>Forward (FS)</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width={44} height={10} className="overflow-visible">
              <path d="M2 5 H42" className="edge edge--back" />
            </svg>
            <span>Back / Non-FS</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Legend;
