"use client";

import { type MouseEvent, type ReactNode, useRef } from "react";
import clsx from "clsx";

export function SpatialCard({
  children,
  className,
  contentClassName,
  intensity = "medium",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  intensity?: "soft" | "medium";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const maxX = intensity === "soft" ? 3.5 : 5.5;
  const maxY = intensity === "soft" ? 4.5 : 7;

  function onMove(event: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--spatial-rx", `${-y * maxX}deg`);
    el.style.setProperty("--spatial-ry", `${x * maxY}deg`);
    el.style.setProperty("--spatial-mx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--spatial-my", `${(y + 0.5) * 100}%`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--spatial-rx", "0deg");
    el.style.setProperty("--spatial-ry", "0deg");
    el.style.setProperty("--spatial-mx", "50%");
    el.style.setProperty("--spatial-my", "50%");
  }

  return (
    <div className={clsx("spatial-card-scene", className)} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div ref={ref} className="spatial-panel spatial-card-surface">
        <div className="spatial-card-glow" />
        <div className={clsx("spatial-card-content", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
