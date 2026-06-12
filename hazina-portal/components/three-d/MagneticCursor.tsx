"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type CursorMode = {
  visible: boolean;
  magnetic: boolean;
  pressed: boolean;
};

const ENABLE_QUERY = "(hover: hover) and (pointer: fine) and (min-width: 1200px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const TARGET_SELECTOR = '[data-cursor="magnetic"]';
const NATIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable="true"]',
  '[data-cursor="native"]',
  ".collection-order-desk__control",
  ".collection-order-desk .chip",
  ".concierge-textarea",
].join(", ");

const restingMode: CursorMode = {
  visible: false,
  magnetic: false,
  pressed: false,
};

function useDesktopCursorEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia(ENABLE_QUERY);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setEnabled(desktop.matches && !reducedMotion.matches);

    update();
    desktop.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);

    return () => {
      desktop.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, []);

  return enabled;
}

export function MagneticCursor() {
  const enabled = useDesktopCursorEnabled();
  const cursorX = useMotionValue(-80);
  const cursorY = useMotionValue(-80);
  const springX = useSpring(cursorX, { stiffness: 220, damping: 28, mass: 0.32 });
  const springY = useSpring(cursorY, { stiffness: 220, damping: 28, mass: 0.32 });
  const modeRef = useRef<CursorMode>(restingMode);
  const [mode, setMode] = useState<CursorMode>(restingMode);

  useEffect(() => {
    if (!enabled) {
      modeRef.current = restingMode;
      setMode(restingMode);
      return;
    }

    const updateMode = (patch: Partial<CursorMode>) => {
      const next = { ...modeRef.current, ...patch };
      const previous = modeRef.current;

      if (
        next.visible !== previous.visible ||
        next.magnetic !== previous.magnetic ||
        next.pressed !== previous.pressed
      ) {
        modeRef.current = next;
        setMode(next);
      }
    };

    const hideCursor = () => updateMode({ visible: false, magnetic: false, pressed: false });

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        hideCursor();
        return;
      }

      const source = event.target instanceof Element ? event.target : null;
      cursorX.set(event.clientX);
      cursorY.set(event.clientY);

      if (!source || source.closest(NATIVE_SELECTOR)) {
        updateMode({ visible: false, magnetic: false });
        return;
      }

      const target = source.closest<HTMLElement>(TARGET_SELECTOR);
      if (!target) {
        updateMode({ visible: true, magnetic: false });
        return;
      }

      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const pull = Number(target.dataset.cursorPull || 0.22);

      cursorX.set(event.clientX + (centerX - event.clientX) * pull);
      cursorY.set(event.clientY + (centerY - event.clientY) * pull);
      updateMode({ visible: true, magnetic: true });
    };

    const handlePointerDown = () => updateMode({ pressed: true });
    const handlePointerUp = () => updateMode({ pressed: false });
    const handleVisibilityChange = () => {
      if (document.hidden) hideCursor();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });
    window.addEventListener("pointerleave", hideCursor);
    window.addEventListener("blur", hideCursor);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("pointerleave", hideCursor);
      window.removeEventListener("blur", hideCursor);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cursorX, cursorY, enabled]);

  if (!enabled) return null;

  return (
    <motion.div className="magnetic-cursor__anchor" style={{ x: springX, y: springY }} aria-hidden="true">
      <motion.div
        className="magnetic-cursor"
        animate={{
          height: mode.magnetic ? 34 : 16,
          opacity: mode.visible ? (mode.magnetic ? 0.52 : 0.4) : 0,
          scale: mode.pressed ? 0.82 : 1,
          width: mode.magnetic ? 34 : 16,
        }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 26,
          mass: 0.34,
        }}
      />
    </motion.div>
  );
}
