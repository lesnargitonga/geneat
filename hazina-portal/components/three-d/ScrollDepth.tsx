"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { type ReactNode, useRef } from "react";
import clsx from "clsx";

export function ScrollDepth({
  children,
  className,
  y = 32,
  scale = 1.03,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  scale?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const translateY = useTransform(scrollYProgress, [0, 1], [0, y]);
  const zoom = useTransform(scrollYProgress, [0, 1], [scale, 1]);

  return (
    <motion.div
      ref={ref}
      className={clsx("spatial-layer", className)}
      style={{ y: translateY, scale: zoom }}
    >
      {children}
    </motion.div>
  );
}
