"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import ProfileOrbit from "../three/ProfileOrbit";

/** Infinite synthwave-style grid floor that drifts toward the camera. */
function GridFloor() {
  const ref = useRef<THREE.GridHelper>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const materials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    materials.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.28;
    });
  }, []);

  useFrame((state) => {
    const grid = ref.current;
    if (!grid) return;
    const sy = window.scrollY / window.innerHeight;
    grid.position.z = ((state.clock.elapsedTime * 0.8 + sy * 5) % 2);
    grid.position.y = -2.9 + sy * 0.4;
  });

  return (
    <gridHelper ref={ref} args={[100, 100, "#00ff88", "#0a5c38"]} position={[0, -2.9, 0]} />
  );
}

/** Sparse green data-dust drifting in the void. */
function DataDust() {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const count = 220;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 2] = -2 - Math.random() * 14;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.015;
    const sy = window.scrollY / window.innerHeight;
    ref.current.position.y = sy * 1.6;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.04}
        color="#34d399"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

export default function TerminalScene() {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <fog attach="fog" args={["#020503", 9, 38]} />
        <Suspense fallback={null}>
          <ProfileOrbit
            theme={{
              ring: "#4ade80",
              ringAlt: "#16a34a",
              border: "#22c55e",
              halo: "#22c55e",
              glow: 14,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          />
        </Suspense>
        <GridFloor />
        <DataDust />
      </Canvas>
    </div>
  );
}
