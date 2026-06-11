"use client";

import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import OrbitRig, { type OrbitTheme } from "./OrbitRig";

export type { OrbitTheme };

interface ProfileOrbitProps {
  theme: OrbitTheme;
  imageUrl?: string;
  scrollFactor?: number;
  position?: [number, number, number];
}

/**
 * OrbitRig with the profile photo on a disc at the center. The photo is
 * center-cropped to a square via texture repeat/offset so non-square images
 * aren't squeezed into the circle.
 */
export default function ProfileOrbit({
  theme,
  imageUrl = "/hero.png",
  scrollFactor = 1,
  position = [0, 0, 0],
}: ProfileOrbitProps) {
  const photo = useLoader(THREE.TextureLoader, imageUrl);

  const cropped = useMemo(() => {
    const tex = photo.clone();
    const img = tex.image as { width: number; height: number } | undefined;
    if (img && img.width && img.height) {
      const aspect = img.width / img.height;
      if (aspect > 1) {
        // landscape: crop the sides
        tex.repeat.set(1 / aspect, 1);
        tex.offset.set((1 - 1 / aspect) / 2, 0);
      } else if (aspect < 1) {
        // portrait: crop top/bottom, biased upward to keep the face in frame
        tex.repeat.set(1, aspect);
        tex.offset.set(0, (1 - aspect) * 0.75);
      }
    }
    tex.needsUpdate = true;
    return tex;
  }, [photo]);

  return (
    <OrbitRig theme={theme} scrollFactor={scrollFactor} position={position}>
      {/* Profile disc */}
      <mesh>
        <circleGeometry args={[1.35, 64]} />
        <meshBasicMaterial map={cropped} toneMapped={false} />
      </mesh>
      {/* Disc border */}
      <mesh position={[0, 0, 0.001]}>
        <ringGeometry args={[1.35, 1.41, 64]} />
        <meshBasicMaterial color={theme.border} toneMapped={false} />
      </mesh>
    </OrbitRig>
  );
}
