import React, { useEffect, useRef } from "react";

export default function FadeAreaChart({ show, children }: { show: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (show) {
      ref.current.style.opacity = "1";
      ref.current.style.transform = "translateY(0)";
      ref.current.style.pointerEvents = "auto";
    } else {
      ref.current.style.opacity = "0";
      ref.current.style.transform = "translateY(20px)";
      ref.current.style.pointerEvents = "none";
    }
  }, [show]);
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        transition: "opacity 0.4s, transform 0.4s",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(20px)",
        pointerEvents: show ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}
