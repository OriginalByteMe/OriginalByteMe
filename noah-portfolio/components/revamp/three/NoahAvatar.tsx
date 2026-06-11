"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A stylized vinyl-toy puppet of Noah built from primitives: big afro,
 * goatee, dark jumper and a watch on the waving wrist. The head tracks the
 * pointer, the eyes blink, the chest breathes, and he waves on arrival,
 * every few seconds, and whenever the pointer comes near.
 */

const SKIN = "#b07a52";
const SKIN_DARK = "#96633f";
const HAIR = "#171210";
const JUMPER = "#3a4356";
const JUMPER_LIGHT = "#4b5468";
const WATCH_STRAP = "#22252b";
const WATCH_FACE = "#d9dde3";

// Hand-placed afro puffs hugging the top/back of the head (head radius 0.5).
const AFRO_PUFFS: [number, number, number, number][] = [
  // [x, y, z, radius]
  [0, 0.42, 0.02, 0.34],
  [-0.28, 0.36, 0.0, 0.3],
  [0.28, 0.36, 0.0, 0.3],
  [-0.46, 0.18, -0.08, 0.27],
  [0.46, 0.18, -0.08, 0.27],
  [-0.18, 0.46, -0.22, 0.28],
  [0.18, 0.46, -0.22, 0.28],
  [0, 0.34, -0.34, 0.3],
  [-0.38, 0.3, -0.26, 0.26],
  [0.38, 0.3, -0.26, 0.26],
  [-0.52, 0.0, -0.18, 0.22],
  [0.52, 0.0, -0.18, 0.22],
  [0, 0.5, 0.18, 0.26],
  [-0.3, 0.42, 0.16, 0.24],
  [0.3, 0.42, 0.16, 0.24],
];

