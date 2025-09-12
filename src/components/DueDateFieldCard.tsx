import React, { useEffect, useMemo, useRef, useState } from "react";
import { type DateValue, DatePicker as AriaDatePicker, Dialog as AriaDialog } from "react-aria-components";
import { Calendar } from "@/components/application/date-picker/calendar";
import { getLocalTimeZone, today, fromDate, toCalendarDate } from "@internationalized/date";

type Props = {
  label?: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
};

export default function DueDateFieldCard({ label = "Due date", value, onChange }: Props) {
  const tz = getLocalTimeZone();

  // Use CalendarDate (date-only) rather than ZonedDateTime to avoid invalid native input values
  const initialDV: DateValue | null = useMemo(() => (value ? toCalendarDate(fromDate(value, tz)) : null), [value, tz]);
  const [pending, setPending] = useState<DateValue | null>(initialDV);
  const syncingFromParent = useRef(false);

  // Keep internal state in sync if parent value changes (e.g., when opening Edit modal)
  useEffect(() => {
    // Only update if the day actually changed; prevents jitter
    const fmt = (dv: DateValue | null) => (dv ? dv.toDate(tz).toISOString().slice(0, 10) : "");
    if (fmt(pending) === fmt(initialDV)) return;
    syncingFromParent.current = true;
    setPending(initialDV);
  }, [initialDV, tz]);

  // Immediately propagate selection to parent when user changes it, but ignore updates coming from parent sync
  useEffect(() => {
    if (syncingFromParent.current) { syncingFromParent.current = false; return; }
    if (pending) onChange(pending.toDate(tz)); else onChange(null);
  }, [pending, tz, onChange]);
  const setToday = () => setPending(today(tz)); // today() returns a CalendarDate (date-only)

  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
  <div className="mt-2 rounded-2xl overflow-hidden bg-surface ring-1 ring-white/50 shadow-xs text-white">
        <AriaDatePicker aria-label="Calendar card" value={pending} onChange={setPending} shouldCloseOnSelect={false} granularity="day">
          <AriaDialog className="outline-none">
            <div className="flex px-4 py-3">
      <Calendar theme="white" />
            </div>
          </AriaDialog>
        </AriaDatePicker>
      </div>
    </div>
  );
}
