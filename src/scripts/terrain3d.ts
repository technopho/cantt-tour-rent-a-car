/**
 * The Road North (DESIGN.md experience 6): procedural mountains as brass and ivory points, rising from
 * the Punjab plain to the Karakoram, with the route from Lahore drawn as a glowing line that the
 * camera flies along on scroll. Stop labels are real links in the HTML, positioned from here.
 *
 * The route is a screen-space ribbon: it never draws wider than about 3px however close the camera is,
 * with a faint glow around it and a soft, tapering tip. A denser band of points follows the road, so the
 * ground under the camera has texture from the first frame.
 *
 *   const dispose = mountTerrain({ section, stageEl, canvas, stops, tier, shared, onFail });
 */
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CustomBlending,
  DoubleSide,
  AddEquation,
  OneFactor,
  ZeroFactor,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Tier } from "./tier";

export interface TerrainStop {
  id: string;
  lat: number;
  lon: number;
  element: HTMLElement;
}

export interface TerrainShared {
  p: number;
}

export interface TerrainOptions {
  stageEl: HTMLElement;
  canvas: HTMLCanvasElement;
  stops: TerrainStop[];
  tier: Exclude<Tier, "fallback">;
  shared: TerrainShared;
  onFail: () => void;
}

/* ------------------------------------------------------------------------------------------ */
/* Geography                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const SCALE = 30;
const toX = (lon: number) => (lon - 74) * SCALE;
const toZ = (lat: number) => -(lat - 31.5) * SCALE;

/** Where the Skardu road leaves the Karakoram Highway. Not a stop, only a bend in the line. */
const JUNCTION = { lat: 35.75, lon: 74.6 };

const BOUNDS = { minX: -58, maxX: 82, minZ: -176, maxZ: 14 };
const GRID = 300;

