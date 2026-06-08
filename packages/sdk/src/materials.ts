import * as THREE from 'three';

export interface PBROptions {
  color?: string | number;
  metalness?: number;
  roughness?: number;
  normalScale?: number;
  emissive?: string | number;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
  wireframe?: boolean;
}

export function createPBRMaterial(options: PBROptions = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.color ?? 0x808080),
    metalness: options.metalness ?? 0.0,
    roughness: options.roughness ?? 0.5,
    emissive: new THREE.Color(options.emissive ?? 0x000000),
    emissiveIntensity: options.emissiveIntensity ?? 0,
    opacity: options.opacity ?? 1,
    transparent: options.transparent ?? false,
    wireframe: options.wireframe ?? false,
    side: THREE.DoubleSide,
  });
}
