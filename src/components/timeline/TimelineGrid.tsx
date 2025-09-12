import React, { useMemo } from 'react';

/** Tick grid that adapts to zoom.
 * scale is px per ms. Thresholds defined in hours for simplicity.
 */
export interface TimelineGridProps {
  start: number;
  end: number;
  toX: (t:number)=>number;
  scale: number; // px per ms
  height?: number;
}

// Helper to iterate time units
function range(start:number, end:number, step:number, cb:(t:number)=>void){
  for(let t=start; t<=end; t+=step){ cb(t); }
}

const HOUR = 1000*60*60;
const DAY = HOUR*24;
const WEEK = DAY*7;

export const TimelineGrid: React.FC<TimelineGridProps> = ({ start, end, toX, scale, height=400 }) => {
  // Determine mode from px/hour; scale(px/ms)*msPerHour = px/hour
  const pxPerHour = scale * HOUR;
  let mode:'hour'|'day'|'week'|'month' = 'month';
  if (pxPerHour >= 6) mode='hour';
  else if (pxPerHour >= 0.25) mode='day';
  else if (pxPerHour >= 0.02) mode='week';
  else mode='month';

  const ticks = useMemo(() => {
    const res: { x:number; label?:string; major?:boolean }[] = [];
    const dateStart = new Date(start);
    const dateEnd = new Date(end);

    if (mode==='hour') {
      const step = HOUR; // every hour
      const s = new Date(dateStart); s.setMinutes(0,0,0);
      for (let t=s.getTime(); t<=end; t+=step){
        const d = new Date(t);
        const label = d.getHours()===0 ? d.toLocaleDateString(undefined,{ month:'short', day:'numeric'}) : String(d.getHours()).padStart(2,'0');
        res.push({ x: toX(t), label, major: d.getHours()===0 });
      }
    } else if (mode==='day') {
      const step = DAY;
      const s = new Date(dateStart); s.setHours(0,0,0,0);
      for (let t=s.getTime(); t<=end; t+=step){
        const d = new Date(t);
        const isWeekStart = d.getDay()===1; // Monday
        const label = d.getDate().toString();
        res.push({ x: toX(t), label: isWeekStart? label : undefined, major:isWeekStart });
      }
    } else if (mode==='week') {
      const step = WEEK;
      const s = new Date(dateStart); s.setHours(0,0,0,0);
      // align to Monday
      const day = s.getDay(); const diff = (day+6)%7; s.setDate(s.getDate()-diff);
      for (let t=s.getTime(); t<=end; t+=step){
        const d = new Date(t);
        const isMonthStart = d.getDate()<=7; // first week acts as month marker
        const label = isMonthStart? d.toLocaleString(undefined,{ month:'short'}).toUpperCase() : undefined;
        res.push({ x: toX(t), label, major:isMonthStart });
      }
    } else { // month
      const s = new Date(dateStart.getFullYear(), dateStart.getMonth(), 1);
      while (s.getTime() <= end){
        const t = s.getTime();
        const month = s.getMonth();
        const quarter = Math.floor(month/3)+1;
        const isQuarterStart = month % 3 === 0;
        const label = isQuarterStart ? `Q${quarter} ${s.getFullYear()}` : s.toLocaleString(undefined,{ month:'short'}).toUpperCase();
        res.push({ x: toX(t), label: isQuarterStart? label:undefined, major:isQuarterStart });
        s.setMonth(s.getMonth()+1);
      }
    }
    return res;
  }, [mode, start, end, toX]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {ticks.map((t,i) => (
        <div key={i} className="absolute top-0" style={{ left: t.x }}>
          <div className={`h-full w-px bg-border/30 ${t.major? 'bg-border/60':''}`} />
          {t.label && <div className={`text-[10px] font-medium mt-1 text-muted ${t.major? '':'opacity-60'}`}>{t.label}</div>}
        </div>
      ))}
    </div>
  );
};

export default TimelineGrid;
