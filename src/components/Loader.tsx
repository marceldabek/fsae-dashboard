// Simple animated loader for Suspense fallback
export default function Loader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[120px] w-full">
  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent mb-2" />
  <div className="text-xs text-muted uppercase tracking-caps">Loading…</div>
    </div>
  );
}
