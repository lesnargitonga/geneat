"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { MathUtils, type Group, type PointLight } from "three";
import { HazinaCanvas } from "./HazinaCanvas";

const BASE_STAGE_POSITION = { x: 0.04, y: -0.06, z: 0 };
const BASE_STAGE_ROTATION_X = -0.1;
const BASE_STAGE_ROTATION_Y = -0.18;

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

function GiftScene({ revealing }: { revealing: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  const stageRef = useRef<Group | null>(null);
  const lidRef = useRef<Group | null>(null);
  const treasureRef = useRef<Group | null>(null);
  const vaultLightRef = useRef<PointLight | null>(null);
  const revealTarget = useRef(0);
  const revealProgress = useRef(0);
  const targetPointer = useRef({ x: 0, y: 0 });
  const smoothPointer = useRef({ x: 0, y: 0 });
  const targetDrag = useRef({ x: 0, y: 0 });
  const smoothDrag = useRef({ x: 0, y: 0 });
  const dragVelocity = useRef({ x: 0, y: 0 });
  const lastDrag = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  useEffect(() => {
    revealTarget.current = revealing && !reduceMotion ? 1 : 0;
    if (revealing) {
      isDragging.current = false;
      targetDrag.current.x = 0;
      targetDrag.current.y = 0;
    }
  }, [reduceMotion, revealing]);

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

    revealProgress.current = MathUtils.lerp(
      revealProgress.current,
      revealTarget.current,
      revealing ? 0.085 : 0.065,
    );
    const reveal = revealProgress.current;

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
    const hoverInfluence = (isDragging.current ? 0.42 : 1) * (1 - reveal * 0.82);
    const ambientRotationY = BASE_STAGE_ROTATION_Y + Math.sin(clock.elapsedTime * 0.2) * 0.035;
    const ambientPositionY = Math.sin(clock.elapsedTime * 0.42) * 0.018;

    stageRef.current.rotation.y = MathUtils.clamp(
      ambientRotationY + pointerX * 0.15 * hoverInfluence + dragX * 0.34 - reveal * 0.06,
      -0.52,
      0.32,
    );
    stageRef.current.rotation.x = MathUtils.clamp(
      BASE_STAGE_ROTATION_X - pointerY * 0.065 * hoverInfluence - dragY * 0.14 - reveal * 0.02,
      -0.24,
      0.1,
    );
    stageRef.current.position.x = MathUtils.clamp(
      BASE_STAGE_POSITION.x + pointerX * 0.12 * hoverInfluence + dragX * 0.22 - reveal * 0.03,
      -0.22,
      0.3,
    );
    stageRef.current.position.y = MathUtils.clamp(
      BASE_STAGE_POSITION.y +
        ambientPositionY -
        pointerY * 0.055 * hoverInfluence -
        dragY * 0.12 +
        reveal * 0.06,
      -0.28,
      0.12,
    );
    stageRef.current.position.z = BASE_STAGE_POSITION.z;

    if (lidRef.current) {
      lidRef.current.rotation.x = -1.12 * reveal;
      lidRef.current.position.y = reveal * 0.045;
    }

    if (treasureRef.current) {
      treasureRef.current.position.y = 0.34 + reveal * 0.055;
      treasureRef.current.scale.setScalar(0.96 + reveal * 0.04);
    }

    if (vaultLightRef.current) {
      vaultLightRef.current.intensity = MathUtils.lerp(0, 3.8, reveal);
      vaultLightRef.current.distance = MathUtils.lerp(1.2, 3.6, reveal);
    }
  });

  return (
    <>
      <ambientLight intensity={1.55} />
      <directionalLight position={[4.6, 6.4, 5.2]} intensity={3.4} color="#ffe3ba" />
      <pointLight position={[-3.2, 1.8, 3.8]} intensity={1.25} color="#e6c08a" />
      <pointLight position={[2.8, 0.8, -2.8]} intensity={0.55} color="#fff0d4" />
      <pointLight position={[0, 0.2, 4.6]} intensity={0.95} color="#f3d49a" />
      <pointLight ref={vaultLightRef} position={[0, 0.72, 0.18]} intensity={0} color="#f0c98c" />
      <group
        ref={stageRef}
        position={[BASE_STAGE_POSITION.x, BASE_STAGE_POSITION.y, BASE_STAGE_POSITION.z]}
        rotation={[BASE_STAGE_ROTATION_X, BASE_STAGE_ROTATION_Y, 0]}
      >
        <RoundedBox args={[2.82, 0.82, 1.78]} radius={0.12} smoothness={4} position={[0, -0.18, 0]}>
          <meshPhysicalMaterial
            color="#5a3d28"
            roughness={0.44}
            metalness={0.12}
            clearcoat={0.4}
            clearcoatRoughness={0.5}
          />
        </RoundedBox>
        <RoundedBox args={[2.56, 0.09, 1.52]} radius={0.04} smoothness={3} position={[0, 0.25, 0]}>
          <meshStandardMaterial color="#c79a55" roughness={0.4} metalness={0.55} />
        </RoundedBox>
        <RoundedBox args={[2.36, 0.055, 1.34]} radius={0.035} smoothness={3} position={[0, 0.31, 0]}>
          <meshStandardMaterial color="#e4d2ac" roughness={0.7} metalness={0.03} />
        </RoundedBox>

        <group ref={treasureRef} position={[0, 0.34, 0]} scale={0.96}>
          <RoundedBox args={[0.58, 0.15, 0.88]} radius={0.06} smoothness={3} position={[-0.78, 0, 0]}>
            <meshStandardMaterial color="#6a4a32" roughness={0.6} metalness={0.08} />
          </RoundedBox>
          <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.27, 0.045, 12, 40]} />
            <meshStandardMaterial color="#e7bd76" roughness={0.28} metalness={0.7} />
          </mesh>
          <RoundedBox args={[0.62, 0.1, 0.82]} radius={0.05} smoothness={3} position={[0.78, 0, 0]}>
            <meshStandardMaterial color="#f3ead7" roughness={0.68} metalness={0.02} />
          </RoundedBox>
        </group>

        <group ref={lidRef} position={[0, 0.28, -0.86]} rotation={[0, 0, 0]}>
          <group position={[0, 0.16, 0.86]}>
            <RoundedBox args={[2.88, 0.34, 1.84]} radius={0.12} smoothness={4}>
              <meshPhysicalMaterial
                color="#65442c"
                roughness={0.4}
                metalness={0.12}
                clearcoat={0.46}
                clearcoatRoughness={0.46}
              />
            </RoundedBox>
            <RoundedBox args={[2.58, 0.035, 1.54]} radius={0.035} smoothness={3} position={[0, 0.19, 0]}>
              <meshStandardMaterial color="#2f2014" roughness={0.5} metalness={0.12} />
            </RoundedBox>
            <RoundedBox args={[0.11, 0.38, 1.86]} radius={0.03} smoothness={3}>
              <meshStandardMaterial color="#d2a154" roughness={0.32} metalness={0.62} />
            </RoundedBox>
          </group>
        </group>

        <RoundedBox args={[2.2, 0.34, 0.045]} radius={0.05} smoothness={3} position={[0, -0.17, 0.9]}>
          <meshStandardMaterial color="#3a2719" roughness={0.5} metalness={0.1} />
        </RoundedBox>
        <mesh position={[0, -0.17, 0.94]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.055, 48]} />
          <meshStandardMaterial color="#dcab5e" roughness={0.28} metalness={0.68} />
        </mesh>
        <mesh position={[0, -0.17, 0.972]}>
          <ringGeometry args={[0.085, 0.12, 32]} />
          <meshStandardMaterial color="#4a3320" roughness={0.42} metalness={0.2} />
        </mesh>
      </group>
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

export function HeroGiftStage({ revealing = false }: { revealing?: boolean }) {
  return (
    <div className="spatial-stage hero-gift-stage" aria-hidden="true">
      <HazinaCanvas fallback={<StageFallback />} className="h-full w-full">
        <GiftScene revealing={revealing} />
      </HazinaCanvas>
    </div>
  );
}
