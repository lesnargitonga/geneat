"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HAZINA_STAGE_MOTION_STATE_EVENT,
  HAZINA_STAGE_ORIENTATION_EVENT,
  type StageMotionStateDetail,
  type StageOrientationDetail,
} from "@/lib/showroom";

type MotionState = "idle" | "requesting" | "starting" | "active" | "denied" | "unavailable";

type DeviceOrientationPermissionConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const SENSOR_START_TIMEOUT_MS = 3200;

function dispatchMotionState(enabled: boolean) {
  window.dispatchEvent(
    new CustomEvent<StageMotionStateDetail>(HAZINA_STAGE_MOTION_STATE_EVENT, {
      detail: { enabled },
    }),
  );
}

function dispatchOrientation(detail: StageOrientationDetail) {
  window.dispatchEvent(
    new CustomEvent<StageOrientationDetail>(HAZINA_STAGE_ORIENTATION_EVENT, {
      detail,
    }),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function MobileMotionControl() {
  const [eligible, setEligible] = useState(false);
  const [state, setState] = useState<MotionState>("idle");
  const baselineRef = useRef<{ beta: number; gamma: number } | null>(null);
  const listeningRef = useRef(false);
  const sensorTimeoutRef = useRef<number | null>(null);
  const receivedSensorEventRef = useRef(false);

  const clearSensorTimeout = useCallback(() => {
    if (sensorTimeoutRef.current === null) return;
    window.clearTimeout(sensorTimeoutRef.current);
    sensorTimeoutRef.current = null;
  }, []);

  const handleOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;

      if (!baselineRef.current) {
        baselineRef.current = { beta: event.beta, gamma: event.gamma };
      }

      if (!receivedSensorEventRef.current) {
        receivedSensorEventRef.current = true;
        clearSensorTimeout();
        setState("active");
      }

      const betaDelta = event.beta - baselineRef.current.beta;
      const gammaDelta = event.gamma - baselineRef.current.gamma;

      dispatchOrientation({
        active: true,
        x: clamp(gammaDelta / 22, -1, 1),
        y: clamp(betaDelta / 18, -1, 1),
      });
    },
    [clearSensorTimeout],
  );

  const stopSensor = useCallback(
    (nextState: MotionState = "idle") => {
      clearSensorTimeout();
      if (listeningRef.current) {
        window.removeEventListener("deviceorientation", handleOrientation);
      }
      listeningRef.current = false;
      receivedSensorEventRef.current = false;
      baselineRef.current = null;
      dispatchOrientation({ active: false, x: 0, y: 0 });
      dispatchMotionState(false);
      setState(nextState);
    },
    [clearSensorTimeout, handleOrientation],
  );

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 639px) and (pointer: coarse)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateEligibility = () => {
      const supported = typeof window.DeviceOrientationEvent !== "undefined";
      const nextEligible = mobileQuery.matches && !motionQuery.matches && supported;
      setEligible(nextEligible);
      if (!nextEligible && listeningRef.current) stopSensor("idle");
    };

    updateEligibility();
    mobileQuery.addEventListener("change", updateEligibility);
    motionQuery.addEventListener("change", updateEligibility);

    return () => {
      mobileQuery.removeEventListener("change", updateEligibility);
      motionQuery.removeEventListener("change", updateEligibility);
    };
  }, [stopSensor]);

  useEffect(() => {
    const resetBaseline = () => {
      baselineRef.current = null;
      dispatchOrientation({ active: listeningRef.current, x: 0, y: 0 });
    };

    const handleVisibility = () => {
      if (document.hidden) resetBaseline();
    };

    window.addEventListener("orientationchange", resetBaseline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("orientationchange", resetBaseline);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearSensorTimeout();
      if (listeningRef.current) {
        window.removeEventListener("deviceorientation", handleOrientation);
        dispatchOrientation({ active: false, x: 0, y: 0 });
        dispatchMotionState(false);
      }
    };
  }, [clearSensorTimeout, handleOrientation]);

  const enableSensor = async () => {
    if (state === "active") {
      stopSensor();
      return;
    }

    if (!window.isSecureContext) {
      setState("unavailable");
      return;
    }

    setState("requesting");
    const OrientationEvent = window.DeviceOrientationEvent as
      | DeviceOrientationPermissionConstructor
      | undefined;

    if (!OrientationEvent) {
      setState("unavailable");
      return;
    }

    try {
      if (typeof OrientationEvent.requestPermission === "function") {
        const permission = await OrientationEvent.requestPermission();
        if (permission !== "granted") {
          setState("denied");
          return;
        }
      }

      baselineRef.current = null;
      receivedSensorEventRef.current = false;
      listeningRef.current = true;
      window.addEventListener("deviceorientation", handleOrientation, { passive: true });
      dispatchMotionState(true);
      setState("starting");
      sensorTimeoutRef.current = window.setTimeout(() => {
        if (!receivedSensorEventRef.current) stopSensor("unavailable");
      }, SENSOR_START_TIMEOUT_MS);
    } catch {
      stopSensor("denied");
    }
  };

  if (!eligible) return null;

  const label =
    state === "active"
      ? "Motion on"
      : state === "requesting" || state === "starting"
        ? "Starting motion"
        : state === "denied"
          ? "Motion denied"
          : state === "unavailable"
            ? "Motion unavailable"
            : "Enable motion";

  return (
    <button
      type="button"
      className={`mobile-motion-control mobile-motion-control--${state}`}
      data-cursor="native"
      data-motion-state={state}
      disabled={state === "requesting" || state === "starting" || state === "denied" || state === "unavailable"}
      aria-pressed={state === "active"}
      onClick={enableSensor}
    >
      <span className="mobile-motion-control__indicator" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
