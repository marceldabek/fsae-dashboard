import React, { useMemo, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import FadeAreaChart from "./FadeAreaChart";

// ---- demo data (replace with real) -----------------------------------------
const demoWeek = [
  { label: "Mon", present: 4 },
  { label: "Tue", present: 6 },
  { label: "Wed", present: 5 },
  { label: "Thu", present: 9 },
  { label: "Fri", present: 8 },
  { label: "Sat", present: 12 },
  { label: "Sun", present: 16 },
];
const demoMonth = Array.from({ length: 30 }).map((_, i) => ({ label: `${i + 1}` , present: Math.max(0, Math.round(5 + 6 * Math.sin(i/4))) }));

// --- theme helpers using CSS variables so light/dark swap automatically -----
const CSS_VARS = {
  // Use lighter blue from design-tokens.json: accent-weak (#98D7D8)
  line: '#98D7D8',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  text: 'hsl(var(--foreground))',
};

function DarkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2 text-sm shadow-lg border"
      style={{
        background: 'hsl(var(--card))',
        borderColor: 'hsl(var(--border))',
        color: 'hsl(var(--foreground))',
      }}
    >
      <div className="opacity-70">{p.label}</div>
      <div className="font-semibold">{p.present} present</div>
    </div>
  );
}

export type AttendanceCardProps = {
  weekData?: Array<{ label: string; present: number }>;
  monthData?: Array<{ label: string; present: number }>;
  className?: string;
  title?: string;
};

export default function AttendanceCard(props: AttendanceCardProps) {
  const {
    weekData = demoWeek,
    monthData = demoMonth,
    className,
    title = "Attendance",
  } = props;
  // Determine if today is a meeting day (Tue=2, Thu=4, Sat=6)
  const today = new Date();
  const isMeetingDay = [2, 4, 6].includes(today.getDay());
  const [view, setView] = useState<"week" | "month">("month");
  const data = view === "week" ? weekData : monthData;
  const currentAttendance = useMemo(() => (data.length ? data[data.length - 1].present : 0), [data]);

  // Colors follow current theme via CSS variables
  const theme = CSS_VARS;

  return (
    <div
      className={`relative max-w-[390px] w-full mx-auto rounded-2xl p-5 md:p-6 border bg-card dark:bg-surface text-foreground border-border overflow-hidden h-full flex flex-col ${className ?? ""}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 min-w-0">
        <div>
          <div className="text-xs uppercase tracking-widest opacity-70">{title}</div>
          <div className="mt-1 text-xl font-bold leading-tight">{currentAttendance}</div>
          <div className="mt-1 text-[11px] opacity-70">{isMeetingDay ? "Today" : "Last meeting"}</div>
        </div>
        <div className="flex items-center gap-2">
  <button onClick={() => setView("week")} className={`px-1 py-0.5 rounded bg-card/80 text-foreground border transition text-[11px] ${view === "week" ? "opacity-100" : "opacity-70 hover:opacity-100"}`} style={{ borderColor: theme.border }}>
        Week
      </button>
  <button onClick={() => setView("month")} className={`px-1 py-0.5 rounded bg-card/80 text-foreground border transition text-[11px] ${view === "month" ? "opacity-100" : "opacity-70 hover:opacity-100"}`} style={{ borderColor: theme.border }}>
        Month
      </button>
        </div>
      </div>

      {/* Chart row fills the rest, clipped, flex-1, min-h-0, min-w-0 */}
      <div className="mt-3 rounded-xl overflow-hidden flex-1 min-h-0 min-w-0 relative">
        <FadeAreaChart show={view === "week"}>
          <ResponsiveContainer width="100%" height="100%" className="block">
            <AreaChart
              data={weekData}
              margin={{ top: 8, right: 16, bottom: 8, left: 12 }}
            >
              <defs>
                <linearGradient id="attnGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.line} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={theme.line} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" hide />
              <YAxis hide domain={[0, (dataMax: number) => Math.max(10, dataMax * 1.15)]} />
              <CartesianGrid horizontal={false} vertical={false} />
              <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'hsl(var(--foreground) / 0.06)', strokeWidth: 20 }} />
              <Area type="monotone" dataKey="present" stroke={theme.line} strokeWidth={3} fill="url(#attnGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </FadeAreaChart>
        <FadeAreaChart show={view === "month"}>
          <ResponsiveContainer width="100%" height="100%" className="block">
            <AreaChart
              data={monthData}
              margin={{ top: 8, right: 16, bottom: 8, left: 12 }}
            >
              <defs>
                <linearGradient id="attnGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.line} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={theme.line} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" hide />
              <YAxis hide domain={[0, (dataMax: number) => Math.max(10, dataMax * 1.15)]} />
              <CartesianGrid horizontal={false} vertical={false} />
              <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'hsl(var(--foreground) / 0.06)', strokeWidth: 20 }} />
              <Area type="monotone" dataKey="present" stroke={theme.line} strokeWidth={3} fill="url(#attnGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </FadeAreaChart>
      </div>
    </div>
  );
}
