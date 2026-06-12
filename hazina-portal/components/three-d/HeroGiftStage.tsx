"use client";

import { ContactShadows, Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { MathUtils, type Group } from "three";
import { HazinaCanvas } from "./HazinaCanvas";
import { FloatingTreasure } from "./FloatingTreasure";

const BASE_STAGE_POSITION = { x: 0.1, y: -0.18, z: 0 };
const BASE_STAGE_ROTATION_X = -0.08;

type StageDragDetail = {
  phase: "start" | "move" | "end";
  dx: number;
  dy: number;
};

function usePrefersReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduceMotion;
}

function GiftScene() {
  const reduceMotion = usePrefersReducedMotion();
  const stageRef = useRef<Group | null>(null);
  const targetPointer = useRef({ x: 0, y: 0 });
  const smoothPointer = useRef({ x: 0, y: 0 });
  const targetDrag = useRef({ x: 0, y: 0 });
  const smoothDrag = useRef({ x: 0, y: 0 });
  const dragVelocity = useRef({ x: 0, y: 0 });
  const lastDrag = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  useEffect(() => {
    if (reduceMotion) return;

    const resetPointer = () => {
      targetPointer.current.x = 0;
      targetPointer.current.y = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      targetPointer.current.x = MathUtils.clamp(
        (event.clientX / window.innerWidth - 0.5) * 2,
        -1,
        1,
      );
      targetPointer.current.y = MathUtils.clamp(
        (event.clientY / window.innerHeight - 0.5) * 2,
        -1,
        1,
      );
    };

    const onVisibilityChange = () => {
      if (document.hidden) resetPointer();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", resetPointer);
    window.addEventListener("blur", resetPointer);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", resetPointer);
      window.removeEventListener("blur", resetPointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;

    const onStageDrag = (event: Event) => {
      const { phase, dx, dy } = (event as CustomEvent<StageDragDetail>).detail;

      if (phase === "start") {
        isDragging.current = true;
        targetDrag.current.x = 0;
        targetDrag.current.y = 0;
        dragVelocity.current.x = 0;
        dragVelocity.current.y = 0;
        lastDrag.current.x = 0;
        lastDrag.current.y = 0;
        return;
      }

      if (phase === "move") {
        const nextX = MathUtils.clamp(dx / 260, -1, 1);
        const nextY = MathUtils.clamp(dy / 220, -1, 1);
        dragVelocity.current.x = MathUtils.clamp(nextX - lastDrag.current.x, -0.08, 0.08);
        dragVelocity.current.y = MathUtils.clamp(nextY - lastDrag.current.y, -0.08, 0.08);
        targetDrag.current.x = nextX;
        targetDrag.current.y = nextY;
        lastDrag.current.x = nextX;
        lastDrag.current.y = nextY;
        return;
      }

      isDragging.current = false;
      targetDrag.current.x = MathUtils.clamp(targetDrag.current.x + dragVelocity.current.x * 1.4, -1, 1);
      targetDrag.current.y = MathUtils.clamp(targetDrag.current.y + dragVelocity.current.y * 1.2, -1, 1);
    };

    window.addEventListener("hazina:stage-drag", onStageDrag);
    return () => window.removeEventListener("hazina:stage-drag", onStageDrag);
  }, [reduceMotion]);

  useFrame(({ clock }) => {
    if (!stageRef.current || reduceMotion) return;

    if (!isDragging.current) {
      targetDrag.current.x = MathUtils.lerp(targetDrag.current.x, 0, 0.06);
      targetDrag.current.y = MathUtils.lerp(targetDrag.current.y, 0, 0.06);
    }

    smoothDrag.current.x = MathUtils.lerp(
      smoothDrag.current.x,
      targetDrag.current.x,
      isDragging.current ? 0.12 : 0.065,
    );
    smoothDrag.current.y = MathUtils.lerp(
      smoothDrag.current.y,
      targetDrag.current.y,
      isDragging.current ? 0.12 : 0.065,
    );

    smoothPointer.current.x = MathUtils.lerp(
      smoothPointer.current.x,
      targetPointer.current.x,
      0.08,
    );
    smoothPointer.current.y = MathUtils.lerp(
      smoothPointer.current.y,
      targetPointer.current.y,
      0.08,
    );

    const pointerX = smoothPointer.current.x;
    const pointerY = smoothPointer.current.y;
    const dragX = MathUtils.clamp(smoothDrag.current.x, -1, 1);
    const dragY = MathUtils.clamp(smoothDrag.current.y, -1, 1);
    const hoverInfluence = isDragging.current ? 0.42 : 1;
    const ambientRotationY = Math.sin(clock.elapsedTime * 0.24) * 0.12;
    const ambientPositionY = Math.sin(clock.elapsedTime * 0.55) * 0.035;

    stageRef.current.rotation.y = MathUtils.clamp(
      ambientRotationY + pointerX * 0.22 * hoverInfluence + dragX * 0.42,
      -0.58,
      0.58,
    );
    stageRef.current.rotation.x = MathUtils.clamp(
      BASE_STAGE_ROTATION_X - pointerY * 0.1 * hoverInfluence - dragY * 0.18,
      -0.28,
      0.16,
    );
    stageRef.current.position.x = MathUtils.clamp(
      BASE_STAGE_POSITION.x + pointerX * 0.22 * hoverInfluence + dragX * 0.28,
      -0.28,
      0.48,
    );
    stageRef.current.position.y = MathUtils.clamp(
      BASE_STAGE_POSITION.y + ambientPositionY - pointerY * 0.1 * hoverInfluence - dragY * 0.16,
      -0.42,
      0.08,
    );
    stageRef.current.position.z = BASE_STAGE_POSITION.z;
  });

  return (
    <>
      <ambientLight intensity={1.45} />
      <directionalLight position={[4.2, 6.2, 4.8]} intensity={2.45} color="#ffe2b7" />
      <pointLight position={[-3.4, 2.2, 3.4]} intensity={0.85} color="#caa777" />
      <pointLight position={[3.2, 1.4, -2.6]} intensity={0.42} color="#fff1d6" />
      <group
        ref={stageRef}
        position={[BASE_STAGE_POSITION.x, BASE_STAGE_POSITION.y, BASE_STAGE_POSITION.z]}
        rotation={[BASE_STAGE_ROTATION_X, 0, 0]}
      >
        <Float speed={0.8} rotationIntensity={0.03} floatIntensity={0.08}>
          <group>
            <mesh position={[0, -0.12, 0]}>
              <boxGeometry args={[2.35, 0.9, 1.48]} />
              <meshStandardMaterial color="#17120e" roughness={0.8} metalness={0.05} />
            </mesh>
            <mesh position={[0, 0.36, 0]}>
              <boxGeometry args={[2.42, 0.055, 1.54]} />
              <meshStandardMaterial color="#0f0b09" roughness={0.74} metalness={0.08} />
            </mesh>
            <mesh position={[0, 0.42, 0]}>
              <boxGeometry args={[2.55, 0.26, 1.66]} />
              <meshStandardMaterial color="#211812" roughness={0.76} metalness={0.07} />
            </mesh>
            <mesh position={[0, 0.61, 0]}>
              <boxGeometry args={[2.35, 0.035, 1.46]} />
              <meshStandardMaterial color="#f0e4d1" roughness={0.7} metalness={0.02} />
            </mesh>
            <mesh position={[-1.19, 0.04, 0]}>
              <boxGeometry args={[0.035, 0.72, 1.52]} />
              <meshStandardMaterial color="#2d2118" roughness={0.72} metalness={0.05} />
            </mesh>
            <mesh position={[1.19, 0.04, 0]}>
              <boxGeometry args={[0.035, 0.72, 1.52]} />
              <meshStandardMaterial color="#0f0b09" roughness={0.74} metalness={0.06} />
            </mesh>
            <mesh position={[0, 0.78, 0.03]}>
              <boxGeometry args={[0.18, 0.1, 1.78]} />
              <meshStandardMaterial color="#b9854f" roughness={0.44} metalness={0.24} />
            </mesh>
            <mesh position={[0, 0.79, 0.03]}>
              <boxGeometry args={[2.72, 0.105, 0.16]} />
              <meshStandardMaterial color="#caa777" roughness={0.42} metalness={0.26} />
            </mesh>
            <mesh position={[0, 0.93, 0.03]}>
              <torusGeometry args={[0.24, 0.035, 10, 48]} />
              <meshStandardMaterial color="#d7b47e" roughness={0.38} metalness={0.32} />
            </mesh>
            <mesh position={[-0.62, 0.655, 0.38]} rotation={[-0.08, 0.12, -0.02]}>
              <boxGeometry args={[0.62, 0.38, 0.025]} />
              <meshStandardMaterial color="#efe5d2" roughness={0.62} metalness={0.02} />
            </mesh>
            <mesh position={[-0.62, 0.68, 0.405]} rotation={[-0.08, 0.12, -0.02]}>
              <boxGeometry args={[0.42, 0.018, 0.012]} />
              <meshStandardMaterial color="#b9854f" roughness={0.52} metalness={0.16} />
            </mesh>
          </group>
        </Float>

        <FloatingTreasure kind="bead-ring" position={[-1.72, 1.04, -0.42]} rotation={[0.35, 0.35, -0.24]} />
        <FloatingTreasure kind="coffee-pack" position={[1.72, 0.74, -0.18]} rotation={[0.02, -0.38, 0.12]} />
        <FloatingTreasure kind="leather-tag" position={[1.36, -0.5, 0.34]} rotation={[0.18, -0.2, -0.12]} />
        <FloatingTreasure kind="story-card" position={[-1.45, -0.54, 0.2]} rotation={[0.14, 0.24, 0.1]} />
      </group>
      <ContactShadows
        position={[0, -1.02, 0]}
        opacity={0.34}
        blur={2.9}
        scale={5.4}
        far={2.8}
        color="#090604"
      />
    </>
  );
}

function StageFallback() {
  return (
    <div className="hero-gift-fallback spatial-panel depth-shadow-strong">
      <div className="hero-gift-fallback__lid" />
      <div className="hero-gift-fallback__ribbon hero-gift-fallback__ribbon--vertical" />
      <div className="hero-gift-fallback__ribbon hero-gift-fallback__ribbon--horizontal" />
      <div className="hero-gift-fallback__card" />
    </div>
  );
}

export function HeroGiftStage() {
  return (
    <div className="spatial-stage hero-gift-stage" aria-hidden="true">
      <HazinaCanvas fallback={<StageFallback />} className="h-full w-full">
        <GiftScene />
      </HazinaCanvas>
    </div>
  );
}
