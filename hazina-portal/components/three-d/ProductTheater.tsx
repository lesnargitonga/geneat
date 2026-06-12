"use client";

import Link from "next/link";
import clsx from "clsx";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { CatalogImage } from "@/components/CatalogImage";

type TheaterHighlight = {
  label: string;
  value?: string;
  href?: string;
};

export function ProductTheater({
  image,
  fallbackImage,
  alt,
  name,
  highlights = [],
  eyebrow = "Private collection theater",
  className,
}: {
  image?: string | null;
  fallbackImage?: string | null;
  alt: string;
  name: string;
  highlights?: TheaterHighlight[];
  eyebrow?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const backplateY = useTransform(scrollYProgress, [0, 1], [22, -18]);
  const imageY = useTransform(scrollYProgress, [0, 1], [12, -10]);

  return (
    <motion.div
      ref={ref}
      className={clsx("product-theater spatial-panel depth-shadow-strong", className)}
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div className="product-theater__backplate" style={{ y: backplateY }} />
      <div className="product-theater__rail product-theater__rail--top" />
      <div className="product-theater__rail product-theater__rail--side" />
      <motion.div className="product-theater__image" style={{ y: imageY }}>
        <CatalogImage
          src={image}
          fallbackSrc={fallbackImage}
          alt={alt}
          tone="warm"
          fit="cover"
          className="h-full w-full"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </motion.div>
      {highlights.length > 0 && (
        <div className="product-theater__chips" aria-label="Collection contents">
          {highlights.slice(0, 5).map((item, index) => {
            const chip = (
              <>
                <span className="product-theater__chip-index">{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <span className="product-theater__chip-label">{item.label}</span>
                  {item.value && <span className="product-theater__chip-value">{item.value}</span>}
                </span>
              </>
            );
            return item.href ? (
              <motion.div
                key={`${item.label}-${index}`}
                className="product-theater__chip-wrap"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.24 + index * 0.07 }}
              >
                <Link href={item.href} className="product-theater__chip">
                  {chip}
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key={`${item.label}-${index}`}
                className="product-theater__chip-wrap"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.24 + index * 0.07 }}
              >
                <span className="product-theater__chip">{chip}</span>
              </motion.div>
            );
          })}
        </div>
      )}
      <div className="product-theater__caption">
        <span className="label-mono text-bronze-light">{eyebrow}</span>
        <p className="mt-1 font-serif text-2xl leading-tight text-white">{name}</p>
      </div>
    </motion.div>
  );
}
