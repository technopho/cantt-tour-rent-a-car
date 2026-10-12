/**
 * Night-drive hero scene (three.js, WebGL2). Home page only.
 *
 * Streams of light trails flow along gently curving roads and an overpass into the fog, over a
 * faint ground grid: red tail-lights move away on the left, white headlights come toward the camera
 * on the right (Pakistan drives on the left). The camera drifts slowly, follows the pointer softly on
 * desktop and moves forward with scroll progress through the hero.
 *
 * Loaded lazily by src/components/home/HomeHero.astro, only when canRun3D() passes, after idle and
 * while the hero is visible. Never import it statically: it is the page's only three.js chunk.
 *
 *   const { mountHeroScene } = await import("@/scripts/hero3d");
 *   const dispose = mountHeroScene({ container, scrollTarget: heroSection, onReady, onFail });
 *
 * - DPR capped at 1.5 (desktop) / 1.25 (touch or narrow); drops to 1, then freezes on a still frame
 *   if the GPU cannot keep up.
 * - The render loop runs only while the container is on screen and the tab is visible.
 * - The vanishing point follows the CSS custom properties --focus-x / --focus-y on the container
 *   (fractions of its width / height), so the same scene fits a full-bleed or a framed layout.
 * - dispose() releases every GPU resource and removes the canvas.
 *
 * captureStill() renders one deterministic frame to an image blob (how public/media/hero-poster.webp
 * was made, so the poster always matches the live scene).
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";

/* ------------------------------------------------------------------------------------------ */
/* Scene description                                                                            */
/* ------------------------------------------------------------------------------------------ */

type Vec3 = [number, number, number];
type Rgb = [number, number, number];

interface LaneSpec {
  /** Lateral offset of the lane centre from the road centre line. */
  x: number;
  /** +1 travels away from the road start, -1 travels toward it. */
  dir: 1 | -1;
  kind: "tail" | "head";
  cars: number;
  /** Units per second, [min, max]. */
  speed: [number, number];
}

interface RoadSpec {
  origin: Vec3;
  /** Rotation around Y. 0 = straight ahead into -z. */
  yaw: number;
  length: number;
  /** x / y offset reached at the far end (quadratic ease, so the near end stays straight). */
  bend: [number, number];
  /** ampX, freqX, ampY, freqY (sine waves along the distance; zero offset at the start). */
  wave: [number, number, number, number];
  /** Bridge arch: y += arch * sin(pi * d / length). */
  arch: number;
  lanes: LaneSpec[];
  /** Faint continuous edge lines: [x offset, height]. */
  edges: [number, number][];
  /** Street lamps along the road. */
  lamps: { x: number[]; spacing: number; height: number; start: number } | null;
}

