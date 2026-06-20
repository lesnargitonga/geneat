"use client";

import { RoundedBox, useTexture } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { type MutableRefObject, Suspense, useEffect, useRef, useState } from "react";
import { DoubleSide, MathUtils, type Group, type PointLight } from "three";
import { HazinaCanvas } from "./HazinaCanvas";

// Real Hazina product photographs that spill out of the chest on open.
const TREASURE_IMAGES = [
  "/treasures/coffee-beans-variety.webp",
  "/treasures/premium-tea-spoons.webp",
  "/treasures/raw-honey-jars.webp",
  "/treasures/beaded-bracelet.webp",
  "/treasures/maasai-necklace-worn.webp",
];

const BASE_STAGE_POSITION = { x: 0.04, y: -0.06, z: 0 };
const BASE_STAGE_ROTATION_X = -0.1;
const BASE_STAGE_ROTATION_Y = -0.18;

// Each treasure is tucked inside the chest, then arcs up and spills forward
// toward the viewer as the lid opens — a "pour", not just a reveal.
type TreasureSpec = {
  rest: [number, number, number];
  pour: [number, number, number];
  spin: [number, number, number];
  arc: number;
  delay: number;
};

// Lower spin than a free tumble so each product photo stays facing the viewer
// as it pours out.
const TREASURES: TreasureSpec[] = [
  { rest: [-0.5, 0.04, -0.12], pour: [-1.4, 0.54, 1.12], spin: [0.18, 0.45, -0.16], arc: 0.5, delay: 0.0 },
  { rest: [0.52, -0.02, 0.12], pour: [1.46, 0.3, 1.22], spin: [-0.2, -0.5, 0.18], arc: 0.62, delay: 0.09 },
  { rest: [-0.16, 0.08, 0.18], pour: [-0.46, -0.16, 1.58], spin: [0.24, 0.3, 0.12], arc: 0.72, delay: 0.18 },
  { rest: [0.22, 0.02, -0.16], pour: [0.7, 0.92, 0.96], spin: [-0.16, 0.4, -0.2], arc: 0.56, delay: 0.27 },
  { rest: [0.0, 0.12, 0.02], pour: [0.16, 0.08, 1.82], spin: [0.2, -0.36, 0.14], arc: 0.8, delay: 0.36 },
];

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// Framed photo tiles textured with the real product shots, wrapped in Suspense
// so a slow texture load never blocks the chest.
function PouredTreasures({ refs }: { refs: MutableRefObject<Array<Group | null>> }) {
  const maps = useTexture(TREASURE_IMAGES);
  return (
    <>
      {TREASURES.map((spec, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={spec.rest}
          visible={false}
        >
          {/* Cream frame with a touch of depth. */}
          <RoundedBox args={[0.66, 0.66, 0.05]} radius={0.04} smoothness={3}>
            <meshStandardMaterial color="#f3ead7" roughness={0.74} metalness={0.02} />
          </RoundedBox>
          <mesh position={[0, 0, 0.027]}>
            <planeGeometry args={[0.56, 0.56]} />
            <meshBasicMaterial map={maps[i]} side={DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

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
  const chestRef = useRef<Group | null>(null);
  const lidRef = useRef<Group | null>(null);
  const latchRef = useRef<Group | null>(null);
  const treasureRefs = useRef<Array<Group | null>>([]);
  const vaultLightRef = useRef<PointLight | null>(null);

  // Local "peek" open state, toggled by clicking the latch. Combined with the
  // page-level `revealing` (entering the showroom) to drive one open value.
  const [latchOpen, setLatchOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const openTarget = useRef(0);
  const openProgress = useRef(0);

  const targetPointer = useRef({ x: 0, y: 0 });
  const smoothPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    openTarget.current = (revealing || latchOpen) && !reduceMotion ? 1 : 0;
  }, [reduceMotion, revealing, latchOpen]);

  // Auto-close the peek a few seconds after a latch-open (unless the page is revealing).
  useEffect(() => {
    if (!latchOpen || revealing) return;
    const timer = window.setTimeout(() => setLatchOpen(false), 4200);
    return () => window.clearTimeout(timer);
  }, [latchOpen, revealing]);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  useEffect(() => {
    if (reduceMotion) return;
    const onPointerMove = (event: PointerEvent) => {
      targetPointer.current.x = MathUtils.clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1);
      targetPointer.current.y = MathUtils.clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1);
    };
    const reset = () => {
      targetPointer.current.x = 0;
      targetPointer.current.y = 0;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
    };
  }, [reduceMotion]);

  useFrame(({ clock }) => {
    if (!stageRef.current || reduceMotion) return;

    openProgress.current = MathUtils.lerp(
      openProgress.current,
      openTarget.current,
      openTarget.current > openProgress.current ? 0.1 : 0.07,
    );
    const reveal = openProgress.current;

    smoothPointer.current.x = MathUtils.lerp(smoothPointer.current.x, targetPointer.current.x, 0.08);
    smoothPointer.current.y = MathUtils.lerp(smoothPointer.current.y, targetPointer.current.y, 0.08);
    const pointerX = smoothPointer.current.x;
    const pointerY = smoothPointer.current.y;
    const hoverInfluence = 1 - reveal * 0.7;

    const ambientRotationY = BASE_STAGE_ROTATION_Y + Math.sin(clock.elapsedTime * 0.2) * 0.04;
    const ambientPositionY = Math.sin(clock.elapsedTime * 0.42) * 0.02;

    stageRef.current.rotation.y = MathUtils.clamp(
      ambientRotationY + pointerX * 0.2 * hoverInfluence - reveal * 0.05,
      -0.5,
      0.34,
    );
    stageRef.current.rotation.x = MathUtils.clamp(
      BASE_STAGE_ROTATION_X - pointerY * 0.08 * hoverInfluence,
      -0.26,
      0.12,
    );
    stageRef.current.position.x = BASE_STAGE_POSITION.x + pointerX * 0.14 * hoverInfluence - reveal * 0.04;
    stageRef.current.position.y = BASE_STAGE_POSITION.y + ambientPositionY - pointerY * 0.06 * hoverInfluence + reveal * 0.05;

    // Chest tilts forward as it opens so the contents pour toward the viewer.
    if (chestRef.current) {
      chestRef.current.rotation.x = reveal * 0.22;
    }

    if (lidRef.current) {
      lidRef.current.rotation.x = -2.05 * easeOutCubic(reveal);
    }

    if (latchRef.current) {
      // Latch flicks open early in the motion.
      const latchP = MathUtils.clamp(reveal * 3, 0, 1);
      latchRef.current.rotation.x = -1.3 * easeOutCubic(latchP);
      latchRef.current.position.y = -0.36 + latchP * 0.12;
    }

    TREASURES.forEach((spec, i) => {
      const node = treasureRefs.current[i];
      if (!node) return;
      const p = easeOutCubic(MathUtils.clamp((reveal - spec.delay) / 0.62, 0, 1));
      const arc = Math.sin(p * Math.PI) * spec.arc;
      const settle = p >= 0.999 ? Math.sin(clock.elapsedTime * 1.4 + i) * 0.018 : 0;
      node.position.x = MathUtils.lerp(spec.rest[0], spec.pour[0], p);
      node.position.y = MathUtils.lerp(spec.rest[1], spec.pour[1], p) + arc + settle;
      node.position.z = MathUtils.lerp(spec.rest[2], spec.pour[2], p);
      node.rotation.x = spec.spin[0] * p;
      node.rotation.y = spec.spin[1] * p;
      node.rotation.z = spec.spin[2] * p;
      const s = 0.9 + p * 0.16;
      node.scale.setScalar(s);
      node.visible = reveal > 0.001 || p > 0;
    });

    if (vaultLightRef.current) {
      vaultLightRef.current.intensity = MathUtils.lerp(0, 4.4, reveal);
      vaultLightRef.current.distance = MathUtils.lerp(1.2, 4.2, reveal);
    }
  });

  const onLatchClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    setLatchOpen((open) => !open);
  };

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[4.6, 6.4, 5.2]} intensity={3.3} color="#ffe3ba" />
      <pointLight position={[-3.2, 1.8, 3.8]} intensity={1.2} color="#e6c08a" />
      <pointLight position={[2.8, 0.8, -2.8]} intensity={0.5} color="#fff0d4" />
      <pointLight position={[0, 0.2, 4.6]} intensity={0.95} color="#f3d49a" />
      <pointLight ref={vaultLightRef} position={[0, 0.5, 0.1]} intensity={0} color="#ffd79a" />

      <group
        ref={stageRef}
        position={[BASE_STAGE_POSITION.x, BASE_STAGE_POSITION.y, BASE_STAGE_POSITION.z]}
        rotation={[BASE_STAGE_ROTATION_X, BASE_STAGE_ROTATION_Y, 0]}
      >
        {/* Treasures — real product photos that spill forward out of the chest. */}
        <Suspense fallback={null}>
          <PouredTreasures refs={treasureRefs} />
        </Suspense>

        <group ref={chestRef}>
          {/* Chest body — leather with brass base rail and corner caps. */}
          <RoundedBox args={[2.7, 0.96, 1.74]} radius={0.1} smoothness={5} position={[0, -0.28, 0]}>
            <meshPhysicalMaterial color="#4d3320" roughness={0.5} metalness={0.08} clearcoat={0.5} clearcoatRoughness={0.45} />
          </RoundedBox>
          <RoundedBox args={[2.78, 0.14, 1.82]} radius={0.05} smoothness={4} position={[0, -0.72, 0]}>
            <meshStandardMaterial color="#caa05a" roughness={0.34} metalness={0.7} />
          </RoundedBox>
          {([
            [-1.22, 0.8],
            [1.22, 0.8],
            [-1.22, -0.8],
            [1.22, -0.8],
          ] as const).map(([x, z], i) => (
            <mesh key={i} position={[x, -0.66, z]}>
              <boxGeometry args={[0.16, 0.5, 0.16]} />
              <meshStandardMaterial color="#b88c4c" roughness={0.36} metalness={0.66} />
            </mesh>
          ))}

          {/* Cream satin interior lining (seen when open). */}
          <RoundedBox args={[2.42, 0.5, 1.46]} radius={0.04} smoothness={3} position={[0, -0.06, 0]}>
            <meshStandardMaterial color="#efe2c9" roughness={0.82} metalness={0.02} />
          </RoundedBox>
          <RoundedBox args={[2.5, 0.08, 1.54]} radius={0.04} smoothness={3} position={[0, 0.2, 0]}>
            <meshStandardMaterial color="#c79a55" roughness={0.38} metalness={0.6} />
          </RoundedBox>

          {/* Lid — hinged at the back. */}
          <group ref={lidRef} position={[0, 0.22, -0.87]}>
            <group position={[0, 0.12, 0.87]}>
              <RoundedBox args={[2.74, 0.26, 1.78]} radius={0.1} smoothness={5}>
                <meshPhysicalMaterial color="#5a3c25" roughness={0.46} metalness={0.1} clearcoat={0.55} clearcoatRoughness={0.4} />
              </RoundedBox>
              <RoundedBox args={[2.5, 0.05, 1.54]} radius={0.03} smoothness={3} position={[0, 0.15, 0]}>
                <meshStandardMaterial color="#caa05a" roughness={0.34} metalness={0.7} />
              </RoundedBox>
              {/* Brass emblem on the lid. */}
              <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.2, 0.03, 12, 40]} />
                <meshStandardMaterial color="#e7c178" roughness={0.3} metalness={0.78} />
              </mesh>
            </group>
          </group>

          {/* Front latch — clickable to open. */}
          <group
            ref={latchRef}
            position={[0, -0.36, 0.9]}
            onClick={onLatchClick}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
          >
            <mesh>
              <boxGeometry args={[0.34, 0.4, 0.06]} />
              <meshStandardMaterial color="#d8af63" roughness={0.3} metalness={0.74} />
            </mesh>
            <mesh position={[0, -0.04, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.05, 24]} />
              <meshStandardMaterial color="#3a2818" roughness={0.5} metalness={0.2} />
            </mesh>
          </group>
          {/* Latch keeper plate on the body (stays put). */}
          <mesh position={[0, -0.52, 0.9]}>
            <boxGeometry args={[0.4, 0.18, 0.05]} />
            <meshStandardMaterial color="#b88c4c" roughness={0.36} metalness={0.66} />
          </mesh>
        </group>
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