/* ---------- Seeded value noise ---------- */
const PERM = new Uint8Array(512);
{
  let seed = 90127;
  const values = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = values[i & 255];
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const X = xi & 255;
  const Y = yi & 255;
  const a = PERM[X + PERM[Y]] / 255;
  const b = PERM[X + 1 + PERM[Y]] / 255;
  const c = PERM[X + PERM[Y + 1]] / 255;
  const d = PERM[X + 1 + PERM[Y + 1]] / 255;
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function ridged(x: number, y: number): number {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let previous = 1;
  for (let i = 0; i < 6; i++) {
    const n = 1 - Math.abs(valueNoise(x * freq, y * freq) * 2 - 1);
    const sharp = n * n;
    sum += sharp * amp * previous;
    previous = Math.min(1, sharp * 1.6);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const sstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Height without the valley carved along the road. */
function rawHeight(x: number, z: number): number {
  // Punjab is flat. The Salt Range is a low ripple, then the land climbs all the way north.
  const north = sstep(-34, -120, z);
  const saltRange = sstep(-26, -40, z) * (1 - sstep(-46, -58, z));
  const plain = valueNoise(x * 0.09, z * 0.09) * 0.4;
  return plain + saltRange * ridged(x * 0.07, z * 0.07) * 5 + (north * 0.35 + north * north * 0.65) * ridged(x * 0.03 + 7, z * 0.03 + 3) * 46 + north * 1.5;
}

/* ------------------------------------------------------------------------------------------ */
/* Shaders                                                                                      */
/* ------------------------------------------------------------------------------------------ */

const pointVert = /* glsl */ `
attribute float aHeight;
attribute float aSeed;
attribute float aShade;
uniform float uTime;
uniform float uScale;
uniform float uPx;
uniform float uFogNear;
uniform float uFogFar;
varying float vLight;
varying vec3 vColor;

const vec3 BRASS = vec3(0.78, 0.56, 0.3);
const vec3 IVORY = vec3(1.0, 0.92, 0.78);
const vec3 DEEP = vec3(0.62, 0.43, 0.23);

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float h = aHeight;
  float twinkle = 0.85 + 0.15 * sin(uTime * (0.6 + aSeed) + aSeed * 40.0);
  gl_PointSize = clamp((1.0 + aSeed * 0.5 + h * 0.8) * uScale / max(depth, 1.0), 1.5 * uPx, 3.0 * uPx);
  float fog = 1.0 - smoothstep(uFogNear, uFogFar, depth);
  float near = smoothstep(1.5, 6.0, depth);
  // Lit faces carry the relief; the plain gets a steady glow so the opening screens are never empty.
  float relief = 0.45 + aShade * 2.2;
  float plain = 0.85 + 0.4 * aSeed;
  // Higher is brighter: the plain is dim brass, the Karakoram is ivory.
  float lift = 0.75 + smoothstep(0.0, 0.8, h) * 0.9;
  vLight = fog * near * twinkle * lift * mix(plain, relief, smoothstep(0.015, 0.14, h));
  vColor = h < 0.25 ? mix(DEEP, BRASS, h / 0.25) : mix(BRASS, IVORY, smoothstep(0.25, 0.65, h));
}`;

const pointFrag = /* glsl */ `
varying float vLight;
varying vec3 vColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.25, r);
  gl_FragColor = vec4(vColor * a * vLight, 0.0);
}`;

const lineVert = /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute float aAlong;
uniform vec2 uRes;
uniform float uDraw;
uniform float uWorld;
uniform float uMaxPx;
uniform float uMinPx;
uniform float uPx;
varying float vAlong;
varying float vPx;
varying float vHalf;
void main() {
  mat4 m = projectionMatrix * modelViewMatrix;
  vec4 c = m * vec4(position, 1.0);
  vec4 p = m * vec4(aPrev, 1.0);
  vec4 n = m * vec4(aNext, 1.0);
  vec2 sp = p.xy / max(p.w, 0.001);
  vec2 sn = n.xy / max(n.w, 0.001);
  vec2 dir = (sn - sp) * uRes;
  dir = length(dir) > 0.0001 ? normalize(dir) : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  // A world width, in pixels at this depth, held between a hairline and the cap.
  float px = uWorld * projectionMatrix[1][1] * 0.5 * uRes.y / max(c.w, 0.001);
  // The tip tapers to a point over its last stretch.
  float taper = clamp((uDraw - aAlong) / 0.012, 0.2, 1.0);
  float half_ = clamp(px, uMinPx * uPx, uMaxPx * uPx) * 0.5 * taper;
  c.xy += normal * aSide * half_ * 2.0 / uRes * c.w;
  vAlong = aAlong;
  vPx = aSide * half_;
  vHalf = half_;
  gl_Position = c;
}`;

const lineFrag = /* glsl */ `
uniform float uDraw;
uniform float uHead;
uniform vec3 uColor;
uniform float uGain;
uniform float uCore;
uniform float uPx;
uniform vec3 uGlow;
varying float vAlong;
varying float vPx;
varying float vHalf;
void main() {
  if (vAlong > uDraw) discard;
  float d = abs(vPx);
  // A crisp core about uCore pixels across, inside a soft glow that fills the rest of the ribbon.
  float coreHalf = uCore * uPx * 0.5;
  float core = 1.0 - smoothstep(coreHalf - 0.6 * uPx, coreHalf + 0.6 * uPx, d);
  float glow = exp(-pow(d / max(vHalf * 0.45, 0.5), 2.0)) * 0.28;
  float head = smoothstep(uDraw - 0.05, uDraw, vAlong) * uHead;
  float tip = 1.0 - smoothstep(uDraw - 0.004, uDraw, vAlong) * 0.85;
  float gain = uGain * (0.75 + head * 1.6) * tip;
  gl_FragColor = vec4((uColor * core + uGlow * glow) * gain, 0.0);
}`;

const markerVert = /* glsl */ `
attribute float aAt;
uniform float uDraw;
uniform float uScale;
varying float vOn;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vOn = smoothstep(aAt - 0.01, aAt + 0.01, uDraw);
  gl_PointSize = clamp(uScale * 2.2 / max(-mv.z, 1.0), 10.0, 42.0);
}`;

const markerFrag = /* glsl */ `
varying float vOn;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float dot_ = smoothstep(0.22, 0.14, r);
  float halo = pow(max(1.0 - r, 0.0), 2.2) * 0.65;
  vec3 color = vec3(1.0, 0.86, 0.6);
  gl_FragColor = vec4((color * halo + vec3(1.0, 0.97, 0.9) * dot_) * vOn, 0.0);
}`;

const ADDITIVE = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendSrcAlpha: ZeroFactor,
  blendDstAlpha: OneFactor,
} as const;

/* ------------------------------------------------------------------------------------------ */
/* Mount                                                                                        */
/* ------------------------------------------------------------------------------------------ */

export function mountTerrain(options: TerrainOptions): () => void {
  const { stageEl, canvas, stops, tier, shared, onFail } = options;
  const high = tier === "high";
  const maxDpr = Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1.5);

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance", stencil: false, depth: false });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(maxDpr);

  const scene = new Scene();
  const camera = new PerspectiveCamera(46, 16 / 9, 0.5, 400);

  /* ---------- Route ---------- */
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  const need = (id: string) => {
    const stop = byId.get(id);
    if (!stop) throw new Error(`Missing stop ${id}`);
    return stop;
  };
  const mainStops = ["lahore", "islamabad", "murree", "naran"].map(need);
  const hunza = need("hunza");
  const skardu = need("skardu");

  const toFlat = (s: { lat: number; lon: number }) => new Vector3(toX(s.lon), 0, toZ(s.lat));
  const mainFlat = [...mainStops.map(toFlat), toFlat(JUNCTION), toFlat(hunza)];
  const branchFlat = [toFlat(JUNCTION), toFlat({ lat: 35.45, lon: 75.05 }), toFlat(skardu)];

  const mainCurveFlat = new CatmullRomCurve3(mainFlat, false, "centripetal");
  const branchCurveFlat = new CatmullRomCurve3(branchFlat, false, "centripetal");

  /* ---------- Height grid: fbm once, the road's valley stamped into it, then bilinear lookups ---------- */
  const cellX = (BOUNDS.maxX - BOUNDS.minX) / (GRID - 1);
  const cellZ = (BOUNDS.maxZ - BOUNDS.minZ) / (GRID - 1);
  const grid = new Float32Array(GRID * GRID);
  const corridor = new Float32Array(GRID * GRID).fill(1);
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) grid[iz * GRID + ix] = rawHeight(BOUNDS.minX + ix * cellX, BOUNDS.minZ + iz * cellZ);
  }
  const stamp = (curve: CatmullRomCurve3, samples: number) => {
    const reach = 8;
    const p = new Vector3();
    for (let i = 0; i <= samples; i++) {
      curve.getPoint(i / samples, p);
      const cx = Math.round((p.x - BOUNDS.minX) / cellX);
      const cz = Math.round((p.z - BOUNDS.minZ) / cellZ);
      const rx = Math.ceil(reach / cellX);
      const rz = Math.ceil(reach / cellZ);
      for (let iz = Math.max(0, cz - rz); iz <= Math.min(GRID - 1, cz + rz); iz++) {
        for (let ix = Math.max(0, cx - rx); ix <= Math.min(GRID - 1, cx + rx); ix++) {
          const d = Math.hypot(BOUNDS.minX + ix * cellX - p.x, BOUNDS.minZ + iz * cellZ - p.z) / reach;
          const index = iz * GRID + ix;
          if (d < corridor[index]) corridor[index] = d;
        }
      }
    }
  };
  stamp(mainCurveFlat, 260);
  stamp(branchCurveFlat, 90);
  for (let i = 0; i < grid.length; i++) grid[i] *= 0.06 + 0.94 * sstep(0.14, 1, corridor[i]);

  /** Terrain height at any point, with the valley carved along the road. */
  const height = (x: number, z: number) => {
    const fx = Math.min(GRID - 1.001, Math.max(0, (x - BOUNDS.minX) / cellX));
    const fz = Math.min(GRID - 1.001, Math.max(0, (z - BOUNDS.minZ) / cellZ));
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const u = fx - ix;
    const v = fz - iz;
    const a = grid[iz * GRID + ix];
    const b = grid[iz * GRID + ix + 1];
    const c = grid[(iz + 1) * GRID + ix];
    const d = grid[(iz + 1) * GRID + ix + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  const lifted = (flat: CatmullRomCurve3, samples: number) => {
    const points: Vector3[] = [];
    for (let i = 0; i <= samples; i++) {
      const p = flat.getPoint(i / samples);
      p.y = height(p.x, p.z) + 0.5;
      points.push(p);
    }
    return new CatmullRomCurve3(points, false, "centripetal");
  };
  const mainCurve = lifted(mainCurveFlat, 70);
  const branchCurve = lifted(branchCurveFlat, 26);

  /* ---------- Terrain points ---------- */
  // Rows across the direction of flight: the ridgelines read as drawn lines, like a survey plate.
  const rows = high ? 400 : 230;
  const perRow = high ? 460 : 270;
  // Plus a denser band along the road: the ground right under the camera is what fills the first screens.
  const corridorCount = high ? 110000 : 42000;
  const gridCount = rows * perRow;
  const count = gridCount + corridorCount;
  const positions = new Float32Array(count * 3);
  const heights = new Float32Array(count);
  const seeds = new Float32Array(count);
  const shades = new Float32Array(count);
  const spanX = BOUNDS.maxX - BOUNDS.minX;
  const spanZ = BOUNDS.maxZ - BOUNDS.minZ;
  let rng = 41257;
  const random = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  const scaleHeight = 30;
  const put = (i: number, x: number, z: number) => {
    const y = height(x, z);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    heights[i] = Math.min(1, y / scaleHeight);
    seeds[i] = random();
    // Low sun from the east, so every ridge has a lit face and a dark one.
    const e = 0.8;
    const hx = height(x + e, z) - height(x - e, z);
    const hz = height(x, z + e) - height(x, z - e);
    shades[i] = Math.max(0, Math.min(1, 0.28 + ((-hx * 0.86 + hz * 0.45) / (2 * e)) * 0.7));
  };
  for (let row = 0; row < rows; row++) {
    const z = BOUNDS.minZ + ((row + 0.5) / rows) * spanZ;
    for (let col = 0; col < perRow; col++) put(row * perRow + col, BOUNDS.minX + ((col + random() * 0.7) / perRow) * spanX, z);
  }
  {
    const point = new Vector3();
    const tangent = new Vector3();
    const mainShare = 0.82;
    for (let k = 0; k < corridorCount; k++) {
      const curve = k < corridorCount * mainShare ? mainCurveFlat : branchCurveFlat;
      const t = random();
      curve.getPointAt(t, point);
      curve.getTangentAt(t, tangent);
      // Densest at the road, thinning out to the sides.
      const across = (random() < 0.5 ? -1 : 1) * Math.pow(random(), 1.6) * 16;
      put(gridCount + k, point.x - tangent.z * across + (random() - 0.5) * 0.6, point.z + tangent.x * across + (random() - 0.5) * 0.6);
    }
  }
  const terrainGeometry = new BufferGeometry();
  terrainGeometry.setAttribute("position", new BufferAttribute(positions, 3));
  terrainGeometry.setAttribute("aHeight", new BufferAttribute(heights, 1));
  terrainGeometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  terrainGeometry.setAttribute("aShade", new BufferAttribute(shades, 1));

  const pointUniforms = { uTime: { value: 0 }, uScale: { value: 1 }, uPx: { value: 1 }, uFogNear: { value: 34 }, uFogFar: { value: 175 } };
  const terrainMaterial = new ShaderMaterial({ vertexShader: pointVert, fragmentShader: pointFrag, uniforms: pointUniforms, ...ADDITIVE });
  const terrain = new Points(terrainGeometry, terrainMaterial);
  terrain.frustumCulled = false;
  scene.add(terrain);

  /* ---------- Glowing line ---------- */
  const ivory = new Color(1, 0.94, 0.82);
  const brass = new Color(1, 0.74, 0.42);
  const lineMaterials: ShaderMaterial[] = [];
  const disposables: { dispose(): void }[] = [terrainGeometry, terrainMaterial];

  const resolution = new Vector2(1, 1);
  /** A ribbon along the curve, two vertices per sample, laid out by arc length so the drawn head follows the camera. */
  const ribbon = (curve: CatmullRomCurve3, segments: number) => {
    const points = curve.getSpacedPoints(segments);
    const count = points.length;
    const position = new Float32Array(count * 6);
    const prev = new Float32Array(count * 6);
    const next = new Float32Array(count * 6);
    const side = new Float32Array(count * 2);
    const along = new Float32Array(count * 2);
    points.forEach((point, i) => {
      const a = points[Math.max(0, i - 1)];
      const b = points[Math.min(count - 1, i + 1)];
      for (let k = 0; k < 2; k++) {
        const o = (i * 2 + k) * 3;
        position.set([point.x, point.y, point.z], o);
        prev.set([a.x, a.y, a.z], o);
        next.set([b.x, b.y, b.z], o);
        side[i * 2 + k] = k === 0 ? -1 : 1;
        along[i * 2 + k] = i / (count - 1);
      }
    });
    const index: number[] = [];
    for (let i = 0; i < count - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setAttribute("aPrev", new BufferAttribute(prev, 3));
    geometry.setAttribute("aNext", new BufferAttribute(next, 3));
    geometry.setAttribute("aSide", new BufferAttribute(side, 1));
    geometry.setAttribute("aAlong", new BufferAttribute(along, 1));
    geometry.setIndex(index);
    return geometry;
  };

  const makeLine = (curve: CatmullRomCurve3, segments: number) => {
    const geometry = ribbon(curve, segments);
    const material = new ShaderMaterial({
      vertexShader: lineVert,
      fragmentShader: lineFrag,
      uniforms: {
        uDraw: { value: 0 },
        uHead: { value: 1 },
        uColor: { value: ivory },
        uGain: { value: 1.5 },
        uRes: { value: resolution },
        // Glow ribbon: 0.9 world units, never more than 14px. The core inside it is 2.4px.
        uWorld: { value: 0.9 },
        uMaxPx: { value: 14 },
        uMinPx: { value: 5 },
        uCore: { value: 2.4 },
        uPx: { value: 1 },
        uGlow: { value: brass },
      },
      ...ADDITIVE,
      // The ribbon's winding flips with the direction of travel on screen.
      side: DoubleSide,
    });
    lineMaterials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    scene.add(mesh);
    disposables.push(geometry, material);
    return (draw: number, head: number) => {
      material.uniforms.uDraw.value = draw;
      material.uniforms.uHead.value = head;
    };
  };
  const setMain = makeLine(mainCurve, 700);
  const setBranch = makeLine(branchCurve, 240);

  /* ---------- Stops: where each one sits on the path ---------- */
  const nearestT = (curve: CatmullRomCurve3, target: Vector3) => {
    let bestT = 0;
    let best = Infinity;
    const p = new Vector3();
    for (let i = 0; i <= 240; i++) {
      curve.getPointAt(i / 240, p);
      const d = (p.x - target.x) ** 2 + (p.z - target.z) ** 2;
      if (d < best) {
        best = d;
        bestT = i / 240;
      }
    }
    return bestT;
  };

  /** The scroll budget: the main road takes most of it, then the camera lifts and Skardu joins. */
  const MAIN_END = 0.76;
  const BRANCH_START = 0.76;
  const BRANCH_END = 0.94;

  interface PlacedStop {
    stop: TerrainStop;
    world: Vector3;
    show: number;
    /** Progress by which the label has gone. */
    until: number;
  }

  const placed: PlacedStop[] = stops.map((stop) => {
    const flat = toFlat(stop);
    if (stop.id === "skardu") {
      const end = branchCurve.getPointAt(1);
      return { stop, world: end, show: BRANCH_END - 0.01, until: 1 };
    }
    const t = nearestT(mainCurve, flat);
    return { stop, world: mainCurve.getPointAt(t), show: t * MAIN_END, until: 1 };
  });
  // Hunza and Skardu stay for the final overview. Every other label holds until the next one is coming in.
  const ordered = placed.filter((item) => item.stop.id !== "hunza" && item.stop.id !== "skardu").sort((a, b) => a.show - b.show);
  ordered.forEach((item, i) => {
    const next = ordered[i + 1]?.show ?? MAIN_END;
    item.until = Math.min(item.show + 0.26, Math.max(item.show + 0.07, next - 0.005));
  });

  const markerPositions = new Float32Array(placed.length * 3);
  const markerAts = new Float32Array(placed.length);
  placed.forEach((item, i) => {
    markerPositions[i * 3] = item.world.x;
    markerPositions[i * 3 + 1] = item.world.y;
    markerPositions[i * 3 + 2] = item.world.z;
    markerAts[i] = item.show;
  });
  const markerGeometry = new BufferGeometry();
  markerGeometry.setAttribute("position", new BufferAttribute(markerPositions, 3));
  markerGeometry.setAttribute("aAt", new BufferAttribute(markerAts, 1));
  const markerUniforms = { uDraw: { value: 0 }, uScale: { value: 1 } };
  const markerMaterial = new ShaderMaterial({ vertexShader: markerVert, fragmentShader: markerFrag, uniforms: markerUniforms, ...ADDITIVE });
  const markers = new Points(markerGeometry, markerMaterial);
  markers.frustumCulled = false;
  markers.renderOrder = 4;
  scene.add(markers);
  disposables.push(markerGeometry, markerMaterial);

  /* ---------- Size ---------- */
  let width = 1;
  let height2 = 1;
  let dpr = maxDpr;
  function applySize() {
    width = Math.max(1, stageEl.clientWidth);
    height2 = Math.max(1, stageEl.clientHeight);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height2, false);
    camera.aspect = width / height2;
    camera.fov = camera.aspect < 0.95 ? 58 : 44;
    camera.updateProjectionMatrix();
    pointUniforms.uScale.value = (height2 * dpr) / 28;
    pointUniforms.uPx.value = dpr;
    markerUniforms.uScale.value = (height2 * dpr) / 30;
    resolution.set(width * dpr, height2 * dpr);
    for (const material of lineMaterials) material.uniforms.uPx.value = dpr;
  }
  applySize();

  /* ---------- Frame ---------- */
  const q = new Vector3();
  const ahead = new Vector3();
  const position = new Vector3();
  const look = new Vector3();
  const finalPosition = new Vector3(toX(74.6) - 6, 33, toZ(34.6) + 30);
  const finalLook = new Vector3(toX(75.0), 8, toZ(35.85));
  // A tall screen is narrow: the overview pulls further back and centres between Hunza and Skardu.
  const finalLookTall = new Vector3(toX(75.15), 8, toZ(35.8));
  const finalPositionTall = finalLookTall.clone().add(new Vector3(-0.24, 0.33, 0.9).normalize().multiplyScalar(122));
  const projected = new Vector3();
  let raf = 0;
  let running = false;
  let inView = false;
  let last = 0;
  let time = 0;
  let forced: number | null = null;
  let frames = 0;
  let spent = 0;
  let slow = 0;

  function draw(dt: number) {
    time += dt;
    pointUniforms.uTime.value = time;
    const p = forced ?? shared.p;

    const travel = clamp01(p / MAIN_END);
    const eased = travel;
    // getPointAt, not getPoint: TubeGeometry lays its UVs out by arc length, so the line's head follows.
    mainCurve.getPointAt(eased, q);
    mainCurve.getPointAt(Math.min(1, eased + 0.1), ahead);

    const rise = 5.5 + eased * 6;
    const back = 18 + eased * 9;
    const dir = ahead.clone().sub(q).setY(0);
    if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
    dir.normalize();
    position.set(q.x - dir.x * back + 4 * Math.sin(eased * 5), q.y + rise, q.z - dir.z * back);
    // The head of the line stays just below the middle of the frame, with the land opening beyond it.
    look.copy(q).addScaledVector(dir, 15);
    look.y = q.y + 1.2;

    const lift = sstep(MAIN_END - 0.03, BRANCH_END, p);
    const tall = camera.aspect < 0.95;
    position.lerp(tall ? finalPositionTall : finalPosition, lift);
    look.lerp(tall ? finalLookTall : finalLook, lift);

    camera.position.copy(position);
    camera.lookAt(look);
    camera.updateMatrixWorld();

    setMain(Math.min(1, travel + 0.002), 1 - lift);
    const branch = clamp01((p - BRANCH_START) / (BRANCH_END - BRANCH_START));
    setBranch(branch, branch < 1 ? 1 : 0);
    markerUniforms.uDraw.value = p;

    // Labels: pinned to their point on the ground, in view only around their moment.
    for (const item of placed) {
      projected.copy(item.world);
      // Hunza stands taller on the overview, so its label clears Skardu's on a narrow screen.
      projected.y += item.stop.id === "hunza" ? 0.4 + lift * 3.5 : 0.4;
      projected.project(camera);
      const behind = projected.z > 1;
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height2;
      // Held while the camera passes, fading only as the point nears the edge of the frame, and gone
      // before the next stop arrives so two labels never sit on top of each other.
      const edge = behind ? 0 : sstep(-20, 70, x) * sstep(width + 20, width - 120, x) * sstep(-10, 80, y) * sstep(height2 + 40, height2 - 60, y);
      const appear = sstep(item.show - 0.05, item.show - 0.012, p);
      const until = item.until;
      const leaves = until >= 1 ? 1 : 1 - sstep(until - 0.04, until, p);
      const opacity = edge * appear * leaves;
      const element = item.stop.element;
      element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      element.style.opacity = opacity.toFixed(3);
      element.dataset.visible = opacity > 0.3 ? "true" : "false";
      // Near the right edge the label hangs to the left of its hairline instead of running off screen.
      element.dataset.flip = x > width * 0.62 ? "true" : "false";
    }

    renderer.render(scene, camera);
  }

  function loop(now: number) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    last = now;
    draw(Math.min(0.05, Math.max(0, raw)));
    if (raw < 0.25) {
      frames++;
      spent += raw;
    }
    if (frames >= 45) {
      if (spent / frames > 1 / 40) {
        if (++slow >= 2 && dpr > 1) {
          dpr = Math.max(1, dpr - 0.25);
          slow = 0;
          applySize();
        }
      } else slow = 0;
      frames = 0;
      spent = 0;
    }
  }

  function start() {
    if (running || !inView || document.hidden || disposed) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  let disposed = false;
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) start();
    else stop();
  });
  observer.observe(canvas);
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);
  const resizer = new ResizeObserver(() => {
    if (stageEl.clientWidth === width && stageEl.clientHeight === height2) return;
    applySize();
    if (!running) draw(0);
  });
  resizer.observe(stageEl);
  const onLost = (event: Event) => {
    event.preventDefault();
    stop();
    onFail();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  draw(0);

  if (import.meta.env.DEV) {
    (window as unknown as { __road: unknown }).__road = {
      scene,
      renderer,
      camera,
      seek(p: number) {
        forced = p;
        draw(0);
        return { cam: camera.position.toArray(), look: look.toArray(), q: q.toArray(), ahead: ahead.toArray(), stops: placed.map((x) => [x.stop.id, x.show, x.world.toArray()]) };
      },
    };
  }

  return function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    observer.disconnect();
    resizer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onLost);
    for (const item of disposables) item.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
