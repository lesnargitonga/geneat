"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import clsx from "clsx";

export function FloatingSurface({
  children,
  className,
  depth = "soft",
}: {
  children: ReactNode;
  className?: string;
  depth?: "soft" | "strong";
}) {
  return (
    <motion.div
      className={clsx("floating-surface", `floating-surface--${depth}`, className)}
      initial={{ opacity: 0, y: 20, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
