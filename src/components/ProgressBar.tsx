export default function ProgressBar({ value, heightClass = "h-2" }: { value: number; heightClass?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`w-full ${heightClass} bg-white/20 rounded-full overflow-hidden`}>
      <div className="h-full bg-white/80 transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}
