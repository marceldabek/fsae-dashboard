
export default function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
      <div className="h-full bg-white/80 transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}
