import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

export type ExportFormat = 'glb' | 'gltf' | 'stl' | 'obj';

export async function exportModel(
  object: THREE.Object3D,
  format: ExportFormat,
): Promise<Blob> {
  switch (format) {
    case 'glb': {
      const exporter = new GLTFExporter();
      const result = await exporter.parseAsync(object, { binary: true });
      return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
    }
    case 'gltf': {
      const exporter = new GLTFExporter();
      const result = await exporter.parseAsync(object, { binary: false });
      return new Blob([JSON.stringify(result)], { type: 'model/gltf+json' });
    }
    case 'stl': {
      const exporter = new STLExporter();
      const result = exporter.parse(object, { binary: true });
      return new Blob([result], { type: 'model/stl' });
    }
    case 'obj': {
      const exporter = new OBJExporter();
      const result = exporter.parse(object);
      return new Blob([result], { type: 'text/plain' });
    }
  }
}