const ROADS: RoadSpec[] = [
  // Main road, three lanes each way. Tail-lights stream away on the left, headlights come toward
  // the camera on the right (Pakistan drives on the left). The camera watches from an overpass.
  {
    origin: [0, 0, 16],
    yaw: 0,
    length: 440,
    bend: [46, 9],
    wave: [13, 0.016, 1.6, 0.02],
    arch: 0,
    lanes: [
      { x: -8.4, dir: 1, kind: "tail", cars: 30, speed: [8, 13] },
      { x: -5.2, dir: 1, kind: "tail", cars: 34, speed: [11, 16] },
      { x: -2.0, dir: 1, kind: "tail", cars: 32, speed: [14, 20] },
      { x: 2.0, dir: -1, kind: "head", cars: 30, speed: [22, 30] },
      { x: 5.2, dir: -1, kind: "head", cars: 32, speed: [18, 26] },
      { x: 8.4, dir: -1, kind: "head", cars: 28, speed: [14, 21] },
    ],
    edges: [
      [-10.4, 0.05],
      [0, 0.05],
      [10.4, 0.05],
    ],
    lamps: { x: [-11.6, 11.6], spacing: 16, height: 7.5, start: 10 },
  },
  // Overpass crossing from left to right ahead of the camera, angled away, with a gentle arch.
  {
    origin: [-104, 17, -22],
    yaw: -Math.PI / 2 + 0.62,
    length: 280,
    bend: [-30, -3],
    wave: [0, 0, 0, 0],
    arch: 4.5,
    lanes: [
      { x: -3.4, dir: 1, kind: "tail", cars: 18, speed: [9, 14] },
      { x: -1.2, dir: 1, kind: "tail", cars: 16, speed: [12, 17] },
      { x: 1.2, dir: -1, kind: "head", cars: 16, speed: [13, 19] },
      { x: 3.4, dir: -1, kind: "head", cars: 18, speed: [10, 16] },
    ],
    edges: [
      [-5.2, 0.95],
      [5.2, 0.95],
      [-5.2, -0.45],
      [5.2, -0.45],
    ],
    lamps: { x: [-5.6, 5.6], spacing: 14, height: 3.2, start: 10 },
  },
  // Slip road peeling off to the right and curving into the distance.
  {
    origin: [14, 0, -24],
    yaw: -0.52,
    length: 300,
    bend: [70, 6],
    wave: [4, 0.014, 0, 0],
    arch: 0,
    lanes: [
      { x: -1.6, dir: 1, kind: "tail", cars: 12, speed: [9, 14] },
      { x: 1.6, dir: -1, kind: "head", cars: 12, speed: [16, 24] },
    ],
    edges: [
      [-3.4, 0.05],
      [3.4, 0.05],
    ],
    lamps: null,
  },
  // Far road on the left, mostly in the fog: depth and balance.
  {
    origin: [-40, 0, -50],
    yaw: 0.46,
    length: 320,
    bend: [-40, 4],
    wave: [5, 0.01, 0, 0],
    arch: 0,
    lanes: [
      { x: -1.5, dir: 1, kind: "tail", cars: 10, speed: [9, 13] },
      { x: 1.5, dir: -1, kind: "head", cars: 10, speed: [15, 22] },
    ],
    edges: [],
    lamps: null,
  },
];

/** Colours are display (sRGB) values: the shaders write them straight to the canvas. */
const BG: Rgb = [11 / 255, 13 / 255, 18 / 255]; // --bg (dark)
const HAZE: Rgb = [232 / 255, 85 / 255, 61 / 255]; // --accent, tail-light glow at the horizon
const WARM: Rgb = [1, 0.86, 0.72];
const TAIL_COLORS: Rgb[] = [
  [1, 0.16, 0.08],
  [1, 0.22, 0.1],
  [0.95, 0.12, 0.07],
];
const HEAD_COLORS: Rgb[] = [
  [1, 0.95, 0.86],
  [0.9, 0.93, 1],
  [1, 0.9, 0.76],
];
const LAMP_COLOR: Rgb = [1, 0.8, 0.58];

const FOG: [number, number] = [50, 360];
const MAIN_ROAD = ROADS[0];

/* ------------------------------------------------------------------------------------------ */
/* Shaders                                                                                      */
/* ------------------------------------------------------------------------------------------ */

const ROAD_GLSL = /* glsl */ `
uniform vec3 uOrigin;
uniform float uYaw;
uniform float uLength;
uniform vec2 uBend;
uniform vec4 uWave;
uniform float uArch;

vec3 toWorld(vec3 v) {
  float c = cos(uYaw);
  float s = sin(uYaw);
  return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

vec3 roadPoint(float d, float lx, float ly) {
  float p = d / uLength;
  float x = lx + uBend.x * p * p + uWave.x * sin(d * uWave.y);
  float y = ly + uBend.y * p * p + uWave.z * sin(d * uWave.w) + uArch * sin(3.14159265 * clamp(p, 0.0, 1.0));
  return uOrigin + toWorld(vec3(x, y, -d));
}
`;

