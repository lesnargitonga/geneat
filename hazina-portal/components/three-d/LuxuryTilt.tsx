"use client";

import { type MouseEvent, type ReactNode, useRef } from "react";
import clsx from "clsx";

export function LuxuryTilt({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function onMove(event: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    el.style.setProperty("--rx", `${-y * 7}deg`);
    el.style.setProperty("--ry", `${x * 9}deg`);
    el.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--my", `${(y + 0.5) * 100}%`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");
  }

  return (
    <div
      className={clsx("luxury-3d-scene", className)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div ref={ref} className="luxury-3d-card">
        <div className="luxury-3d-glow" />
        <div className="luxury-3d-content">{children}</div>
      </div>
    </div>
  );
}
