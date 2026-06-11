"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import TextRing from "./TextRing";
import { heroRoleSets, orbitMantra } from "@/lib/portfolio-data";

export interface OrbitTheme {
  ring: string;
  ringAlt: string;
  border: string;
  halo: string;
  glow?: number;
  fontFamily?: string;
}

const easeOutBack = (x: number) => {
  const c1 = 1.30158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

interface OrbitRigProps {
  theme: OrbitTheme;
  children: ReactNode;
  /** How strongly the group scrolls away with the page (1 = locked to hero). */
  scrollFactor?: number;
  position?: [number, number, number];
}

/**
 * The hero rig: whatever sits at the center (photo disc, avatar, ...) gets
 * two counter-rotating rings of circular text (roles cycle every few
 * seconds) plus thin gyroscope halos. Enters with a spring scale-in, floats
 * gently, follows the pointer, and recedes as you scroll.
 */
export default function OrbitRig({
  theme,
  children,
  scrollFactor = 1,
  position = [0, 0, 0],
}: OrbitRigProps) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });

  const [roleIndex, setRoleIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setRoleIndex((i) => (i + 1) % heroRoleSets.length),
      4500
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((state, delta) => {
    const g = group.current;
    const inn = inner.current;
    if (!g || !inn) return;

    // Entrance: springy scale-in over the first ~1.4s.
    elapsed.current += delta;
    const t = Math.min(elapsed.current / 1.4, 1);
    g.scale.setScalar(Math.max(easeOutBack(t), 0.001));

    // Scroll away with the hero section (world height ≈ 6.6 at z=8, fov 45).
    const sy = window.scrollY / window.innerHeight;
    g.position.y = position[1] + sy * 6.6 * scrollFactor;
    g.position.x = position[0];
    g.position.z = position[2] - sy * 1.5;

    // Pointer parallax + a slow scroll-tilt, all damped for smoothness.
    g.rotation.y = THREE.MathUtils.damp(
      g.rotation.y,
      pointer.current.x * 0.3,
      4,
      delta
    );
    g.rotation.x = THREE.MathUtils.damp(
      g.rotation.x,
      pointer.current.y * 0.16 + sy * 0.5,
      4,
      delta
    );

    // Gentle float bob.
    inn.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.09;
  });

  return (
    <group ref={group} position={position} scale={0.001}>
      <group ref={inner}>
        {children}

        {/* Inner ring: cycling roles */}
        <TextRing
          words={heroRoleSets[roleIndex]}
          radius={2.05}
          speed={0.28}
          tilt={[0.16, 0, 0]}
          color={theme.ring}
          glow={theme.glow}
          fontFamily={theme.fontFamily}
          fontSize={52}
        />
        {/* Outer ring: constant mantra, counter-rotating */}
        <TextRing
          words={orbitMantra}
          radius={2.75}
          speed={-0.16}
          tilt={[-0.24, 0.1, 0]}
          color={theme.ringAlt}
          glow={theme.glow ? theme.glow * 0.6 : 0}
          fontFamily={theme.fontFamily}
          fontSize={36}
          maxOpacity={0.7}
        />

        {/* Gyroscope halos */}
        <mesh rotation={[Math.PI / 2.15, 0.22, 0]}>
          <torusGeometry args={[2.4, 0.008, 8, 160]} />
          <meshBasicMaterial
            color={theme.halo}
            transparent
            opacity={0.5}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 1.85, -0.35, 0]}>
          <torusGeometry args={[3.05, 0.005, 8, 160]} />
          <meshBasicMaterial
            color={theme.halo}
            transparent
            opacity={0.25}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
