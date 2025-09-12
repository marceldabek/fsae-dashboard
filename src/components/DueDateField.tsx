import * as React from 'react';
import { DatePicker, Label, Group, Button as RACButton, Popover, Calendar } from 'react-aria-components';
import { DateInput } from './application/date-picker/date-input';
import { CalendarDate, getLocalTimeZone, parseDate } from '@internationalized/date';

export interface DueDateFieldProps {
  value: CalendarDate | null;
  onChange: (v: CalendarDate | null) => void;
  todayShortcut?: boolean;
  id?: string; // optional external id
  className?: string;
}

// Utility to convert persisted string (YYYY-MM-DD) to CalendarDate safely
export function toCalendarDate(raw: string | null | undefined): CalendarDate | null {
  if (!raw) return null;
  try { return parseDate(raw); } catch { return null; }
}

export function calendarDateToISO(val: CalendarDate | null): string | null {
  if (!val) return null;
  // CalendarDate#toString() yields YYYY-MM-DD which is fine to persist
  return val.toString();
}

export const DueDateField: React.FC<DueDateFieldProps> = ({ value, onChange, todayShortcut = true, id, className }) => {
  const labelId = React.useId();
  // Provide both temporarily to guarantee a name; can remove aria-label later.
  return (
    <DatePicker
      aria-label="Due date"
      aria-labelledby={labelId}
      granularity="day"
      value={value ?? undefined}
      onChange={(val: any) => {
        // RAC sends undefined when cleared
        if (!val) onChange(null); else onChange(val as CalendarDate);
      }}
      className={className}
    >
      <Label id={labelId} className="text-xs font-medium text-foreground/80">Due date</Label>
      <Group className="flex items-center gap-2 rounded-md border border-input px-2 py-1">
  <DateInput className="flex-1" aria-label="Due date input" />
        {todayShortcut && (
          <RACButton slot="picker" onPress={() => onChange(parseDate(new Date().toISOString().slice(0,10)))} className="text-xs px-2 py-1 rounded bg-accent text-white">
            Today
          </RACButton>
        )}
      </Group>
      <Popover className="rounded-md border border-input bg-popover shadow-md p-2">
        <Calendar />
        {todayShortcut && (
          <RACButton onPress={() => onChange(parseDate(new Date().toISOString().slice(0,10)))} className="mt-2 w-full text-xs px-2 py-1 rounded bg-accent text-white">Set Today</RACButton>
        )}
      </Popover>
    </DatePicker>
  );
};
