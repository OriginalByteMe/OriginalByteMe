"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import ProfileOrbit from "../three/ProfileOrbit";

/** A drifting constellation of nodes wired together like a neural net. */
function NeuralNetwork() {
  const group = useRef<THREE.Group>(null);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);

  const { nodeGeo, lineGeo } = useMemo(() => {
    const count = 140;
    const points: THREE.Vector3[] = [];
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = new THREE.Vector3(
        (Math.random() - 0.5) * 26,
        (Math.random() - 0.5) * 16,
        -4 - Math.random() * 10
      );
      points.push(p);
      positions.set([p.x, p.y, p.z], i * 3);
    }

    const linePositions: number[] = [];
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (points[i].distanceToSquared(points[j]) < 8.5) {
          linePositions.push(
            points[i].x, points[i].y, points[i].z,
            points[j].x, points[j].y, points[j].z
          );
        }
      }
    }

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(linePositions), 3)
    );
    return { nodeGeo, lineGeo };
  }, []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const sy = window.scrollY / window.innerHeight;
    g.rotation.y = state.clock.elapsedTime * 0.02 + sy * 0.25;
    g.rotation.x = sy * 0.12;
    g.position.y = sy * 1.4;
    if (lineMat.current) {
      lineMat.current.opacity =
        0.14 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
    }
  });

  return (
    <group ref={group}>
      <points geometry={nodeGeo}>
        <pointsMaterial
          size={0.07}
          color="#7dd3fc"
          transparent
          opacity={0.85}
          sizeAttenuation
        />
      </points>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial
          ref={lineMat}
          color="#818cf8"
          transparent
          opacity={0.16}
        />
      </lineSegments>
    </group>
  );
}

export default function NeuralScene() {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ProfileOrbit
            theme={{
              ring: "#a5b4fc",
              ringAlt: "#67e8f9",
              border: "#818cf8",
              halo: "#22d3ee",
              glow: 18,
            }}
          />
        </Suspense>
        <NeuralNetwork />
      </Canvas>
    </div>
  );
}
