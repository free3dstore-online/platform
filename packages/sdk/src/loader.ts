import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export type SupportedFormat = 'glb' | 'gltf' | 'obj' | 'stl' | 'fbx';

export interface LoadResult {
  object: THREE.Object3D;
  format: SupportedFormat;
  stats: {
    vertices: number;
    faces: number;
    boundingBox: THREE.Box3;
  };
}

function detectFormat(filename: string): SupportedFormat {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'glb' || ext === 'gltf') return ext as SupportedFormat;
  if (ext === 'obj') return 'obj';
  if (ext === 'stl') return 'stl';
  if (ext === 'fbx') return 'fbx';
  throw new Error(`Unsupported format: ${ext}`);
}

function computeStats(object: THREE.Object3D) {
  let vertices = 0;
  let faces = 0;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geo = child.geometry;
      vertices += geo.attributes.position?.count ?? 0;
      faces += geo.index ? geo.index.count / 3 : (geo.attributes.position?.count ?? 0) / 3;
    }
  });
  const boundingBox = new THREE.Box3().setFromObject(object);
  return { vertices, faces: Math.floor(faces), boundingBox };
}

function centerAndScale(object: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? 2 / maxDim : 1;
  object.position.sub(center);
  object.scale.multiplyScalar(scale);
}

export async function loadModel(file: File): Promise<LoadResult> {
  const format = detectFormat(file.name);
  const arrayBuffer = await file.arrayBuffer();
  const url = URL.createObjectURL(new Blob([arrayBuffer]));

  let object: THREE.Object3D;

  try {
    switch (format) {
      case 'glb':
      case 'gltf': {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);
        object = gltf.scene;
        break;
      }
      case 'obj': {
        const loader = new OBJLoader();
        object = await loader.loadAsync(url);
        break;
      }
      case 'stl': {
        const loader = new STLLoader();
        const geometry = await loader.loadAsync(url);
        const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
        object = new THREE.Mesh(geometry, material);
        break;
      }
      case 'fbx': {
        const loader = new FBXLoader();
        object = await loader.loadAsync(url);
        break;
      }
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  centerAndScale(object);
  const stats = computeStats(object);
  return { object, format, stats };
}
