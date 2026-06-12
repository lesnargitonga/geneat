"use client";

import { ContactShadows, Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { HazinaCanvas } from "./HazinaCanvas";
import { FloatingTreasure } from "./FloatingTreasure";

function GiftScene() {
  const group = useRef<Group | null>(null);

  useFrame(({ clock, pointer }) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.24) * 0.12 + pointer.x * 0.08;
    group.current.rotation.x = -0.08 + pointer.y * 0.035;
    group.current.position.y = Math.sin(clock.elapsedTime * 0.55) * 0.035;
  });

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} color="#ffe0b2" />
      <pointLight position={[-3, 2, 3]} intensity={0.7} color="#caa777" />
      <group ref={group} position={[0.1, -0.18, 0]}>
        <Float speed={0.8} rotationIntensity={0.03} floatIntensity={0.08}>
          <group>
            <mesh position={[0, -0.12, 0]}>
              <boxGeometry args={[2.35, 0.9, 1.48]} />
              <meshStandardMaterial color="#17120e" roughness={0.8} metalness={0.05} />
            </mesh>
            <mesh position={[0, 0.42, 0]}>
              <boxGeometry args={[2.55, 0.26, 1.66]} />
              <meshStandardMaterial color="#211812" roughness={0.76} metalness={0.07} />
            </mesh>
            <mesh position={[0, 0.61, 0]}>
              <boxGeometry args={[2.35, 0.035, 1.46]} />
              <meshStandardMaterial color="#f0e4d1" roughness={0.7} metalness={0.02} />
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
