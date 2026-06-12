"use client";

import { ContactShadows, Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { MathUtils, type Group } from "three";
import { HazinaCanvas } from "./HazinaCanvas";
import { FloatingTreasure } from "./FloatingTreasure";

function GiftScene() {
  const group = useRef<Group | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      target.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      target.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  useFrame(({ clock, pointer }) => {
    if (!group.current) return;
    current.current.x = MathUtils.lerp(current.current.x, target.current.x || pointer.x, 0.055);
    current.current.y = MathUtils.lerp(current.current.y, target.current.y || pointer.y, 0.055);
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.24) * 0.12 + current.current.x * 0.18;
    group.current.rotation.x = -0.08 + current.current.y * 0.07;
    group.current.position.x = 0.1 + current.current.x * 0.08;
    group.current.position.y = Math.sin(clock.elapsedTime * 0.55) * 0.035;
  });

  return (
    <>
      <ambientLight intensity={1.45} />
      <directionalLight position={[4.2, 6.2, 4.8]} intensity={2.45} color="#ffe2b7" />
      <pointLight position={[-3.4, 2.2, 3.4]} intensity={0.85} color="#caa777" />
      <pointLight position={[3.2, 1.4, -2.6]} intensity={0.42} color="#fff1d6" />
      <group ref={group} position={[0.1, -0.18, 0]}>
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
