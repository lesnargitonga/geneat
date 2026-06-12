"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import clsx from "clsx";

export function SpatialPage({
  children,
  className,
  ambient = false,
}: {
  children: ReactNode;
  className?: string;
  ambient?: boolean;
}) {
  return (
    <motion.div
      className={clsx("showroom-page", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      {ambient && <div className="showroom-ambient" aria-hidden="true" />}
      <div className="showroom-page__content">{children}</div>
    </motion.div>
  );
}
