"use client";

import { motion } from "framer-motion";
import { Children, type ReactNode } from "react";
import clsx from "clsx";

export function RevealGroup({
  children,
  className,
  itemClassName,
  delay = 0,
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  delay?: number;
  stagger?: number;
}) {
  const items = Children.toArray(children);

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.12 }}
      variants={{
        hidden: {},
        visible: { transition: { delayChildren: delay, staggerChildren: stagger } },
      }}
    >
      {items.map((item, index) => (
        <motion.div
          key={index}
          className={clsx("reveal-group-item", itemClassName)}
          variants={{
            hidden: { opacity: 0, y: 24, scale: 0.985 },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          {item}
        </motion.div>
      ))}
    </motion.div>
  );
}
