import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createRGSBadgeModel,
  createRGSBadgeEnvironment,
  frameRGSBadgeCamera,
} from '../src/createObjectModel';

// Review viewpoints used by the img2threejs gates: same camera for reference and render.
const VIEWS: Record<string, { az: number; el: number }> = {
  front: { az: 0, el: 0 },
  'three-quarter': { az: 38, el: 18 },
  side: { az: 90, el: 0 },
  rear: { az: 180, el: 0 },
  left: { az: 270, el: 0 },
};

const q = new URLSearchParams(location.search);
const view = VIEWS[q.get('view') ?? 'front'] ?? VIEWS.front;
const bg = q.get('bg') ?? 'studio';
const spin = q.get('spin') === '1';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const TM: Record<string, THREE.ToneMapping> = { ACES: THREE.ACESFilmicToneMapping, Neutral: THREE.NeutralToneMapping, None: THREE.NoToneMapping };
renderer.toneMapping = TM[q.get('tm') ?? 'None'] ?? THREE.NoToneMapping;
renderer.toneMappingExposure = Number(q.get('exp') ?? 0.7);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(bg === 'white' ? 0xffffff : 0xe9e6df);
scene.environment = createRGSBadgeEnvironment(renderer);
scene.environmentIntensity = Number(q.get('env') ?? 0.2);
// Lights come from the spec's lightingFromPhoto (neutral key / fill / rim + environment), not the generator's tinted default.
const GRAZING = q.get('lights') === 'grazing';
const LIGHTS = { key: { dir: GRAZING ? [1.2, 0.15, 0.55] : [-0.35, 0.45, 1], i: Number(q.get('ks') ?? 0.7) * 2.2 }, fill: { dir: [0.5, -0.1, 1], i: 0.7 }, rim: { dir: [0.4, 0.5, -1], i: 1.1 } };
for (const [id, l] of Object.entries(LIGHTS)) {
  const light = new THREE.DirectionalLight(0xffffff, l.i);
  light.position.set(...(l.dir as [number, number, number])).multiplyScalar(6);
  light.name = id;
  if (id === 'key') { light.castShadow = bg !== 'white'; light.shadow.mapSize.set(2048, 2048); light.shadow.camera.left = -1.5; light.shadow.camera.right = 1.5; light.shadow.camera.top = 1.5; light.shadow.camera.bottom = -1.5; light.shadow.bias = -0.0004; }
  scene.add(light);
}

const model = createRGSBadgeModel({ castShadow: true, receiveShadow: true });
if (q.get('unlit') === '1') {
  // map-stripped review render: flat unlit colour, so the silhouette is judged on geometry alone
  model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const base = (m.material as THREE.MeshStandardMaterial).color; m.material = new THREE.MeshBasicMaterial({ color: base }); m.castShadow = false; } });
}
if (q.get('rough')) model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.MeshStandardMaterial).roughness !== undefined) (m.material as THREE.MeshStandardMaterial).roughness = Number(q.get('rough')); });
scene.add(model);

if (bg !== 'white') {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.58;
  ground.receiveShadow = true;
  scene.add(ground);
}

const camera = new THREE.PerspectiveCamera(Number(q.get('fov') ?? 40), 1, 0.01, 50);
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  frameRGSBadgeCamera(camera, model, { margin: 1.12, azimuthDeg: view.az, elevationDeg: view.el });
}
addEventListener('resize', resize);
resize();

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
if (q.get('orbit') === '0') controls.enabled = false;

function frame() {
  if (spin) model.rotation.y += 0.01;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
(window as any).__IMG2THREEJS_READY__ = true;
(window as any).__RGS_BADGE__ = { model, camera, THREE };
