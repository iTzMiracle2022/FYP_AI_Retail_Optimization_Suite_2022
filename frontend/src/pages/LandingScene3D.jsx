import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Environment, ContactShadows, Sphere } from '@react-three/drei';

const AnimatedShape = ({ position, color, distort, speed, scale }) => {
  const mesh = useRef();
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    mesh.current.rotation.x = Math.cos(t / 4) / 2;
    mesh.current.rotation.y = Math.sin(t / 4) / 2;
    mesh.current.position.y = position[1] + Math.sin(t / 1.5) * 0.2;
  });

  return (
    <Float speed={speed} rotationIntensity={1.5} floatIntensity={2}>
      <Sphere ref={mesh} args={[1, 64, 64]} position={position} scale={scale}>
        <MeshDistortMaterial
          color={color}
          envMapIntensity={1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          metalness={0.1}
          roughness={0.2}
          distort={distort}
          speed={speed * 2}
        />
      </Sphere>
    </Float>
  );
};

export default function LandingScene3D() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#2563EB" />
      
      <AnimatedShape position={[-1.2, 0.5, 0]} color="#2563EB" distort={0.4} speed={2} scale={1.2} />
      <AnimatedShape position={[1.5, -0.8, -1]} color="#7C3AED" distort={0.3} speed={1.5} scale={0.8} />
      <AnimatedShape position={[0.5, 1.2, -2]} color="#06B6D4" distort={0.5} speed={3} scale={0.6} />
      
      <Environment preset="city" />
      <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={10} blur={2} far={4} color="#0F172A" />
    </Canvas>
  );
}
