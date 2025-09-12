import React from "react";
import { useContext } from "react";
import { CalendarStateContext as AriaCalendarStateContext } from "react-aria-components";
import { getLocalTimeZone } from "@internationalized/date";

function formatCalendarDate(date: any): string {
  if (!date) return "MM / DD / YYYY";
  try {
    const d = date.toDate ? date.toDate(getLocalTimeZone()) : null;
    if (!d) return "MM / DD / YYYY";
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm} / ${dd} / ${yyyy}`;
  } catch {
    return "MM / DD / YYYY";
  }
}

const SelectedDateDisplay: React.FC = () => {
  const state = useContext(AriaCalendarStateContext);
  const label = formatCalendarDate(state?.value);
  return (
    <div
      aria-label="Selected date"
      className="flex-1 text-left px-3 py-2 rounded-lg ring-1 ring-border/60 text-sm font-medium text-white/90 bg-transparent"
    >
      {label}
    </div>
  );
};

export default SelectedDateDisplay;
