import React, { useId, useRef } from 'react';
import { format } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/base/buttons/button';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import { Calendar } from '@/components/ui/calendar';

interface DueDateFieldProps {
  value: Date | null;
  onChange: (d: Date | null) => void;
  label?: string;
  inline?: boolean; // inline calendar vs popover
  originalValue?: Date | null; // for tooltip of previous value
}

export const DueDateField: React.FC<DueDateFieldProps> = ({ value, onChange, label = 'Due date', inline = true, originalValue }) => {
  const id = useId();
  const originalRef = useRef<Date | null>(value);
  if (originalRef.current == null && value) originalRef.current = value; // capture first non-null once
  const previous = originalValue ?? originalRef.current ?? null;
  const setToday = () => onChange(new Date());
  const display = value ? format(value, 'M / d / yyyy') : '';
  const prevText = previous ? `Previously: ${format(previous, 'M / d / yyyy')}` : null;

  const inputElement = (
    <input
      readOnly
      value={display}
      placeholder="MM / DD / YYYY"
      className="h-10 flex-1 px-3 rounded-2xl border border-input bg-transparent text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      aria-labelledby={id}
      onClick={() => {/* open popover if implemented */}}
    />
  );

  const maybeWrappedInput = prevText ? (
    <Tooltip title={prevText} delay={300}>
      <TooltipTrigger>{inputElement}</TooltipTrigger>
    </Tooltip>
  ) : inputElement;

  const InputRow = (
    <div role="group" aria-labelledby={id} className="flex items-center gap-2">
      {maybeWrappedInput}
      <Button
        type="button"
        color="tertiary"
        onClick={setToday}
        className="h-10 px-3 rounded-2xl border border-border/50 bg-accent/10 text-accent hover:bg-accent/15 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 before:border-0 text-sm"
      >
        Today
      </Button>
      {!inline && (
        <PopoverTrigger asChild>
          <Button type="button" className="h-10 px-2 rounded-2xl text-sm" color="secondary">
            <span role="img" aria-hidden>📅</span>
          </Button>
        </PopoverTrigger>
      )}
    </div>
  );

  return (
    <div>
      <label id={id} className="text-xs text-muted-foreground">{label}</label>
      {inline ? (
        <>
          {InputRow}
          <div className="mt-2 rounded-2xl border border-border/50 bg-background/30 p-0.5">
            <Calendar
              selected={value ?? undefined}
              onSelect={(d) => onChange(d ?? null)}
            />
          </div>
        </>
      ) : (
        <Popover>
          {InputRow}
          <PopoverContent className="w-auto p-1 rounded-2xl border border-border/50 bg-background/95 backdrop-blur">
            <Calendar
              selected={value ?? undefined}
              onSelect={(d) => onChange(d ?? null)}
            />
            <div className="mt-2">
              <Button
                type="button"
                color="tertiary"
                onClick={setToday}
                className="h-10 px-3 rounded-2xl border border-border/50 bg-accent/10 text-accent hover:bg-accent/15 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 before:border-0 w-full text-sm"
              >
                Today
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