const TRAIL_VERT = /* glsl */ `
${ROAD_GLSL}
attribute vec4 aLane;   // lane x, height, start offset along the road, direction
attribute vec3 aShape;  // radius, length, speed
attribute vec3 aColor;
uniform float uTravel;
uniform float uRadius;
uniform vec2 uFog;
varying float vT;
varying vec3 vColor;
varying float vFade;
varying float vFacing;

void main() {
  float t = position.y + 0.5;              // 0 = tail, 1 = head
  float dir = aLane.w;
  float head = mod(aLane.z + dir * uTravel * aShape.z, uLength);
  float d = head - dir * (1.0 - t) * aShape.y;
  vec3 ring = toWorld(vec3(position.x, position.z, 0.0));
  vec3 world = roadPoint(d, aLane.x, aLane.y) + ring * aShape.x * uRadius;
  vec4 mv = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;

  vFacing = abs(dot(normalize(ring), normalize(cameraPosition - world)));
  vT = t;
  vColor = aColor;
  float depth = -mv.z;
  vFade = smoothstep(0.0, 9.0, d) * (1.0 - smoothstep(uLength * 0.8, uLength, d)) * (1.0 - smoothstep(uFog.x, uFog.y, depth));
}
`;

const TRAIL_FRAG = /* glsl */ `
uniform float uIntensity;
uniform float uHalo;  // 0 = bright core, 1 = soft halo
uniform float uFlat;  // 1 = even brightness (edge lines)
varying float vT;
varying vec3 vColor;
varying float vFade;
varying float vFacing;

void main() {
  float grad = mix(pow(vT, 1.7), 1.0, uFlat);
  float shape = mix(mix(0.45, 1.0, vFacing), pow(vFacing, 3.0), uHalo);
  float spark = pow(vT, 28.0) * (1.0 - uHalo) * (1.0 - uFlat);
  vec3 color = vColor * grad + vec3(1.0, 0.97, 0.93) * spark * 0.85;
  gl_FragColor = vec4(color * vFade * shape * uIntensity, 1.0);
}
`;

const LAMP_VERT = /* glsl */ `
attribute float aSize;
uniform float uScale;
uniform vec2 uFog;
varying float vFade;

void main() {
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 1.0);
  gl_PointSize = aSize * uScale / depth;
  vFade = 1.0 - smoothstep(uFog.x, uFog.y, depth);
}
`;

const LAMP_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vFade;

void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float glow = pow(max(1.0 - r, 0.0), 2.4);
  float core = smoothstep(0.22, 0.0, r);
  gl_FragColor = vec4((uColor * glow * 0.55 + vec3(1.0) * core * 0.45) * vFade, 1.0);
}
`;

const GRID_VERT = /* glsl */ `
varying vec3 vWorld;
varying float vDepth;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * world;
  vWorld = world.xyz;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const GRID_FRAG = /* glsl */ `
uniform float uFlow;
uniform vec2 uFog;
uniform vec3 uColor;
varying vec3 vWorld;
varying float vDepth;

void main() {
  vec2 p = vWorld.xz / 8.0;
  p.y += uFlow;
  vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  float fade = (1.0 - smoothstep(uFog.x * 0.3, uFog.y * 0.55, vDepth)) * smoothstep(8.0, 34.0, vDepth);
  gl_FragColor = vec4(uColor * line * fade * 0.06, 1.0);
}
`;

