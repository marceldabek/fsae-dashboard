import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

type CalendarProps = {
  className?: string;
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
};

export function Calendar({ className, selected, onSelect }: CalendarProps) {
  return (
    <DayPicker
      mode="single"
      selected={selected}
      defaultMonth={selected ?? new Date()}
      showOutsideDays
      onSelect={onSelect}
  className={cn("rdp rdp-compact rdp-fsae text-sm m-0", className)}
      classNames={{
        caption: "relative grid place-items-center py-2",
        caption_label: "font-medium text-center",
        nav: "absolute inset-0 flex items-center justify-between px-1",
        head_cell: "w-10 text-center text-xs text-muted-foreground",
        cell: "p-0",
  day: "h-10 w-10 rounded-2xl flex flex-col items-center justify-center transition hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-0",
        day_selected: "bg-primary/20",
        day_today: "relative",
  nav_button: "rounded-full focus:outline-none focus-visible:outline-none focus-visible:ring-0 hover:bg-accent/10",
        month: "rounded-2xl p-0",
      }}
    />
  );
}
