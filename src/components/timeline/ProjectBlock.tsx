import React from 'react';
import './ProjectBlock.css';
// NOTE: If fmtShort is not actually exported from pages/Timeline, replace the import with a local helper.

export interface TimelineProjectBlockProps {
  id?: string; // optional for future hooks
  name: string;
  dueDate: Date;
  color: string;
  rect: { x:number; y:number; w:number; h:number };
  selected?: boolean;
  milestone?: boolean;
  elevate?: boolean;
  scale?: number; // zoom scale to adapt density
  hideDate?: boolean; // suppress inline date label (far zoom compact mode)
  onClick?: () => void;
  onDoubleClick?: () => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * Zoom-adaptive project block for timeline.
 * Modes chosen from `scale`:
 *  full >=1.2, compact 0.8–1.2, mini 0.5–0.8, dot <0.5
 */
export const ProjectBlock: React.FC<TimelineProjectBlockProps> = ({ name, dueDate, color, rect, selected, milestone, elevate, scale, hideDate, onClick, onDoubleClick, onMouseDown, onMouseUp, onMouseLeave }) => {
  let mode: 'full'|'compact'|'mini'|'dot' = 'full';
  if (typeof scale === 'number') {
    if (scale < 0.5) mode='dot';
    else if (scale < 0.8) mode='mini';
    else if (scale < 1.2) mode='compact';
  }
  const initials = name.split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,3).join('').toUpperCase();
  const title = `${name} - due ${dueDate.toLocaleDateString(undefined,{ month:'numeric', day:'numeric' })}`;
  const baseCls = `project-block absolute rounded shadow-sm overflow-hidden text-black dark:text-white transition-transform ${selected ? 'project-block--selected' : ''}`;
  return (
    <div
      role="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      className={baseCls + (mode!=='dot' ? ' hover:scale-[1.02]' : '')}
  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, background: color, zIndex: elevate ? 50 : 10, touchAction: 'none' }}
      title={title}
    >
  {mode!=='dot' && !hideDate && (
        <div className="absolute top-0.5 right-1 text-[9px] font-semibold leading-none text-black/80 dark:text-white/90 select-none">
          {dueDate.getMonth()+1}/{dueDate.getDate()}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center px-1.5 text-center">
        {mode==='dot' && <div className="text-[9px] font-semibold leading-none select-none">{initials}</div>}
        {mode!=='dot' && (() => {
          const h = rect.h;
          if (h >= 40) {
            // Full size: allow multiline (no hard char cap)
            return (
              <div
                className="w-full text-[11px] leading-tight font-medium select-none break-words overflow-hidden"
                style={{ display:'-webkit-box', WebkitLineClamp:3 as any, WebkitBoxOrient:'vertical' }}
              >
                {name}
              </div>
            );
          }
          if (h === 32) {
            // Mid (shrink) size: single line up to 24 chars
            const txt = name.length > 24 ? name.slice(0,24) : name;
            return (
              <div className="w-full text-[10px] leading-none font-medium select-none whitespace-nowrap overflow-hidden">{txt}</div>
            );
          }
          // Far out tiny (e.g., 14px height): 14 chars max
            const tiny = name.length > 14 ? name.slice(0,14) : name;
            return (
              <div className="w-full text-[10px] leading-none font-medium select-none whitespace-nowrap overflow-hidden">{tiny}</div>
            );
        })()}
      </div>
      {milestone && mode!=='dot' && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] bg-black text-white px-1.5 py-[2px] rounded">
          {dueDate.getMonth()+1}/{dueDate.getDate()}
        </div>
      )}
    </div>
  );
};

export default ProjectBlock;
