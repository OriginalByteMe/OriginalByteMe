"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import OrbitRig from "../three/OrbitRig";
import NoahAvatar from "../three/NoahAvatar";

interface ShapeProps {
  position: [number, number, number];
  speed: number;
  children: React.ReactNode;
}

function FloatingShape({ position, speed, children }: ShapeProps) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.rotation.x = state.clock.elapsedTime * speed * 0.3;
    mesh.rotation.y = state.clock.elapsedTime * speed * 0.45;
    mesh.position.y =
      position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.25;
  });
  return (
    <mesh ref={ref} position={position}>
      {children}
    </mesh>
  );
}

/** A few quiet wireframe solids drifting in parallax behind the content. */
function QuietGeometry() {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const sy = window.scrollY / window.innerHeight;
    g.position.y = sy * 2.4;
    g.rotation.z = sy * 0.06;
  });

  const wire = (
    <meshBasicMaterial
      color="#8b8b92"
      wireframe
      transparent
      opacity={0.22}
      toneMapped={false}
    />
  );

  return (
    <group ref={group}>
      <FloatingShape position={[-4.8, 1.6, -4]} speed={0.5}>
        <icosahedronGeometry args={[1.1, 0]} />
        {wire}
      </FloatingShape>
      <FloatingShape position={[4.9, -1.2, -5]} speed={0.35}>
        <torusGeometry args={[0.9, 0.32, 12, 40]} />
        {wire}
      </FloatingShape>
      <FloatingShape position={[3.9, 2.6, -7]} speed={0.6}>
        <octahedronGeometry args={[0.8, 0]} />
        {wire}
      </FloatingShape>
      <FloatingShape position={[-3.6, -2.4, -6]} speed={0.45}>
        <dodecahedronGeometry args={[0.7, 0]} />
        {wire}
      </FloatingShape>
    </group>
  );
}

export default function MinimalScene() {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Soft studio lighting for the vinyl-toy avatar */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 6]} intensity={1.4} />
        <directionalLight position={[-4, 2, -2]} intensity={0.45} />

        <Suspense fallback={null}>
          <OrbitRig
            theme={{
              ring: "#9b9ba3",
              ringAlt: "#6e6e76",
              border: "#a1a1aa",
              halo: "#a1a1aa",
              glow: 0,
            }}
          >
            <NoahAvatar />
          </OrbitRig>
        </Suspense>
        <QuietGeometry />
      </Canvas>
    </div>
  );
}
