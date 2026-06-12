"use client";

import clsx from "clsx";
import { motion, useScroll, useTransform } from "framer-motion";
import { type ReactNode, useRef } from "react";

const toneClass = {
  light: "showroom-scene--light",
  dark: "showroom-scene--dark",
} as const;

export function ShowroomScene({
  children,
  className,
  contentClassName,
  depth = 34,
  tone = "light",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  depth?: number;
  tone?: "light" | "dark";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [depth, 0, -depth]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.985, 1, 0.99]);
  const lightX = useTransform(scrollYProgress, [0, 1], ["-16%", "18%"]);

  return (
    <section
      ref={ref}
      className={clsx("showroom-scene", toneClass[tone], className)}
    >
      <motion.div className="showroom-scene__light" style={{ x: lightX }} aria-hidden="true" />
      <motion.div
        className={clsx("showroom-scene__content", contentClassName)}
        style={{ y, scale }}
      >
        {children}
      </motion.div>
    </section>
  );
}
