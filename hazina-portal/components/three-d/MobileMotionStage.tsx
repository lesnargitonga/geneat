"use client";

import { useEffect, useState } from "react";
import { HeroGiftStageLoader } from "@/components/three-d/HeroGiftStageLoader";
import {
  HAZINA_STAGE_MOTION_STATE_EVENT,
  type StageMotionStateDetail,
} from "@/lib/showroom";

export function MobileMotionStage() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const updateMotionState = (event: Event) => {
      setEnabled(
        (event as CustomEvent<StageMotionStateDetail>).detail.enabled,
      );
    };

    window.addEventListener(HAZINA_STAGE_MOTION_STATE_EVENT, updateMotionState);
    return () => window.removeEventListener(HAZINA_STAGE_MOTION_STATE_EVENT, updateMotionState);
  }, []);

  if (!enabled) return null;

  return (
    <div className="mobile-motion-stage" aria-hidden="true">
      <HeroGiftStageLoader mobileMotionEnabled />
    </div>
  );
}
