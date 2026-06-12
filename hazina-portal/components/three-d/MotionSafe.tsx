"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import clsx from "clsx";

type Entrance = "up" | "left" | "right" | "scale";

const entranceState: Record<Entrance, { x?: number; y?: number; scale?: number }> = {
  up: { y: 24 },
  left: { x: -24 },
  right: { x: 24 },
  scale: { scale: 0.975 },
};

export function MotionSafe({
  children,
  className,
  delay = 0,
  entrance = "up",
  amount = 0.18,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  entrance?: Entrance;
  amount?: number;
}) {
  return (
    <motion.div
      className={clsx("motion-safe-layer", className)}
      initial={{ opacity: 0, ...entranceState[entrance] }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.68, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
