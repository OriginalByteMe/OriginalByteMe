"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createTextRingTexture } from "./textures";

export interface TextRingProps {
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
export default function TextRing({
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
