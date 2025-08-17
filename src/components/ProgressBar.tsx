export default function ProgressBar({ value, heightClass = "h-2", color }: { value: number; heightClass?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const barColor = color || 'linear-gradient(90deg,#64C7C9,#98D7D8)';
  return (
    <div className={`w-full ${heightClass} bg-brand-blue/30 rounded-full overflow-hidden`}>
      <div className="h-full transition-all" style={{ width: `${v}%`, background: barColor }} />
    </div>
  );
}
