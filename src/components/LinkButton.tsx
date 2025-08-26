
export default function LinkButton({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer"
  className="inline-flex items-center px-3 py-1.5 rounded bg-card/80 hover:bg-card transition">
      {children}
    </a>
  );
}
