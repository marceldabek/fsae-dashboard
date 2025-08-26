import { cn } from "@/lib/utils";

type ProgressBarProps = {
  value: number;
  heightClass?: string;
  color?: string;               // optional: override fill
  track?: "neutral" | "accent"; // neutral = like the switch, accent = faint blue track
};

export default function ProgressBar({
  value,
  heightClass = "h-2",
  color,
  track = "neutral",
}: ProgressBarProps) {
  const v = Math.max(0, Math.min(100, Math.round(value)));

  // Fill uses your accent → light-accent gradient by default
  const fill = color ?? "linear-gradient(90deg, hsl(var(--accent)), #98D7D8)";

  // Track like the new switch (default), or faint accent if you prefer
  const trackClass = track === "neutral" ? "bg-black/15 dark:bg-white/15" : "";
  const trackStyle =
    track === "accent" ? { backgroundColor: "rgba(152,215,216,0.20)" } : undefined;

  return (
    <div
      className={cn("w-full rounded-full overflow-hidden", heightClass, trackClass)}
      style={trackStyle}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full transition-[width] duration-300 ease-out"
        style={{ width: `${v}%`, background: fill }}
      />
    </div>
  );
}