const SKY_VERT = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec2 uHorizon;
uniform float uAspect;
uniform vec3 uBg;
uniform vec3 uHaze;
uniform vec3 uWarm;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 p = vUv - uHorizon;
  p.x *= uAspect;
  float band = exp(-pow(p.y * 9.0, 2.0)) * exp(-pow(p.x * 0.8, 2.0));
  float glow = exp(-dot(p, p) * 22.0);
  float sky = smoothstep(0.02, 0.9, p.y);
  vec3 color = uBg * (1.0 - 0.4 * sky);
  color += uHaze * band * 0.12 + uWarm * glow * 0.07;
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}
`;

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/** Seeded PRNG so the live scene and the poster share the same traffic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** CPU twin of roadPoint() in ROAD_GLSL (lamps, camera target). */
function roadPoint(road: RoadSpec, d: number, lx: number, ly: number): Vec3 {
  const p = d / road.length;
  const x = lx + road.bend[0] * p * p + road.wave[0] * Math.sin(d * road.wave[1]);
  const y = ly + road.bend[1] * p * p + road.wave[2] * Math.sin(d * road.wave[3]) + road.arch * Math.sin(Math.PI * clamp01(p));
  const z = -d;
  const c = Math.cos(road.yaw);
  const s = Math.sin(road.yaw);
  return [road.origin[0] + x * c + z * s, road.origin[1] + y, road.origin[2] - x * s + z * c];
}

function roadUniforms(road: RoadSpec) {
  return {
    uOrigin: { value: new Vector3(...road.origin) },
    uYaw: { value: road.yaw },
    uLength: { value: road.length },
    uBend: { value: road.bend },
    uWave: { value: road.wave },
    uArch: { value: road.arch },
  };
}

interface SceneOptions {
  antialias: boolean;
  preserveDrawingBuffer?: boolean;
  /** Traffic density multiplier (fewer cars on small screens). */
  density: number;
}

interface FrameInput {
  time: number;
  travel: number;
  /** Smoothed pointer, -1..1. */
  px: number;
  py: number;
  /** Scroll progress through the hero, 0..1. */
  progress: number;
}

interface SceneContext {
  renderer: WebGLRenderer;
  resize(width: number, height: number, pixelRatio: number, focusX: number, focusY: number): void;
  setPixelRatio(pixelRatio: number): void;
  render(frame: FrameInput): void;
  dispose(): void;
}

/* ------------------------------------------------------------------------------------------ */
/* Scene construction                                                                           */
/* ------------------------------------------------------------------------------------------ */

function createScene(canvas: HTMLCanvasElement, options: SceneOptions): SceneContext {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: options.antialias,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: "default",
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  });
  renderer.setClearColor(0x0b0d12, 1);
  renderer.autoClear = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(46, 16 / 9, 0.1, 700);
  const disposables: { dispose(): void }[] = [];
  const rand = mulberry32(20261011);

  // Shared uniforms (same objects in every material, so one write updates all of them).
  const uTravel = { value: 0 };
  const uFog = { value: FOG };
  const uLampScale = { value: 300 };

  // Sky + horizon haze, drawn first as a full-screen triangle pair.
  const skyUniforms = {
    uHorizon: { value: [0.5, 0.5] as [number, number] },
    uAspect: { value: 16 / 9 },
    uBg: { value: BG },
    uHaze: { value: HAZE },
    uWarm: { value: WARM },
  };
  const skyGeometry = new PlaneGeometry(2, 2);
  const skyMaterial = new ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: skyUniforms,
    depthTest: false,
    depthWrite: false,
  });
  const sky = new Mesh(skyGeometry, skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);
  disposables.push(skyGeometry, skyMaterial);

  // Ground grid, flowing toward the camera.
  const gridUniforms = { uFlow: { value: 0 }, uFog, uColor: { value: [0.82, 0.86, 0.95] as Rgb } };
  const gridGeometry = new PlaneGeometry(900, 900, 1, 1);
  gridGeometry.rotateX(-Math.PI / 2);
  const gridMaterial = new ShaderMaterial({
    vertexShader: GRID_VERT,
    fragmentShader: GRID_FRAG,
    uniforms: gridUniforms,
    blending: AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const grid = new Mesh(gridGeometry, gridMaterial);
  grid.position.set(0, -0.02, -230);
  grid.renderOrder = -5;
  scene.add(grid);
  disposables.push(gridGeometry, gridMaterial);

  // One open cylinder shared by every trail instance (y in [-0.5, 0.5] = along the streak).
  const tube = new CylinderGeometry(1, 1, 1, 6, 18, true);
  disposables.push(tube);

  const lampPositions: number[] = [];
  const lampSizes: number[] = [];

  for (const road of ROADS) {
    const uniforms = roadUniforms(road);

    // Moving traffic: two lamps per car, same offset and speed.
    const lane: number[] = [];
    const shape: number[] = [];
    const color: number[] = [];
    for (const spec of road.lanes) {
      const cars = Math.max(2, Math.round(spec.cars * options.density));
      const palette = spec.kind === "tail" ? TAIL_COLORS : HEAD_COLORS;
      for (let i = 0; i < cars; i++) {
        const offset = ((i + rand() * 0.75) / cars) * road.length;
        const speed = lerp(spec.speed[0], spec.speed[1], rand());
        const length = lerp(16, 32, rand()) * (0.6 + speed / 45);
        const radius = spec.kind === "tail" ? 0.07 : 0.08;
        const height = spec.kind === "tail" ? 0.75 : 0.8;
        const tint = palette[Math.floor(rand() * palette.length)];
        const gain = lerp(0.75, 1.1, rand());
        for (const side of [-0.6, 0.6]) {
          lane.push(spec.x + side, height, offset, spec.dir);
          shape.push(radius, length, speed);
          color.push(tint[0] * gain, tint[1] * gain, tint[2] * gain);
        }
      }
    }

    const trailGeometry = new InstancedBufferGeometry();
    trailGeometry.index = tube.index;
    trailGeometry.setAttribute("position", tube.getAttribute("position"));
    trailGeometry.setAttribute("aLane", new InstancedBufferAttribute(new Float32Array(lane), 4));
    trailGeometry.setAttribute("aShape", new InstancedBufferAttribute(new Float32Array(shape), 3));
    trailGeometry.setAttribute("aColor", new InstancedBufferAttribute(new Float32Array(color), 3));
    trailGeometry.instanceCount = lane.length / 4;
    disposables.push(trailGeometry);

    const makeTrailMaterial = (radius: number, intensity: number, halo: number, flat: number) => {
      const material = new ShaderMaterial({
        vertexShader: TRAIL_VERT,
        fragmentShader: TRAIL_FRAG,
        uniforms: {
          ...uniforms,
          uTravel,
          uFog,
          uRadius: { value: radius },
          uIntensity: { value: intensity },
          uHalo: { value: halo },
          uFlat: { value: flat },
        },
        blending: AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      disposables.push(material);
      return material;
    };

    const halo = new Mesh(trailGeometry, makeTrailMaterial(7, 0.2, 1, 0));
    const core = new Mesh(trailGeometry, makeTrailMaterial(1, 1.3, 0, 0));
    halo.frustumCulled = false;
    core.frustumCulled = false;
    scene.add(halo, core);

    // Static edge lines (rails, lane edges): speed 0, one streak spanning the whole road.
    if (road.edges.length) {
      const eLane: number[] = [];
      const eShape: number[] = [];
      const eColor: number[] = [];
      for (const [x, y] of road.edges) {
        eLane.push(x, y, road.length - 0.01, 1);
        eShape.push(0.03, road.length, 0);
        eColor.push(0.62, 0.68, 0.8);
      }
      const edgeGeometry = new InstancedBufferGeometry();
      edgeGeometry.index = tube.index;
      edgeGeometry.setAttribute("position", tube.getAttribute("position"));
      edgeGeometry.setAttribute("aLane", new InstancedBufferAttribute(new Float32Array(eLane), 4));
      edgeGeometry.setAttribute("aShape", new InstancedBufferAttribute(new Float32Array(eShape), 3));
      edgeGeometry.setAttribute("aColor", new InstancedBufferAttribute(new Float32Array(eColor), 3));
      edgeGeometry.instanceCount = road.edges.length;
      disposables.push(edgeGeometry);
      const edges = new Mesh(edgeGeometry, makeTrailMaterial(1, 0.16, 0, 1));
      edges.frustumCulled = false;
      scene.add(edges);
    }

    if (road.lamps) {
      for (let d = road.lamps.start; d < road.length * 0.92; d += road.lamps.spacing) {
        for (const x of road.lamps.x) {
          lampPositions.push(...roadPoint(road, d, x, road.lamps.height));
          lampSizes.push(lerp(3.2, 4.2, rand()));
        }
      }
    }
  }

  // Street lamps: soft warm points along the main road and the overpass.
  const lampGeometry = new BufferGeometry();
  lampGeometry.setAttribute("position", new Float32BufferAttribute(lampPositions, 3));
  lampGeometry.setAttribute("aSize", new Float32BufferAttribute(lampSizes, 1));
  const lampMaterial = new ShaderMaterial({
    vertexShader: LAMP_VERT,
    fragmentShader: LAMP_FRAG,
    uniforms: { uScale: uLampScale, uFog, uColor: { value: LAMP_COLOR } },
    blending: AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const lamps = new Points(lampGeometry, lampMaterial);
  lamps.frustumCulled = false;
  scene.add(lamps);
  disposables.push(lampGeometry, lampMaterial);

  // Camera rig.
  const lookBase = roadPoint(MAIN_ROAD, 170, 0, 2);
  const horizonPoint = new Vector3();
  const viewSize = { w: 16, h: 9 };
  const baseFov = { value: 46 };

  function applyView(w: number, h: number, focusX: number, focusY: number) {
    viewSize.w = w;
    viewSize.h = h;
    const aspect = w / h;
    // Portrait screens get a wider field of view so the roads still read.
    baseFov.value = aspect < 0.8 ? 64 : aspect < 1.2 ? 56 : 46;
    const fx = Math.min(0.85, Math.max(0.15, focusX));
    const fy = Math.min(0.85, Math.max(0.15, focusY));
    // Shift the projection centre (vanishing point) with a view offset into a larger virtual frame.
    const fullW = fx >= 0.5 ? 2 * fx * w : 2 * (1 - fx) * w;
    const fullH = fy >= 0.5 ? 2 * fy * h : 2 * (1 - fy) * h;
    const offX = fx >= 0.5 ? 0 : fullW - w;
    const offY = fy >= 0.5 ? 0 : fullH - h;
    const tanHalf = Math.tan((baseFov.value * Math.PI) / 360);
    camera.fov = (Math.atan(tanHalf * (fullH / h)) * 360) / Math.PI;
    camera.aspect = fullW / fullH;
    camera.setViewOffset(fullW, fullH, offX, offY, w, h);
    camera.updateProjectionMatrix();
    skyUniforms.uAspect.value = aspect;
  }

  return {
    renderer,
    resize(width, height, pixelRatio, focusX, focusY) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      applyView(width, height, focusX, focusY);
      // Lamp sprites scale with the canvas height in device pixels.
      uLampScale.value = height * pixelRatio * 0.34;
    },
    setPixelRatio(pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(viewSize.w, viewSize.h, false);
      uLampScale.value = viewSize.h * pixelRatio * 0.34;
    },
    render({ time, travel, px, py, progress }) {
      const forward = progress * 26;
      camera.position.set(
        -0.6 + Math.sin(time * 0.09) * 0.6 + px * 1.4,
        7 + Math.sin(time * 0.13) * 0.18 - py * 0.6 - progress * 1.6,
        11 - forward,
      );
      camera.lookAt(lookBase[0] + px * 4, lookBase[1] - py * 1.4, lookBase[2] - forward);
      camera.updateMatrixWorld();

      uTravel.value = travel;
      gridUniforms.uFlow.value = travel * 1.6;

      // Horizon haze follows the far end of the main road.
      const far = roadPoint(MAIN_ROAD, MAIN_ROAD.length * 0.7, 0, 0);
      horizonPoint.set(far[0], far[1], far[2] - forward).project(camera);
      skyUniforms.uHorizon.value = [horizonPoint.x * 0.5 + 0.5, horizonPoint.y * 0.5 + 0.5];

      renderer.render(scene, camera);
    },
    dispose() {
      for (const item of disposables) item.dispose();
      disposables.length = 0;
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Live mount                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export interface HeroSceneOptions {
  /** Positioned element the canvas fills. Reads --focus-x / --focus-y from it. */
  container: HTMLElement;
  /** Element whose height defines scroll progress (the hero section). Defaults to the container. */
  scrollTarget?: HTMLElement;
  /** Called once the first frame is on screen (fade the canvas in). */
  onReady?: () => void;
  /** Called if WebGL fails or the context is lost (keep the poster). */
  onFail?: () => void;
}

function readFocus(el: HTMLElement): { fx: number; fy: number } {
  const style = getComputedStyle(el);
  const fx = Number.parseFloat(style.getPropertyValue("--focus-x"));
  const fy = Number.parseFloat(style.getPropertyValue("--focus-y"));
  return { fx: Number.isFinite(fx) ? fx : 0.5, fy: Number.isFinite(fy) ? fy : 0.45 };
}

/** Mount the live scene into `container`. Returns dispose(). */
export function mountHeroScene({ container, scrollTarget = container, onReady, onFail }: HeroSceneOptions): () => void {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.heroWebgl = "";

  const mqTouch = window.matchMedia("(pointer: coarse)");
  const mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const small = () => mqTouch.matches || container.clientWidth < 768;
  const maxDpr = () => Math.min(window.devicePixelRatio || 1, small() ? 1.25 : 1.5);

  let ctx: SceneContext;
  try {
    ctx = createScene(canvas, { antialias: !small(), density: small() ? 0.7 : 1 });
  } catch {
    onFail?.();
    return () => {};
  }
  container.appendChild(canvas);

  let disposed = false;
  let raf = 0;
  let running = false;
  let inView = true;
  let frozen = false;
  let readySent = false;
  let last = 0;
  let time = 18;
  let travel = 18;
  let boost = 0;
  let lastScrollY = window.scrollY;
  let targetHeight = scrollTarget.offsetHeight || window.innerHeight;
  let dpr = maxDpr();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  // Frame-time watchdog: lower the resolution, then freeze on a still frame if still too slow.
  let sampleFrames = 0;
  let sampleTime = 0;
  let downgrades = 0;

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const { fx, fy } = readFocus(container);
    targetHeight = scrollTarget.offsetHeight || window.innerHeight;
    ctx.resize(w, h, dpr, fx, fy);
    if (!running) draw(0);
  }

  function draw(dt: number) {
    const scrollY = window.scrollY;
    const progress = clamp01(scrollY / Math.max(1, targetHeight));
    if (dt > 0) {
      const velocity = Math.abs(scrollY - lastScrollY) / dt;
      boost += (Math.min(velocity / 1600, 1.4) - boost) * Math.min(1, dt * 2.5);
      time += dt;
      travel += dt * (1 + progress * 0.9 + boost);
      const k = Math.min(1, dt * 2.2);
      pointer.x += (pointer.tx - pointer.x) * k;
      pointer.y += (pointer.ty - pointer.y) * k;
    }
    lastScrollY = scrollY;
    ctx.render({ time, travel, px: pointer.x, py: pointer.y, progress });
    if (!readySent) {
      readySent = true;
      requestAnimationFrame(() => {
        if (!disposed) onReady?.();
      });
    }
  }

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    draw(dt);

    sampleFrames++;
    if (sampleFrames > 12) sampleTime += dt;
    if (sampleFrames === 102) {
      const avg = sampleTime / 90;
      sampleFrames = 0;
      sampleTime = 0;
      if (avg > 1 / 38) {
        downgrades++;
        if (dpr > 1 && downgrades === 1) {
          dpr = 1;
          ctx.setPixelRatio(dpr);
        } else {
          frozen = true; // keep the last frame on screen, stop spending GPU time
          stop();
          return;
        }
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || frozen || disposed || !inView || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
      else stop();
    },
    { threshold: 0 },
  );
  io.observe(container);

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);

  const onPointer = (event: PointerEvent) => {
    pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (event.clientY / window.innerHeight) * 2 - 1;
  };
  if (mqFine.matches) window.addEventListener("pointermove", onPointer, { passive: true });

  const onLost = (event: Event) => {
    event.preventDefault();
    stop();
    frozen = true;
    canvas.style.opacity = "0";
    onFail?.();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  resize();
  draw(0);
  start();

  return function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pointermove", onPointer);
    canvas.removeEventListener("webglcontextlost", onLost);
    ctx.dispose();
    canvas.remove();
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Still capture (poster)                                                                       */
/* ------------------------------------------------------------------------------------------ */

export interface StillOptions {
  width?: number;
  height?: number;
  /** Scene time in seconds (traffic positions). */
  time?: number;
  focusX?: number;
  focusY?: number;
  type?: "image/webp" | "image/png" | "image/jpeg";
  quality?: number;
}

/** Render one deterministic frame and return it as an image blob. */
export function captureStill({
  width = 1600,
  height = 1000,
  time = 36,
  focusX = 0.5,
  focusY = 0.45,
  type = "image/webp",
  quality = 0.8,
}: StillOptions = {}): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  const ctx = createScene(canvas, { antialias: true, preserveDrawingBuffer: true, density: 1 });
  ctx.resize(width, height, 1, focusX, focusY);
  ctx.render({ time, travel: time, px: 0, py: 0, progress: 0 });
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        ctx.dispose();
        resolve(blob);
      },
      type,
      quality,
    );
  });
}
