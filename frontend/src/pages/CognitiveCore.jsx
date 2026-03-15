import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  Float, MeshDistortMaterial, 
  Sphere, Stars 
} from '@react-three/drei';
import * as THREE from 'three';

const PulsingCore = () => {
  const meshRef = useRef();
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    meshRef.current.distort = THREE.MathUtils.lerp(meshRef.current.distort, 0.4 + Math.sin(time) * 0.1, 0.1);
    meshRef.current.speed = THREE.MathUtils.lerp(meshRef.current.speed, 2, 0.1);
  });

  return (
    <Sphere args={[1, 64, 64]}>
      <MeshDistortMaterial
        ref={meshRef}
        color="#a855f7"
        attach="material"
        distort={0.4}
        speed={2}
        roughness={0}
        metalness={1}
        emissive="#7c3aed"
        emissiveIntensity={0.5}
      />
    </Sphere>
  );
};

const DataSwarm = ({ count = 100 }) => {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 10;
      p[i * 3 + 1] = (Math.random() - 0.5) * 10;
      p[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return p;
  }, [count]);

  const pointsRef = useRef();

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    pointsRef.current.rotation.y = time * 0.05;
    pointsRef.current.rotation.z = time * 0.03;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length / 3}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#06b6d4"
        sizeAttenuation
        transparent
        opacity={0.6}
      />
    </points>
  );
};

const CognitiveCore = () => {
  return (
    <div className="r3f-canvas-container">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#a855f7" />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} color="#06b6d4" />
        
        <Float speed={2} rotationIntensity={1} floatIntensity={2}>
          <PulsingCore />
        </Float>
        
        <DataSwarm count={200} />
        <Stars radius={100} depth={50} count={500} factor={4} saturation={0} fade speed={1} />
      </Canvas>

      <style>{`
        .r3f-canvas-container {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          z-index: -1;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default CognitiveCore;
