"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { createTextRingTexture } from "./textures";
import { heroRoleSets, orbitMantra } from "@/lib/portfolio-data";

export interface OrbitTheme {
  ring: string;
  ringAlt: string;
  border: string;
  halo: string;
  glow?: number;
  fontFamily?: string;
}

/* ---------------------------------- rings --------------------------------- */

interface TextRingProps {
  words: string[];
  radius: number;
  speed: number;
  tilt: [number, number, number];
  color: string;
  glow?: number;
  fontFamily?: string;
  fontSize?: number;
  maxOpacity?: number;
}

/**
 * A flat ring of circular text that spins around its own axis. When the word
 * set changes it fades out, swaps the texture, then fades back in.
 */
function TextRing({
  words,
  radius,
  speed,
  tilt,
  color,
  glow = 0,
  fontFamily,
  fontSize = 44,
  maxOpacity = 1,
}: TextRingProps) {
  const [displayWords, setDisplayWords] = useState(words);
  const pendingRef = useRef<string[] | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    if (words.join("|") !== displayWords.join("|")) {
      pendingRef.current = words;
    }
  }, [words, displayWords]);

  const texture = useMemo(
    () =>
      createTextRingTexture({
        text: displayWords.join("   •   ") + "   •   ",
        color,
        glow,
        fontFamily,
        fontSize,
      }),
    [displayWords, color, glow, fontFamily, fontSize]
  );

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    mesh.rotation.z += speed * delta;

    const target = pendingRef.current ? 0 : maxOpacity;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, target, 7, delta);
    if (pendingRef.current && mat.opacity < 0.04) {
      setDisplayWords(pendingRef.current);
      pendingRef.current = null;
    }
  });

  return (
    <group rotation={tilt}>
      <mesh ref={meshRef}>
        <planeGeometry args={[radius * 2, radius * 2]} />
        <meshBasicMaterial
          ref={matRef}
          map={texture}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------ profile orbit ----------------------------- */

const easeOutBack = (x: number) => {
  const c1 = 1.30158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

interface ProfileOrbitProps {
  theme: OrbitTheme;
  imageUrl?: string;
  /** How strongly the group scrolls away with the page (1 = locked to hero). */
  scrollFactor?: number;
  position?: [number, number, number];
}

/**
 * The hero centerpiece: profile picture on a 3D disc, surrounded by two
 * counter-rotating rings of circular text (roles cycle every few seconds)
 * plus thin gyroscope halos. Enters with a spring scale-in, floats gently,
 * follows the pointer, and recedes as you scroll.
 */
export default function ProfileOrbit({
  theme,
  imageUrl = "/hero.png",
  scrollFactor = 1,
  position = [0, 0, 0],
}: ProfileOrbitProps) {
  const photo = useLoader(THREE.TextureLoader, imageUrl);
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
        {/* Profile disc */}
        <mesh>
          <circleGeometry args={[1.35, 64]} />
          <meshBasicMaterial map={photo} toneMapped={false} />
        </mesh>
        {/* Disc border */}
        <mesh position={[0, 0, 0.001]}>
          <ringGeometry args={[1.35, 1.41, 64]} />
          <meshBasicMaterial color={theme.border} toneMapped={false} />
        </mesh>

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
