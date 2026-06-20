"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";

function supportsWebGL() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HazinaCanvas({
  children,
  fallback,
  className,
}: {
  children: ReactNode;
  fallback: ReactNode;
  className?: string;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const isSmallMobile = window.matchMedia("(max-width: 639px)").matches;
    setEnabled(!isSmallMobile && !prefersReducedMotion() && supportsWebGL());
  }, []);

  if (!enabled) {
    return <>{fallback}</>;
  }

  return (
    <Canvas
      className={className}
      dpr={[0.8, 1.1]}
      camera={{ position: [0, 0.68, 6.8], fov: 32 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
      performance={{ min: 0.5 }}
      fallback={fallback}
    >
      {children}
    </Canvas>
  );
}
