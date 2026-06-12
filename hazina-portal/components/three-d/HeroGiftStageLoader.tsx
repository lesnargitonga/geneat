"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

export function GiftStageFallback() {
  return (
    <div className="spatial-stage hero-gift-stage" aria-hidden="true">
      <div className="hero-gift-fallback spatial-panel depth-shadow-strong">
        <div className="hero-gift-fallback__lid" />
        <div className="hero-gift-fallback__ribbon hero-gift-fallback__ribbon--vertical" />
        <div className="hero-gift-fallback__ribbon hero-gift-fallback__ribbon--horizontal" />
        <div className="hero-gift-fallback__card" />
      </div>
    </div>
  );
}

const LazyHeroGiftStage = dynamic(
  () => import("./HeroGiftStage").then((mod) => mod.HeroGiftStage),
  {
    ssr: false,
    loading: () => <GiftStageFallback />,
  },
);

export function HeroGiftStageLoader({ revealing = false }: { revealing?: boolean }) {
  const [canLoadCanvas, setCanLoadCanvas] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const update = () => setCanLoadCanvas(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!canLoadCanvas) {
    return <GiftStageFallback />;
  }

  return <LazyHeroGiftStage revealing={revealing} />;
}