export default function NoahAvatar() {
  const avatar = useRef<THREE.Group>(null);
  const headGroup = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const eyeLids = useRef<THREE.Group>(null);

  const pointer = useRef({ x: 0, y: 0 });
  const waveUntil = useRef(0);
  const nextIdleWave = useRef(3.5);
  const nextBlink = useRef(2);
  const blinkUntil = useRef(0);
  const proximityCooldown = useRef(0);

  const materials = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 }),
      skinDark: new THREE.MeshStandardMaterial({ color: SKIN_DARK, roughness: 0.7 }),
      hair: new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.95 }),
      jumper: new THREE.MeshStandardMaterial({ color: JUMPER, roughness: 0.85 }),
      jumperLight: new THREE.MeshStandardMaterial({ color: JUMPER_LIGHT, roughness: 0.85 }),
      eyeWhite: new THREE.MeshStandardMaterial({ color: "#f3ece4", roughness: 0.35 }),
      pupil: new THREE.MeshStandardMaterial({ color: "#16100c", roughness: 0.3 }),
      mouth: new THREE.MeshStandardMaterial({ color: "#7c4a3a", roughness: 0.6 }),
      strap: new THREE.MeshStandardMaterial({ color: WATCH_STRAP, roughness: 0.5 }),
      face: new THREE.MeshStandardMaterial({
        color: WATCH_FACE,
        roughness: 0.25,
        metalness: 0.6,
      }),
    }),
    []
  );

  useEffect(() => {
    const mats = materials;
    return () => Object.values(mats).forEach((m) => m.dispose());
  }, [materials]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const av = avatar.current;
    const head = headGroup.current;
    const lArm = leftArm.current;
    const rArm = rightArm.current;
    const lids = eyeLids.current;
    if (!av || !head || !lArm || !rArm || !lids) return;

    // Breathing + a slow sway.
    av.scale.y = 1 + Math.sin(t * 1.6) * 0.012;
    av.rotation.z = Math.sin(t * 0.6) * 0.03;

    // Head tracks the pointer (only meaningful when not scrolled away).
    head.rotation.y = THREE.MathUtils.damp(head.rotation.y, pointer.current.x * 0.45, 6, delta);
    head.rotation.x = THREE.MathUtils.damp(head.rotation.x, pointer.current.y * 0.25, 6, delta);

    // Wave triggers: idle timer + pointer near the center of the screen.
    const nearCenter =
      Math.hypot(pointer.current.x, pointer.current.y) < 0.28 &&
      window.scrollY < window.innerHeight * 0.5;
    if (t > nextIdleWave.current || (nearCenter && t > proximityCooldown.current)) {
      waveUntil.current = t + 1.7;
      nextIdleWave.current = t + 9 + Math.random() * 4;
      proximityCooldown.current = t + 6;
    }

    const waving = t < waveUntil.current;
    // Left arm (his waving arm, with the watch) raises and oscillates.
    const lTarget = waving ? -2.25 + Math.sin(t * 11) * 0.28 : -0.3;
    lArm.rotation.z = THREE.MathUtils.damp(lArm.rotation.z, lTarget, 8, delta);
    // Right arm rests, swinging faintly with the sway.
    rArm.rotation.z = THREE.MathUtils.damp(
      rArm.rotation.z,
      0.3 + Math.sin(t * 0.6) * 0.04,
      6,
      delta
    );

    // Blinking.
    if (t > nextBlink.current) {
      blinkUntil.current = t + 0.13;
      nextBlink.current = t + 2.4 + Math.random() * 2.6;
    }
    const lidScale = t < blinkUntil.current ? 0.08 : 1;
    lids.scale.y = THREE.MathUtils.damp(lids.scale.y, lidScale, 26, delta);
  });

  return (
    <group ref={avatar} position={[0, 0.12, 0]} scale={0.92}>
      {/* ----- head ----- */}
      <group ref={headGroup} position={[0, 0.58, 0]}>
        {/* afro: cap + puffs, scaled up for full glory */}
        <group scale={1.16} position={[0, 0.04, -0.03]}>
          <mesh position={[0, 0.2, -0.12]} scale={[1.06, 0.92, 1.0]} material={materials.hair}>
            <sphereGeometry args={[0.5, 24, 24]} />
          </mesh>
          {AFRO_PUFFS.map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} material={materials.hair}>
              <sphereGeometry args={[r, 16, 16]} />
            </mesh>
          ))}
        </group>

        {/* face */}
        <mesh material={materials.skin}>
          <sphereGeometry args={[0.5, 32, 32]} />
        </mesh>
        {/* ears */}
        <mesh position={[-0.48, -0.02, 0.04]} scale={[0.5, 1, 0.7]} material={materials.skin}>
          <sphereGeometry args={[0.09, 12, 12]} />
        </mesh>
        <mesh position={[0.48, -0.02, 0.04]} scale={[0.5, 1, 0.7]} material={materials.skin}>
          <sphereGeometry args={[0.09, 12, 12]} />
        </mesh>

        {/* eyes (lids group scales on blink) */}
        <group ref={eyeLids} position={[0, 0.05, 0]}>
          <mesh position={[-0.18, 0, 0.42]} scale={[1, 1, 0.55]} material={materials.eyeWhite}>
            <sphereGeometry args={[0.078, 16, 16]} />
          </mesh>
          <mesh position={[0.18, 0, 0.42]} scale={[1, 1, 0.55]} material={materials.eyeWhite}>
            <sphereGeometry args={[0.078, 16, 16]} />
          </mesh>
          <mesh position={[-0.18, 0, 0.465]} material={materials.pupil}>
            <sphereGeometry args={[0.034, 12, 12]} />
          </mesh>
          <mesh position={[0.18, 0, 0.465]} material={materials.pupil}>
            <sphereGeometry args={[0.034, 12, 12]} />
          </mesh>
        </group>

        {/* brows */}
        <mesh position={[-0.18, 0.17, 0.44]} rotation={[0, 0, 0.12]} material={materials.hair}>
          <boxGeometry args={[0.16, 0.035, 0.04]} />
        </mesh>
        <mesh position={[0.18, 0.17, 0.44]} rotation={[0, 0, -0.12]} material={materials.hair}>
          <boxGeometry args={[0.16, 0.035, 0.04]} />
        </mesh>

        {/* nose */}
        <mesh position={[0, -0.09, 0.48]} scale={[0.09, 0.13, 0.1]} material={materials.skinDark}>
          <sphereGeometry args={[1, 12, 12]} />
        </mesh>

        {/* smile */}
        <mesh
          position={[0, -0.24, 0.43]}
          rotation={[0.15, 0, Math.PI]}
          material={materials.mouth}
        >
          <torusGeometry args={[0.09, 0.022, 8, 16, Math.PI]} />
        </mesh>

        {/* moustache + goatee */}
        <mesh position={[0, -0.18, 0.455]} material={materials.hair}>
          <boxGeometry args={[0.24, 0.045, 0.05]} />
        </mesh>
        <mesh position={[0, -0.36, 0.33]} scale={[0.17, 0.12, 0.09]} material={materials.hair}>
          <sphereGeometry args={[1, 12, 12]} />
        </mesh>
      </group>

      {/* ----- neck ----- */}
      <mesh position={[0, 0.02, 0]} material={materials.skin}>
        <cylinderGeometry args={[0.16, 0.18, 0.3, 16]} />
      </mesh>

      {/* ----- body / jumper ----- */}
      <mesh position={[0, -0.62, 0]} material={materials.jumper}>
        <capsuleGeometry args={[0.52, 0.55, 8, 24]} />
      </mesh>
      {/* collar */}
      <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.jumperLight}>
        <torusGeometry args={[0.2, 0.07, 12, 24]} />
      </mesh>

      {/* ----- left arm (waves, wears the watch) ----- */}
      <group ref={leftArm} position={[-0.64, -0.34, 0]}>
        <mesh position={[0, -0.28, 0]} material={materials.jumper}>
          <capsuleGeometry args={[0.13, 0.42, 8, 16]} />
        </mesh>
        {/* watch */}
        <mesh position={[0, -0.5, 0]} material={materials.strap}>
          <torusGeometry args={[0.145, 0.038, 10, 20]} />
        </mesh>
        <mesh position={[0, -0.5, 0.15]} rotation={[Math.PI / 2, 0, 0]} material={materials.face}>
          <cylinderGeometry args={[0.085, 0.085, 0.035, 20]} />
        </mesh>
        {/* hand */}
        <mesh position={[0, -0.68, 0]} material={materials.skin}>
          <sphereGeometry args={[0.14, 16, 16]} />
        </mesh>
      </group>

      {/* ----- right arm (resting) ----- */}
      <group ref={rightArm} position={[0.64, -0.34, 0]}>
        <mesh position={[0, -0.28, 0]} material={materials.jumper}>
          <capsuleGeometry args={[0.13, 0.42, 8, 16]} />
        </mesh>
        <mesh position={[0, -0.66, 0]} material={materials.skin}>
          <sphereGeometry args={[0.14, 16, 16]} />
        </mesh>
      </group>
    </group>
  );
}
