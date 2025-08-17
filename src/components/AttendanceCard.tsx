import React, { useEffect, useMemo, useState } from "react";
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

// --- helpers to resolve theme colors ----------------------------------------
// These match your tailwind.config.js theme keys
const VAR_CANDIDATES: Record<string, Array<keyof typeof TAILWIND_COLORS>> = {
  line: ["accent"],
  card: ["surface"],
  border: ["border"],
  text: ["text"],
};
const TAILWIND_COLORS = {
  accent: '#64C7C9',
  surface: '#0F1B3A',
  border: '#24304F',
  text: '#FFFFFF',
  overlay: 'rgba(255,255,255,0.06)',
};
function resolveThemeColor(keys: Array<keyof typeof TAILWIND_COLORS>, fallback: string): string {
  for (const k of keys) {
    if (k in TAILWIND_COLORS) return TAILWIND_COLORS[k];
  }
  return fallback;
}
function withAlpha(rgb: string, alpha: number): string {
  if (rgb.startsWith("#")) {
    // Convert hex to rgba
    const bigint = parseInt(rgb.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (rgb.startsWith("rgb")) {
    return rgb.replace(/rgb\(([^)]+)\)/, `rgba($1,${alpha})`);
  }
  return rgb;
}

function DarkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl px-3 py-2 text-sm shadow-lg border" style={{ background: TAILWIND_COLORS.surface, borderColor: TAILWIND_COLORS.border, color: TAILWIND_COLORS.text }}>
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

  // Use theme colors from Tailwind config
  const theme = {
    line: resolveThemeColor(VAR_CANDIDATES.line, TAILWIND_COLORS.accent),
    card: resolveThemeColor(VAR_CANDIDATES.card, TAILWIND_COLORS.surface),
    border: resolveThemeColor(VAR_CANDIDATES.border, TAILWIND_COLORS.border),
    text: resolveThemeColor(VAR_CANDIDATES.text, TAILWIND_COLORS.text),
  };

  return (
    <div
      className={`relative max-w-[390px] w-full mx-auto rounded-2xl p-5 md:p-6 border bg-surface text-text border-border overflow-hidden h-full flex flex-col ${className ?? ""}`}
      style={{ background: theme.card, borderColor: theme.border, color: theme.text }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 min-w-0">
        <div>
          <div className="text-xs uppercase tracking-widest opacity-70">{title}</div>
          <div className="mt-1 text-xl font-bold leading-tight">{currentAttendance}</div>
          <div className="mt-1 text-[11px] opacity-70">{isMeetingDay ? "Today" : "Last meeting"}</div>
        </div>
        <div className="flex items-center gap-2">
      <button onClick={() => setView("week")} className={`px-1.5 py-0.5 rounded bg-white/10 text-xs border transition ${view === "week" ? "opacity-100" : "opacity-70 hover:opacity-100"}`} style={{ borderColor: theme.border }}>
        Week
      </button>
      <button onClick={() => setView("month")} className={`px-1.5 py-0.5 rounded bg-white/10 text-xs border transition ${view === "month" ? "opacity-100" : "opacity-70 hover:opacity-100"}`} style={{ borderColor: theme.border }}>
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
              <Tooltip content={<DarkTooltip />} cursor={{ stroke: withAlpha(theme.text, 0.06), strokeWidth: 20 }} />
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
              <Tooltip content={<DarkTooltip />} cursor={{ stroke: withAlpha(theme.text, 0.06), strokeWidth: 20 }} />
              <Area type="monotone" dataKey="present" stroke={theme.line} strokeWidth={3} fill="url(#attnGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </FadeAreaChart>
      </div>
    </div>
  );
}
