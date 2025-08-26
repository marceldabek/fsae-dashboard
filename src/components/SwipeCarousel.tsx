import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export default function SwipeCarousel({
  children,
  slideIndexInitial = 0,
  onIndexChange,
  dots = true,
  frameClassName,
}: {
  children: ReactNode[] | ReactNode;
  slideIndexInitial?: number;
  onIndexChange?: (i: number) => void;
  dots?: boolean;
  frameClassName?: string;
}) {
  const slides = Array.isArray(children) ? children : [children];
  const [index, setIndex] = useState(slideIndexInitial);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ startX: 0, currentX: 0, dragging: false, width: 0 });

  useEffect(() => { onIndexChange?.(index); }, [index]);

  const snapTo = (i: number, animate = true) => {
    const frame = frameRef.current; const inner = innerRef.current; if (!frame || !inner) return;
    const width = frame.clientWidth;
    pos.current.width = width;
    inner.style.transition = animate ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
    inner.style.transform = `translateX(${-i * width}px)`;
  };

  const begin = (clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    pos.current = { startX: clientX, currentX: clientX, dragging: true, width: frame.clientWidth };
  };
  const move = (clientX: number) => {
    if (!pos.current.dragging) return;
    pos.current.currentX = clientX;
    const dx = clientX - pos.current.startX;
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.transition = "none";
    inner.style.transform = `translateX(${dx - index * pos.current.width}px)`;
  };
  const end = () => {
    if (!pos.current.dragging) return;
    const dx = pos.current.currentX - pos.current.startX;
    const threshold = Math.max(40, pos.current.width * 0.2);
    let next = index;
    if (dx > threshold) next = Math.max(0, index - 1);
    else if (dx < -threshold) next = Math.min(slides.length - 1, index + 1);
    snapTo(next, true);
    setIndex(next);
    pos.current.dragging = false;
  };

  const onTouchStart = (e: React.TouchEvent) => begin(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => move(e.touches[0].clientX);
  const onTouchEnd = () => end();
  const onMouseDown = (e: React.MouseEvent) => { e.preventDefault(); begin(e.clientX); };
  const onMouseMove = (e: React.MouseEvent) => move(e.clientX);
  const onMouseUp = () => end();
  const onMouseLeave = () => end();

  // snap to index on resize
  useEffect(() => {
    const handle = () => {
      snapTo(index, false);
    };
    window.addEventListener("resize", handle);
    handle();
    return () => window.removeEventListener("resize", handle);
  }, [index]);

  // animate when index changes via dots
  useEffect(() => {
    snapTo(index, true);
  }, [index]);

  return (
    <div className="w-full select-none">
      <div
        ref={frameRef}
        className={`relative overflow-hidden rounded-2xl ${frameClassName || ""}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
    <div ref={innerRef} className="flex" style={{ willChange: "transform" }}>
          {slides.map((child, i) => (
      <div key={i} className="w-full shrink-0 px-1">
              {child}
            </div>
          ))}
        </div>
        {dots && (
          <div className="mt-3 mb-2 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Show slide ${i + 1}`}
                className={`w-2.5 h-2.5 rounded-full border border-border transition ${index === i ? "bg-foreground" : "bg-muted-foreground/40 hover:bg-foreground/70"}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
