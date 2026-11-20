import './renderer-port.ts';
import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULT_CONFIG } from '../../../src/presets/preset.ts';

declare global {
  interface Window {
    orbitTest: {
      snapshot: () => { position: number[]; quaternion: number[]; distance: number };
      events: string[];
      setEnabled: (enabled: boolean) => void;
      dispose: () => void;
    };
  }
}

// Only the UI shell uses a fake port. Camera math and event handling are the
// pinned real Three implementation, with no renderer or camera test double.
const canvas = document.querySelector<HTMLCanvasElement>('#preview-canvas')!;
const camera = new PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
camera.position.set(0, 0, DEFAULT_CONFIG.camera.distance);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 5;
controls.maxDistance = 500;
controls.update();
const events: string[] = [];
const pointer = (event: PointerEvent): void => { events.push(`pointerdown:${event.pointerType}`); };
const wheel = (): void => { events.push('wheel'); };
canvas.addEventListener('pointerdown', pointer);
canvas.addEventListener('wheel', wheel);
const dispose = (): void => {
  controls.dispose();
  canvas.removeEventListener('pointerdown', pointer);
  canvas.removeEventListener('wheel', wheel);
};
window.addEventListener('beforeunload', dispose, { once: true });
window.orbitTest = {
  snapshot: () => ({ position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
    distance: camera.position.distanceTo(controls.target) }),
  events,
  setEnabled: enabled => { controls.enabled = enabled; },
  dispose,
};
