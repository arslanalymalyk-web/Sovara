import * as THREE from 'three';
import { createRGSBadgeModel, createRGSBadgeEnvironment, frameRGSBadgeCamera } from '../src/createObjectModel';

// Small embeddable badge for the portal login: one persistent canvas that is moved into whichever host the
// login screen currently renders (the portal rebuilds its DOM on every state change).
// Sways gently so the thickness reads; static when the visitor prefers reduced motion; pauses when the
// canvas is detached or the tab is hidden.
let state: { canvas: HTMLCanvasElement; renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; model: THREE.Group; running: boolean; t0: number } | null = null;
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function create() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 0.7;
  const scene = new THREE.Scene();
  scene.environment = createRGSBadgeEnvironment(renderer);
  scene.environmentIntensity = 0.2;
  // Neutral key / fill / rim, as in the spec's lightingFromPhoto.
  for (const [dir, i] of [[[-0.35, 0.45, 1], 0.7 * 2.2], [[0.5, -0.1, 1], 0.7], [[0.4, 0.5, -1], 1.1]] as const) {
    const l = new THREE.DirectionalLight(0xffffff, i);
    l.position.set(dir[0], dir[1], dir[2]).multiplyScalar(6);
    scene.add(l);
  }
  const model = createRGSBadgeModel({ castShadow: false, receiveShadow: false });
  scene.add(model);
  const camera = new THREE.PerspectiveCamera(20, 1, 0.01, 50);
  state = { canvas, renderer, scene, camera, model, running: false, t0: performance.now() };
  return state;
}

function frame() {
  const s = state!;
  if (!s.canvas.isConnected || document.hidden) { s.running = false; return; }
  const t = (performance.now() - s.t0) / 1000;
  // cubed sine: dwells near front-on (legible) and swings out briefly to show the thickness
  s.model.rotation.y = reduce() ? -0.3 : 0.55 * Math.sin(t * 0.8) ** 3;
  s.model.rotation.x = 0.1;
  s.renderer.render(s.scene, s.camera);
  if (reduce()) { s.running = false; return; }   // one frame is enough when nothing moves
  requestAnimationFrame(frame);
}

export function mountRGSBadge(host: HTMLElement): void {
  const s = state ?? create();
  host.appendChild(s.canvas);
  const size = Math.max(32, Math.round(host.clientWidth || 84));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  s.renderer.setPixelRatio(dpr);
  s.renderer.setSize(size, size, false);
  s.canvas.style.width = '100%'; s.canvas.style.height = '100%';
  s.camera.aspect = 1; s.camera.updateProjectionMatrix();
  s.model.rotation.set(0, 0, 0);
  frameRGSBadgeCamera(s.camera, s.model, { margin: 1.14, azimuthDeg: 0, elevationDeg: 0 });
  host.classList.add('ready');
  if (!s.running) { s.running = true; requestAnimationFrame(frame); }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (state && !state.running && !document.hidden && state.canvas.isConnected) { state.running = true; requestAnimationFrame(frame); } });
