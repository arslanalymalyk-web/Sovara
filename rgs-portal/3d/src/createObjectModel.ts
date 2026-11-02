import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: RGS Badge
// Sculpt build pass: lighting-pass
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createRGSBadgeModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "RGS Badge";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["badge-orange"] = createSculptMaterial(
    "badge-orange",
    {"id": "badge-orange", "name": "Badge orange (painted plastic, matte print)", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#F55B37", "color": "#F55B37", "albedo": {"dominant": "#F55B37", "secondary": ["#F2603C", "#EF5A35"], "samplingNotes": "Sampled from the reference disc: rgb(245,91,55). Flat print; no gradient observed, so a single albedo zone."}, "colorVariation": {"palette": ["#F55B37"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.85, "variation": 0.04, "map": "constant", "localResponse": "matte print; the reference shows no specular highlight, so roughness is high; cut-out walls slightly rougher"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.15, "contactShadowBias": 0.2, "notes": "Light darkening inside the cut-outs only."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "cutout-wall-shade", "region": "letter cut-out walls", "roughness": 0.9, "notes": "walls of the cut-outs read slightly darker/less glossy from AO"}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Flat enamel/print finish read from a 134 px PNG: no relief, wear or dirt is observable, so none is invented. Roughness 0.85: matte, because the reference shows no specular highlight at all (0.5 left a measurable white sheen that pushed the render +15 blue against the reference).", "textureless": {"declared": true, "evidence": ["pbr-report.json (extract_pbr_evidence.py on the isolated reference, confidence 0.86): palette F16033 / EE612F / EF6340, value range ~0.08, no usable height or normal signal", "reference.png / reference-4x.png: the disc is a single flat orange with no gradient, grain, wear or relief at 134 px; the only structure is the silhouette and the letter boundaries", "Attempting to apply the extracted maps as tiled textures printed four ghost copies of the logo across the face (captured and rejected), which is why they are not used"]}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Badge body (notched disc with RGS cut-outs)__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, -0.05);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Badge body (notched disc with RGS cut-outs)", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "One flat rigid plate with hard faces (a badge):  the silhouette, the 8 perimeter steps and the three letter cut-outs all come from a single traced 2D profile (extrude with holes), not from separate boxes.", "geometryDescriptor": {"topologyIntent": "extruded notched disc with three through-holes", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.00704, 0.49858], [-0.09135, 0.49112], [-0.13652, 0.48061], [-0.1444, 0.47145], [-0.15003, 0.43532], [-0.16362, 0.42181], [-0.18921, 0.41353], [-0.28255, 0.41087], [-0.30799, 0.39467], [-0.36235, 0.34522], [-0.38794, 0.31654], [-0.40747, 0.28477], [-0.40948, 0.18992], [-0.41476, 0.17034], [-0.4301, 0.15525], [-0.47225, 0.14504], [-0.48003, 0.13572], [-0.49796, 0.0499], [-0.49989, -0.01333], [-0.49306, -0.07957], [-0.47631, -0.15033], [-0.46773, -0.15768], [-0.43311, -0.16242], [-0.42007, -0.17442], [-0.40981, -0.19851], [-0.40927, -0.27078], [-0.40597, -0.28884], [-0.3863, -0.31895], [-0.33675, -0.37066], [-0.30514, -0.3972], [-0.27954, -0.41204], [-0.19072, -0.41377], [-0.17416, -0.4186], [-0.1589, -0.43337], [-0.15074, -0.47101], [-0.13953, -0.48056], [-0.06877, -0.49448], [0.00952, -0.49862], [0.08931, -0.49199], [0.1405, -0.4804], [0.15104, -0.47047], [0.15706, -0.43857], [0.17362, -0.41923], [0.19319, -0.41369], [0.28202, -0.4112], [0.3046, -0.39803], [0.36181, -0.3455], [0.38553, -0.31895], [0.41089, -0.28282], [0.41338, -0.1955], [0.42091, -0.17442], [0.43558, -0.16242], [0.46871, -0.15761], [0.47605, -0.15033], [0.49398, -0.08258], [0.49993, 0.00925], [0.4944, 0.08001], [0.48039, 0.13421], [0.47172, 0.14521], [0.4386, 0.15134], [0.4204, 0.16432], [0.4131, 0.18992], [0.4106, 0.28326], [0.3859, 0.31826], [0.33622, 0.37072], [0.3046, 0.39781], [0.28052, 0.41159], [0.20072, 0.4139], [0.18266, 0.41943], [0.16801, 0.43532], [0.15941, 0.46995], [0.139, 0.4806], [0.0848, 0.49206]], "holes": [[[-0.35632, 0.10263], [-0.36385, 0.09913], [-0.36848, 0.09206], [-0.37073, 0.06646], [-0.36976, 0.01076], [-0.36536, 0.00167], [-0.35632, -0.00388], [-0.33976, -0.00291], [-0.32927, 0.00624], [-0.3267, 0.01528], [-0.32588, 0.05291], [-0.32268, 0.05894], [-0.31718, 0.06214], [-0.20577, 0.06277], [-0.19222, 0.06012], [-0.18319, 0.05458], [-0.17946, 0.04388], [-0.17976, 0.03033], [-0.18319, 0.02068], [-0.18921, 0.01494], [-0.20427, 0.01211], [-0.28255, 0.01167], [-0.29008, 0.00802], [-0.29217, 0.00022], [-0.28301, -0.01333], [-0.19824, -0.08302], [-0.17566, -0.09738], [-0.16813, -0.09768], [-0.16061, -0.09345], [-0.15372, -0.07957], [-0.15755, -0.06602], [-0.20189, -0.0314], [-0.20696, -0.02387], [-0.20577, -0.0202], [-0.20125, -0.0178], [-0.1591, -0.01179], [-0.14695, 0.00022], [-0.13919, 0.0213], [-0.13806, 0.04539], [-0.1425, 0.06496], [-0.15157, 0.08307], [-0.17416, 0.09804], [-0.19222, 0.10229]], [[-0.03565, 0.10263], [-0.05823, 0.09857], [-0.07178, 0.09226], [-0.0901, 0.08001], [-0.09777, 0.06646], [-0.10048, 0.0484], [-0.10035, -0.04796], [-0.09771, -0.06301], [-0.09112, -0.07656], [-0.07931, -0.08541], [-0.05898, -0.09463], [-0.04317, -0.09896], [-0.01909, -0.10106], [0.07877, -0.09963], [0.09533, -0.09527], [0.12001, -0.08258], [0.13056, -0.06903], [0.13616, -0.05398], [0.13724, -0.0058], [0.13231, 0.01226], [0.12545, 0.01858], [0.11641, 0.02176], [0.10286, 0.01991], [0.09477, 0.01076], [0.09214, 0.00022], [0.09121, -0.04495], [0.08781, -0.05311], [0.08179, -0.05781], [0.06071, -0.06047], [-0.02661, -0.06033], [-0.04167, -0.05832], [-0.05048, -0.05247], [-0.0545, -0.04495], [-0.05566, -0.03441], [-0.05559, 0.03635], [-0.05267, 0.05141], [-0.04769, 0.0566], [-0.03866, 0.06], [0.01715, 0.06496], [0.02608, 0.07115], [0.03033, 0.08152], [0.02669, 0.09507], [0.01705, 0.10191]], [[0.22933, 0.10269], [0.21427, 0.10053], [0.20155, 0.09507], [0.18567, 0.0844], [0.1784, 0.0755], [0.17381, 0.05592], [0.17344, 0.03334], [0.17569, 0.01678], [0.18093, 0.00624], [0.19319, -0.00321], [0.22029, -0.01179], [0.31063, -0.01418], [0.32869, -0.01706], [0.33773, -0.02205], [0.34295, -0.02839], [0.34484, -0.04645], [0.33773, -0.05686], [0.32568, -0.06015], [0.18567, -0.06161], [0.17814, -0.06587], [0.17404, -0.07355], [0.17343, -0.08409], [0.17706, -0.09312], [0.18416, -0.09895], [0.1947, -0.10099], [0.32418, -0.10084], [0.35278, -0.09474], [0.37821, -0.08108], [0.38677, -0.06903], [0.39117, -0.05097], [0.39038, -0.01935], [0.38289, -0.00306], [0.36633, 0.00974], [0.33773, 0.02076], [0.24137, 0.02334], [0.22337, 0.02882], [0.21833, 0.03485], [0.21653, 0.04237], [0.21807, 0.05141], [0.2229, 0.05743], [0.23836, 0.06277], [0.27901, 0.06439], [0.28825, 0.07098], [0.29202, 0.08152], [0.28955, 0.09377], [0.28052, 0.10191]]], "depth": 0.1}}, "parent": null, "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 0.1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, -0.05], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0.05], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "face-front", "localPosition": [0, 0, 0.1], "purpose": "front face anchor (wordmark centre)"}], "collider": {"type": "box", "offset": [0, 0, 0.05], "scale": [1.0, 1.0, 0.1], "isTrigger": false, "notes": "Thin box proxy (disc is near-square in plan)."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "badge-orange"}}, "material": "badge-orange", "materialLayers": ["badge-orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "perimeter-notches", "type": "contour", "description": "8 shallow rectangular steps cut into the perimeter (top, bottom, left, right pairs) with chamfered facets between them. Carried by the traced outline (73 vertices, RDP 0.25 px).", "confidence": 0.85}, {"id": "letter-cutouts", "type": "hole", "description": "R, G and S cut fully through the disc (holes in the extrude profile; 43, 43 and 46 vertices, RDP 0.18 px); the R keeps its leg gap.", "confidence": 0.85}], "surfaceDetail": {"macroRoughness": 0.5, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "none", "displacementPattern": "none", "occlusionPattern": "cutout-edge", "edgeWearPattern": "none", "notes": "Flat print; no relief observed."}, "evidenceRefs": ["full-object", "perimeter", "wordmark"], "details": ["perimeter-notches", "letter-cutouts"], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(245, 91, 55, 1.0)", "secondaryAlbedo": "rgba(239, 90, 53, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "notes": "Sampled from the flat orange print; class is an assumption (painted plastic/enamel badge), not observable."}};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0.05], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "face-front", "localPosition": [0, 0, 0.1], "purpose": "front face anchor (wordmark centre)"}], "collider": {"type": "box", "offset": [0, 0, 0.05], "scale": [1.0, 1.0, 0.1], "isTrigger": false, "notes": "Thin box proxy (disc is near-square in plan)."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "badge-orange"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 8, 4)
    : buildExtrudeGeometry({"points": [[-0.00704, 0.49858], [-0.09135, 0.49112], [-0.13652, 0.48061], [-0.1444, 0.47145], [-0.15003, 0.43532], [-0.16362, 0.42181], [-0.18921, 0.41353], [-0.28255, 0.41087], [-0.30799, 0.39467], [-0.36235, 0.34522], [-0.38794, 0.31654], [-0.40747, 0.28477], [-0.40948, 0.18992], [-0.41476, 0.17034], [-0.4301, 0.15525], [-0.47225, 0.14504], [-0.48003, 0.13572], [-0.49796, 0.0499], [-0.49989, -0.01333], [-0.49306, -0.07957], [-0.47631, -0.15033], [-0.46773, -0.15768], [-0.43311, -0.16242], [-0.42007, -0.17442], [-0.40981, -0.19851], [-0.40927, -0.27078], [-0.40597, -0.28884], [-0.3863, -0.31895], [-0.33675, -0.37066], [-0.30514, -0.3972], [-0.27954, -0.41204], [-0.19072, -0.41377], [-0.17416, -0.4186], [-0.1589, -0.43337], [-0.15074, -0.47101], [-0.13953, -0.48056], [-0.06877, -0.49448], [0.00952, -0.49862], [0.08931, -0.49199], [0.1405, -0.4804], [0.15104, -0.47047], [0.15706, -0.43857], [0.17362, -0.41923], [0.19319, -0.41369], [0.28202, -0.4112], [0.3046, -0.39803], [0.36181, -0.3455], [0.38553, -0.31895], [0.41089, -0.28282], [0.41338, -0.1955], [0.42091, -0.17442], [0.43558, -0.16242], [0.46871, -0.15761], [0.47605, -0.15033], [0.49398, -0.08258], [0.49993, 0.00925], [0.4944, 0.08001], [0.48039, 0.13421], [0.47172, 0.14521], [0.4386, 0.15134], [0.4204, 0.16432], [0.4131, 0.18992], [0.4106, 0.28326], [0.3859, 0.31826], [0.33622, 0.37072], [0.3046, 0.39781], [0.28052, 0.41159], [0.20072, 0.4139], [0.18266, 0.41943], [0.16801, 0.43532], [0.15941, 0.46995], [0.139, 0.4806], [0.0848, 0.49206]], "holes": [[[-0.35632, 0.10263], [-0.36385, 0.09913], [-0.36848, 0.09206], [-0.37073, 0.06646], [-0.36976, 0.01076], [-0.36536, 0.00167], [-0.35632, -0.00388], [-0.33976, -0.00291], [-0.32927, 0.00624], [-0.3267, 0.01528], [-0.32588, 0.05291], [-0.32268, 0.05894], [-0.31718, 0.06214], [-0.20577, 0.06277], [-0.19222, 0.06012], [-0.18319, 0.05458], [-0.17946, 0.04388], [-0.17976, 0.03033], [-0.18319, 0.02068], [-0.18921, 0.01494], [-0.20427, 0.01211], [-0.28255, 0.01167], [-0.29008, 0.00802], [-0.29217, 0.00022], [-0.28301, -0.01333], [-0.19824, -0.08302], [-0.17566, -0.09738], [-0.16813, -0.09768], [-0.16061, -0.09345], [-0.15372, -0.07957], [-0.15755, -0.06602], [-0.20189, -0.0314], [-0.20696, -0.02387], [-0.20577, -0.0202], [-0.20125, -0.0178], [-0.1591, -0.01179], [-0.14695, 0.00022], [-0.13919, 0.0213], [-0.13806, 0.04539], [-0.1425, 0.06496], [-0.15157, 0.08307], [-0.17416, 0.09804], [-0.19222, 0.10229]], [[-0.03565, 0.10263], [-0.05823, 0.09857], [-0.07178, 0.09226], [-0.0901, 0.08001], [-0.09777, 0.06646], [-0.10048, 0.0484], [-0.10035, -0.04796], [-0.09771, -0.06301], [-0.09112, -0.07656], [-0.07931, -0.08541], [-0.05898, -0.09463], [-0.04317, -0.09896], [-0.01909, -0.10106], [0.07877, -0.09963], [0.09533, -0.09527], [0.12001, -0.08258], [0.13056, -0.06903], [0.13616, -0.05398], [0.13724, -0.0058], [0.13231, 0.01226], [0.12545, 0.01858], [0.11641, 0.02176], [0.10286, 0.01991], [0.09477, 0.01076], [0.09214, 0.00022], [0.09121, -0.04495], [0.08781, -0.05311], [0.08179, -0.05781], [0.06071, -0.06047], [-0.02661, -0.06033], [-0.04167, -0.05832], [-0.05048, -0.05247], [-0.0545, -0.04495], [-0.05566, -0.03441], [-0.05559, 0.03635], [-0.05267, 0.05141], [-0.04769, 0.0566], [-0.03866, 0.06], [0.01715, 0.06496], [0.02608, 0.07115], [0.03033, 0.08152], [0.02669, 0.09507], [0.01705, 0.10191]], [[0.22933, 0.10269], [0.21427, 0.10053], [0.20155, 0.09507], [0.18567, 0.0844], [0.1784, 0.0755], [0.17381, 0.05592], [0.17344, 0.03334], [0.17569, 0.01678], [0.18093, 0.00624], [0.19319, -0.00321], [0.22029, -0.01179], [0.31063, -0.01418], [0.32869, -0.01706], [0.33773, -0.02205], [0.34295, -0.02839], [0.34484, -0.04645], [0.33773, -0.05686], [0.32568, -0.06015], [0.18567, -0.06161], [0.17814, -0.06587], [0.17404, -0.07355], [0.17343, -0.08409], [0.17706, -0.09312], [0.18416, -0.09895], [0.1947, -0.10099], [0.32418, -0.10084], [0.35278, -0.09474], [0.37821, -0.08108], [0.38677, -0.06903], [0.39117, -0.05097], [0.39038, -0.01935], [0.38289, -0.00306], [0.36633, 0.00974], [0.33773, 0.02076], [0.24137, 0.02334], [0.22337, 0.02882], [0.21833, 0.03485], [0.21653, 0.04237], [0.21807, 0.05141], [0.2229, 0.05743], [0.23836, 0.06277], [0.27901, 0.06439], [0.28825, 0.07098], [0.29202, 0.08152], [0.28955, 0.09377], [0.28052, 0.10191]]], "depth": 0.1});
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["badge-orange"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Badge body (notched disc with RGS cut-outs)";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Badge body (notched disc with RGS cut-outs)", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "One flat rigid plate with hard faces (a badge):  the silhouette, the 8 perimeter steps and the three letter cut-outs all come from a single traced 2D profile (extrude with holes), not from separate boxes.", "geometryDescriptor": {"topologyIntent": "extruded notched disc with three through-holes", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[-0.00704, 0.49858], [-0.09135, 0.49112], [-0.13652, 0.48061], [-0.1444, 0.47145], [-0.15003, 0.43532], [-0.16362, 0.42181], [-0.18921, 0.41353], [-0.28255, 0.41087], [-0.30799, 0.39467], [-0.36235, 0.34522], [-0.38794, 0.31654], [-0.40747, 0.28477], [-0.40948, 0.18992], [-0.41476, 0.17034], [-0.4301, 0.15525], [-0.47225, 0.14504], [-0.48003, 0.13572], [-0.49796, 0.0499], [-0.49989, -0.01333], [-0.49306, -0.07957], [-0.47631, -0.15033], [-0.46773, -0.15768], [-0.43311, -0.16242], [-0.42007, -0.17442], [-0.40981, -0.19851], [-0.40927, -0.27078], [-0.40597, -0.28884], [-0.3863, -0.31895], [-0.33675, -0.37066], [-0.30514, -0.3972], [-0.27954, -0.41204], [-0.19072, -0.41377], [-0.17416, -0.4186], [-0.1589, -0.43337], [-0.15074, -0.47101], [-0.13953, -0.48056], [-0.06877, -0.49448], [0.00952, -0.49862], [0.08931, -0.49199], [0.1405, -0.4804], [0.15104, -0.47047], [0.15706, -0.43857], [0.17362, -0.41923], [0.19319, -0.41369], [0.28202, -0.4112], [0.3046, -0.39803], [0.36181, -0.3455], [0.38553, -0.31895], [0.41089, -0.28282], [0.41338, -0.1955], [0.42091, -0.17442], [0.43558, -0.16242], [0.46871, -0.15761], [0.47605, -0.15033], [0.49398, -0.08258], [0.49993, 0.00925], [0.4944, 0.08001], [0.48039, 0.13421], [0.47172, 0.14521], [0.4386, 0.15134], [0.4204, 0.16432], [0.4131, 0.18992], [0.4106, 0.28326], [0.3859, 0.31826], [0.33622, 0.37072], [0.3046, 0.39781], [0.28052, 0.41159], [0.20072, 0.4139], [0.18266, 0.41943], [0.16801, 0.43532], [0.15941, 0.46995], [0.139, 0.4806], [0.0848, 0.49206]], "holes": [[[-0.35632, 0.10263], [-0.36385, 0.09913], [-0.36848, 0.09206], [-0.37073, 0.06646], [-0.36976, 0.01076], [-0.36536, 0.00167], [-0.35632, -0.00388], [-0.33976, -0.00291], [-0.32927, 0.00624], [-0.3267, 0.01528], [-0.32588, 0.05291], [-0.32268, 0.05894], [-0.31718, 0.06214], [-0.20577, 0.06277], [-0.19222, 0.06012], [-0.18319, 0.05458], [-0.17946, 0.04388], [-0.17976, 0.03033], [-0.18319, 0.02068], [-0.18921, 0.01494], [-0.20427, 0.01211], [-0.28255, 0.01167], [-0.29008, 0.00802], [-0.29217, 0.00022], [-0.28301, -0.01333], [-0.19824, -0.08302], [-0.17566, -0.09738], [-0.16813, -0.09768], [-0.16061, -0.09345], [-0.15372, -0.07957], [-0.15755, -0.06602], [-0.20189, -0.0314], [-0.20696, -0.02387], [-0.20577, -0.0202], [-0.20125, -0.0178], [-0.1591, -0.01179], [-0.14695, 0.00022], [-0.13919, 0.0213], [-0.13806, 0.04539], [-0.1425, 0.06496], [-0.15157, 0.08307], [-0.17416, 0.09804], [-0.19222, 0.10229]], [[-0.03565, 0.10263], [-0.05823, 0.09857], [-0.07178, 0.09226], [-0.0901, 0.08001], [-0.09777, 0.06646], [-0.10048, 0.0484], [-0.10035, -0.04796], [-0.09771, -0.06301], [-0.09112, -0.07656], [-0.07931, -0.08541], [-0.05898, -0.09463], [-0.04317, -0.09896], [-0.01909, -0.10106], [0.07877, -0.09963], [0.09533, -0.09527], [0.12001, -0.08258], [0.13056, -0.06903], [0.13616, -0.05398], [0.13724, -0.0058], [0.13231, 0.01226], [0.12545, 0.01858], [0.11641, 0.02176], [0.10286, 0.01991], [0.09477, 0.01076], [0.09214, 0.00022], [0.09121, -0.04495], [0.08781, -0.05311], [0.08179, -0.05781], [0.06071, -0.06047], [-0.02661, -0.06033], [-0.04167, -0.05832], [-0.05048, -0.05247], [-0.0545, -0.04495], [-0.05566, -0.03441], [-0.05559, 0.03635], [-0.05267, 0.05141], [-0.04769, 0.0566], [-0.03866, 0.06], [0.01715, 0.06496], [0.02608, 0.07115], [0.03033, 0.08152], [0.02669, 0.09507], [0.01705, 0.10191]], [[0.22933, 0.10269], [0.21427, 0.10053], [0.20155, 0.09507], [0.18567, 0.0844], [0.1784, 0.0755], [0.17381, 0.05592], [0.17344, 0.03334], [0.17569, 0.01678], [0.18093, 0.00624], [0.19319, -0.00321], [0.22029, -0.01179], [0.31063, -0.01418], [0.32869, -0.01706], [0.33773, -0.02205], [0.34295, -0.02839], [0.34484, -0.04645], [0.33773, -0.05686], [0.32568, -0.06015], [0.18567, -0.06161], [0.17814, -0.06587], [0.17404, -0.07355], [0.17343, -0.08409], [0.17706, -0.09312], [0.18416, -0.09895], [0.1947, -0.10099], [0.32418, -0.10084], [0.35278, -0.09474], [0.37821, -0.08108], [0.38677, -0.06903], [0.39117, -0.05097], [0.39038, -0.01935], [0.38289, -0.00306], [0.36633, 0.00974], [0.33773, 0.02076], [0.24137, 0.02334], [0.22337, 0.02882], [0.21833, 0.03485], [0.21653, 0.04237], [0.21807, 0.05141], [0.2229, 0.05743], [0.23836, 0.06277], [0.27901, 0.06439], [0.28825, 0.07098], [0.29202, 0.08152], [0.28955, 0.09377], [0.28052, 0.10191]]], "depth": 0.1}}, "parent": null, "attachment": null, "dimensions": {"width": 1.0, "height": 1.0, "depth": 0.1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 0, -0.05], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0.05], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "face-front", "localPosition": [0, 0, 0.1], "purpose": "front face anchor (wordmark centre)"}], "collider": {"type": "box", "offset": [0, 0, 0.05], "scale": [1.0, 1.0, 0.1], "isTrigger": false, "notes": "Thin box proxy (disc is near-square in plan)."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "badge-orange"}}, "material": "badge-orange", "materialLayers": ["badge-orange"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "perimeter-notches", "type": "contour", "description": "8 shallow rectangular steps cut into the perimeter (top, bottom, left, right pairs) with chamfered facets between them. Carried by the traced outline (73 vertices, RDP 0.25 px).", "confidence": 0.85}, {"id": "letter-cutouts", "type": "hole", "description": "R, G and S cut fully through the disc (holes in the extrude profile; 43, 43 and 46 vertices, RDP 0.18 px); the R keeps its leg gap.", "confidence": 0.85}], "surfaceDetail": {"macroRoughness": 0.5, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "none", "displacementPattern": "none", "occlusionPattern": "cutout-edge", "edgeWearPattern": "none", "notes": "Flat print; no relief observed."}, "evidenceRefs": ["full-object", "perimeter", "wordmark"], "details": ["perimeter-notches", "letter-cutouts"], "fidelityTier": "form", "colorMaterialRecipe": {"dominantAlbedo": "rgba(245, 91, 55, 1.0)", "secondaryAlbedo": "rgba(239, 90, 53, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "notes": "Sampled from the flat orange print; class is an assumption (painted plastic/enamel badge), not observable."}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0.05], "scale": [1.0, 1.0, 0.1], "isTrigger": false, "notes": "Thin box proxy (disc is near-square in plan)."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);
  const socket_root_face_front_0 = new THREE.Object3D();
  socket_root_face_front_0.name = "face-front";
  socket_root_face_front_0.position.set(0.0, 0.0, 0.1);
  socket_root_face_front_0.rotation.set(0, 0, 0);
  socket_root_face_front_0.userData.socket = {"id": "face-front", "localPosition": [0, 0, 0.1], "purpose": "front face anchor (wordmark centre)"};
  node_root_0.add(socket_root_face_front_0);
  sockets["root:face-front"] = socket_root_face_front_0;

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "balanced", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createRGSBadgeLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "RGS Badge look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "key", "type": "key light", "direction": "front-upper-left, ~35 deg above the view axis", "intensity": 2.2, "color": "#FFFFFF", "notes": "The reference has no lighting cue (flat print); a neutral key is chosen so the chamfer reads."}, {"id": "fill", "type": "fill light", "direction": "front-right, low", "intensity": 0.7, "color": "#FFFFFF", "notes": "Neutral white (was #EAF0FF; the blue tint added ~+15 blue to a flat orange print). Lifts the cut-out walls without flattening the face."}, {"id": "rim", "type": "rim light", "direction": "behind-right", "intensity": 1.1, "color": "#FFFFFF", "notes": "Separates the disc edge from the background in three-quarter views."}, {"id": "environment", "type": "environment reflection", "direction": "studio hemisphere", "intensity": 0.5, "color": "#FFFFFF", "notes": "Soft RoomEnvironment-style fill; exposure 1.0, ACES filmic tone mapping, neutral light-grey background, contact shadow on a ground disc."}];
  lights.userData.lookDevTargets = {"qualityPriority": "balanced", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createRGSBadgeEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameRGSBadgeCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createRGSBadgePresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureRGSBadgeRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createRGSBadgeInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
