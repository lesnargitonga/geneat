"use client";

import dynamic from "next/dynamic";

function GiftStageFallback() {
  return (
    <div className="spatial-stage hero-gift-stage" aria-hidden="true">
      <div className="hero-gift-fallback spatial-panel depth-shadow-strong">
        <div className="hero-gift-fallback__lid" />
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

export function HeroGiftStageLoader() {
  return <LazyHeroGiftStage />;
}
