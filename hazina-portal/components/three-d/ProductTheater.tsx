"use client";

import Image from "next/image";
import clsx from "clsx";

export function ProductTheater({
  image,
  alt,
  name,
  eyebrow = "Private collection theater",
  className,
}: {
  image: string;
  alt: string;
  name: string;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={clsx("product-theater spatial-panel depth-shadow-strong", className)}>
      <div className="product-theater__backplate" />
      <div className="product-theater__image">
        <Image src={image} alt={alt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
      </div>
      <div className="product-theater__caption">
        <span className="label-mono text-bronze-light">{eyebrow}</span>
        <p className="mt-1 font-serif text-2xl leading-tight text-white">{name}</p>
      </div>
    </div>
  );
}
