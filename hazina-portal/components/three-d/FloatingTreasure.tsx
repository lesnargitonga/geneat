"use client";

import { Float } from "@react-three/drei";

type FloatingTreasureProps = {
  kind: "bead-ring" | "leather-tag" | "coffee-pack" | "story-card";
  position: [number, number, number];
  rotation?: [number, number, number];
};

export function FloatingTreasure({ kind, position, rotation = [0, 0, 0] }: FloatingTreasureProps) {
  if (kind === "bead-ring") {
    return (
      <Float speed={1.4} rotationIntensity={0.16} floatIntensity={0.28}>
        <mesh position={position} rotation={rotation}>
          <torusGeometry args={[0.42, 0.045, 16, 56]} />
          <meshStandardMaterial color="#caa777" roughness={0.52} metalness={0.28} />
        </mesh>
      </Float>
    );
  }

  if (kind === "leather-tag") {
    return (
      <Float speed={1.05} rotationIntensity={0.12} floatIntensity={0.2}>
        <mesh position={position} rotation={rotation}>
          <boxGeometry args={[0.72, 0.48, 0.05]} />
          <meshStandardMaterial color="#3a2417" roughness={0.86} metalness={0.03} />
        </mesh>
      </Float>
    );
  }

  if (kind === "coffee-pack") {
    return (
      <Float speed={1.2} rotationIntensity={0.14} floatIntensity={0.22}>
        <mesh position={position} rotation={rotation}>
          <boxGeometry args={[0.52, 0.82, 0.22]} />
          <meshStandardMaterial color="#16120f" roughness={0.72} metalness={0.08} />
        </mesh>
      </Float>
    );
  }

  return (
    <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.18}>
      <mesh position={position} rotation={rotation}>
        <boxGeometry args={[0.68, 0.44, 0.025]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.64} metalness={0.02} />
      </mesh>
    </Float>
  );
}
