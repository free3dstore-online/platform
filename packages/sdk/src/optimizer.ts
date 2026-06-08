import * as THREE from 'three';

export interface OptimizeOptions {
  targetRatio?: number;
  mergeVertices?: boolean;
  computeNormals?: boolean;
}

export function optimizeMesh(
  object: THREE.Object3D,
  options: OptimizeOptions = {},
): { originalVertices: number; optimizedVertices: number } {
  const { mergeVertices = true, computeNormals = true } = options;
  let originalVertices = 0;
  let optimizedVertices = 0;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;
    const geo = child.geometry;

    originalVertices += geo.attributes.position?.count ?? 0;

    if (!geo.index && mergeVertices) {
      // Convert to indexed geometry by merging close vertices
      const positions = geo.attributes.position;
      const map = new Map<string, number>();
      const indices: number[] = [];
      const newPositions: number[] = [];

      for (let i = 0; i < positions.count; i++) {
        const x = Math.round(positions.getX(i) * 1e4) / 1e4;
        const y = Math.round(positions.getY(i) * 1e4) / 1e4;
        const z = Math.round(positions.getZ(i) * 1e4) / 1e4;
        const key = `${x},${y},${z}`;

        if (map.has(key)) {
          indices.push(map.get(key)!);
        } else {
          const idx = newPositions.length / 3;
          map.set(key, idx);
          newPositions.push(x, y, z);
          indices.push(idx);
        }
      }

      geo.setIndex(indices);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    }

    if (computeNormals) {
      geo.computeVertexNormals();
    }

    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    optimizedVertices += geo.attributes.position?.count ?? 0;
  });

  return { originalVertices, optimizedVertices };
}
