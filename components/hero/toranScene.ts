import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  Quaternion,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

// The dusk scene behind Jashn's hero and plan headers. World units are CSS pixels at
// z = 0 and the origin is the band's centre, so the scene can be built around DOM
// boxes: in "doorway" mode a carved frame surrounds the [data-door] element exactly,
// the toran hangs from its lintel, and diyas and a petal rangoli sit on the floor in
// front of its threshold. In "header" mode only the wall, the toran and petals show.
// Everything here is decoration: the DOM underneath already has the same dusk colours.

export type DuskMode = "doorway" | "header";

/** A DOM box in band pixels, origin at the band's top-left. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DuskOptions {
  mode: DuskMode;
  /** Render one still frame and stop (prefers-reduced-motion). */
  still: boolean;
  /** The door opening, measured from the DOM on every resize (doorway mode). */
  measureDoor?: () => Box | null;
}

export interface DuskHandle {
  dispose(): void;
}

const FOV = 30;
const MAX_DPR = 2;
const FLOWER_R = 10.5;
const FLOWER_STEP = 17;
const STRAND_FLOWERS = 4;
const STRAND_STEP = 17;
const PARALLAX = { x: 22, y: 12 };
const FOLLOW_RATE = 3; // 1/s, frame-rate independent easing toward the pointer
const STILL_TIME = 2.4;
const PETALS = 28;
const EMBERS_PER_DIYA = 5;
const REVEAL_DEPTH = 220; // how deep the door opening goes into the wall
const FLOOR_DEPTH = 420;

const ORANGE = new Color("#e8590c");
const SAFFRON = new Color("#f08a12");
const YELLOW = new Color("#f6b81f");
const CREAM = new Color("#f7ead2");
const VERMILION = new Color("#c8321e");
const LEAF = new Color("#3d7a2e");
const CLAY = new Color("#a9512a");
const TEAK = new Color("#5b3220");
const BRASS = new Color("#c99a3e");
const STONE = new Color("#6e5242");

// ---------- geometry ----------

/** A crinkled ball of petals: an icosphere pushed in and out in petal bands. */
function marigoldGeometry(r: number): BufferGeometry {
  const g = new IcosahedronGeometry(r, 3);
  const p = g.attributes.position as BufferAttribute;
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const lon = Math.atan2(v.z, v.x);
    const lat = Math.acos(Math.max(-1, Math.min(1, v.y)));
    const ruffle = Math.abs(Math.sin(lon * 7 + lat * 3)) * Math.abs(Math.sin(lat * 9));
    v.multiplyScalar(r * (0.8 + 0.22 * ruffle + Math.sin(i * 12.9898) * 0.04));
    v.z *= 0.75;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function leafGeometry(): BufferGeometry {
  const s = new Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(8, -11, 0, -26);
  s.quadraticCurveTo(-8, -11, 0, 0);
  return new ShapeGeometry(s, 6);
}

function petalGeometry(): BufferGeometry {
  const s = new Shape();
  s.moveTo(0, -5);
  s.quadraticCurveTo(4.5, 0, 0, 5);
  s.quadraticCurveTo(-4.5, 0, 0, -5);
  return new ShapeGeometry(s, 4);
}

/** A shallow clay lamp turned on a lathe. */
function diyaGeometry(): BufferGeometry {
  const pts = [
    [0, -8],
    [12, -8],
    [21, -4.5],
    [26, 1],
    [28, 6],
    [26.5, 7.5],
    [23, 3.5],
    [15, 0.5],
    [0, -0.5],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(pts, 36);
}

// ---------- shaders ----------

const WORLD_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.1) + 0.15 * noise(p * 4.3); }
`;

// Lime-plaster wall at dusk: warm, slightly mottled, lit from the lamps on the floor.
// The door opening is cut out so the reveal and the room behind show through it.
const WALL_FRAG = /* glsl */ `
  uniform vec4 uHole;   // left, right, bottom, top in world px (no hole when left > right)
  uniform vec3 uLamp;   // centre of the lamplight in world px
  uniform float uLampR;
  varying vec3 vWorld;
  ${NOISE}
  void main() {
    vec2 p = vWorld.xy;
    if (uHole.x < uHole.y && p.x > uHole.x && p.x < uHole.y && p.y > uHole.z && p.y < uHole.w) discard;
    float plaster = fbm(p * 0.012) * 0.6 + fbm(p * 0.05) * 0.4;
    vec3 base = mix(vec3(0.15, 0.075, 0.05), vec3(0.2, 0.105, 0.07), plaster);
    float d = length((p - uLamp.xy) * vec2(0.8, 1.25)) / uLampR;
    float glow = exp(-d * d * 1.6);
    vec3 col = base + vec3(0.42, 0.19, 0.06) * glow;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// The room beyond the door: deep and calm where the text sits, warmer near the floor.
const ROOM_FRAG = /* glsl */ `
  uniform vec3 uLamp;
  uniform float uLampR;
  varying vec3 vWorld;
  ${NOISE}
  void main() {
    vec2 p = vWorld.xy;
    float d = length((p - uLamp.xy) * vec2(0.7, 1.3)) / uLampR;
    float glow = exp(-d * d * 1.2);
    vec3 col = vec3(0.065, 0.03, 0.022) + vec3(0.2, 0.085, 0.03) * glow;
    col *= 0.94 + 0.06 * fbm(p * 0.02);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Stone floor with filtered tile joints and the lamps' warm pool.
const FLOOR_FRAG = /* glsl */ `
  uniform vec3 uLamp;
  uniform float uLampR;
  varying vec3 vWorld;
  ${NOISE}
  void main() {
    vec2 p = vWorld.xz;
    vec2 tile = p / 84.0;
    vec2 g = abs(fract(tile - 0.5) - 0.5) / fwidth(tile);
    float joint = 1.0 - min(min(g.x, g.y), 1.0);
    vec3 base = mix(vec3(0.17, 0.1, 0.075), vec3(0.22, 0.14, 0.1), fbm(p * 0.03));
    base *= 1.0 - 0.35 * joint;
    float d = length(vec2(p.x - uLamp.x, (p.y - uLamp.z) * 1.6)) / uLampR;
    vec3 col = base + vec3(0.45, 0.2, 0.06) * exp(-d * d * 1.4);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const FLAME_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A teardrop whose sway and flicker share one phase, so the flame moves as one thing.
const FLAME_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  void main() {
    float t = uTime + uPhase;
    float flicker = 0.88 + 0.08 * sin(t * 13.0) + 0.05 * sin(t * 23.0 + 1.7);
    float y = vUv.y / flicker;
    float sway = (0.06 * sin(t * 3.1) + 0.03 * sin(t * 7.3)) * y * y;
    float x = (vUv.x - 0.5) * 2.0 - sway * 2.0;
    float w = 1.3 * sqrt(max(y, 0.0)) * pow(max(1.0 - y, 0.0), 1.1) + 0.001;
    float d = abs(x) / w;
    float body = smoothstep(1.0, 0.55, d) * smoothstep(0.0, 0.06, y) * step(y, 1.0);
    float core = smoothstep(0.75, 0.0, d) * smoothstep(0.55, 0.1, y);
    vec3 col = mix(vec3(0.96, 0.45, 0.08), vec3(1.0, 0.78, 0.25), smoothstep(0.9, 0.3, d));
    col = mix(col, vec3(1.0, 0.97, 0.86), core);
    gl_FragColor = vec4(col, body);
  }
`;

const GLOW_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float pulse = 0.92 + 0.08 * sin((uTime + uPhase) * 9.0);
    gl_FragColor = vec4(1.0, 0.6, 0.2, exp(-r * r * 5.0) * 0.45 * pulse);
  }
`;

// Embers: a fixed pool with analytic age, rising from each lamp with its flame's drift.
const EMBER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute vec3 aOrigin;
  attribute float aSeed;
  varying float vAge;
  void main() {
    float life = 2.6 + aSeed * 1.8;
    float age = fract(uTime / life + aSeed * 7.13);
    vAge = age;
    vec3 p = aOrigin;
    p.y += 22.0 + age * (60.0 + aSeed * 40.0);
    p.x += sin(uTime * 1.3 + aSeed * 20.0) * 6.0 * age + (aSeed - 0.5) * 14.0 * age;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (3.2 - 2.0 * age) * uPixelRatio;
  }
`;

const EMBER_FRAG = /* glsl */ `
  varying float vAge;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.2, r) * smoothstep(0.0, 0.12, vAge) * (1.0 - vAge);
    gl_FragColor = vec4(1.0, 0.7 - 0.3 * vAge, 0.25, a * 0.9);
  }
`;

// ---------- scene ----------

interface Strand {
  anchor: Vector3;
  phase: number;
  flowers: number[];
  leaf: number;
}

interface Faller {
  x: number;
  z: number;
  speed: number;
  phase: number;
  color: Color;
}

/** Deterministic 0..1 sequence, so every load lays the petals out the same way. */
const seq = (i: number) => (i * 0.6180339887 + 0.137) % 1;

export function mountDusk(canvas: HTMLCanvasElement, opts: DuskOptions): DuskHandle {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 1, 6000);
  scene.add(new HemisphereLight(0xffe2bd, 0x2a140c, 1.3));
  const key = new DirectionalLight(0xffd7a8, 1.6);
  key.position.set(-0.4, 0.7, 1);
  scene.add(key);

  // Shared geometry and materials, created once and reused across layouts.
  const flowerGeo = marigoldGeometry(FLOWER_R);
  const leafGeo = leafGeometry();
  const petalGeo = petalGeometry();
  const diyaGeo = diyaGeometry();
  const oilGeo = new LatheGeometry([new Vector2(0, 0), new Vector2(19, 0)], 24);
  const flameGeo = new PlaneGeometry(22, 40).translate(0, 20, 0);
  const glowGeo = new PlaneGeometry(150, 150);
  const boxGeo = new BoxGeometry(1, 1, 1);
  const studGeo = new SphereGeometry(1, 16, 10);
  const planeGeo = new PlaneGeometry(1, 1);

  const flowerMat = new MeshStandardMaterial({ roughness: 0.85, flatShading: true });
  const leafMat = new MeshStandardMaterial({ color: LEAF, roughness: 0.7, side: DoubleSide });
  const petalMat = new MeshStandardMaterial({ roughness: 0.8, side: DoubleSide });
  const diyaMat = new MeshStandardMaterial({ color: CLAY, roughness: 0.9 });
  const oilMat = new MeshStandardMaterial({ color: 0x5a3208, emissive: 0x7a3a06, roughness: 0.3 });
  const teakMat = new MeshStandardMaterial({ color: TEAK, roughness: 0.62 });
  const brassMat = new MeshStandardMaterial({ color: BRASS, roughness: 0.35, metalness: 0.85 });
  const stoneMat = new MeshStandardMaterial({ color: STONE, roughness: 0.85 });
  const lamp = { uLamp: { value: new Vector3() }, uLampR: { value: 400 } };
  const wallMat = new ShaderMaterial({
    uniforms: { ...lamp, uHole: { value: [1, 0, 0, 0] } },
    vertexShader: WORLD_VERT,
    fragmentShader: WALL_FRAG,
  });
  const roomMat = new ShaderMaterial({ uniforms: lamp, vertexShader: WORLD_VERT, fragmentShader: ROOM_FRAG });
  const floorMat = new ShaderMaterial({ uniforms: lamp, vertexShader: WORLD_VERT, fragmentShader: FLOOR_FRAG });
  const timed: ShaderMaterial[] = [];

  let layer = new Group();
  let flowers: InstancedMesh | null = null;
  let leaves: InstancedMesh | null = null;
  let petals: InstancedMesh | null = null;
  let strands: Strand[] = [];
  let fallers: Faller[] = [];
  let width = 1;
  let height = 1;
  const lights: PointLight[] = [];

  const dummy = new Object3D();
  const q = new Quaternion();
  const zAxis = new Vector3(0, 0, 1);
  const offset = new Vector3();

  function clearLayout() {
    scene.remove(layer);
    layer.traverse((o) => {
      if (o instanceof Points) o.geometry.dispose();
    });
    for (const m of timed) m.dispose();
    timed.length = 0;
    for (const l of lights) l.dispose();
    lights.length = 0;
    layer = new Group();
    strands = [];
    fallers = [];
    flowers = leaves = petals = null;
  }

  function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: MeshStandardMaterial) {
    const m = new Mesh(boxGeo, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    layer.add(m);
  }

  function plane(w: number, h: number, mat: ShaderMaterial) {
    const m = new Mesh(planeGeo, mat);
    m.scale.set(w, h, 1);
    layer.add(m);
    return m;
  }

  /** A scalloped garland from x0 to x1 at height `top`, with strands at the cusps. */
  function garland(x0: number, x1: number, top: number, z: number) {
    const span = x1 - x0;
    const count = Math.max(2, Math.round(span / Math.max(150, Math.min(240, span / 5))));
    const scallop = span / count;
    const sag = Math.min(44, scallop * 0.2);
    const swag: { p: Vector3; color: Color }[] = [];
    const swagLeaves: { p: Vector3; angle: number }[] = [];
    const cusps: Vector3[] = [];
    for (let s = 0; s < count; s++) {
      const sx = x0 + s * scallop;
      cusps.push(new Vector3(sx, top, z + 4));
      let carried = 0;
      let prev = new Vector3(sx, top, z);
      for (let k = 1; k <= 60; k++) {
        const f = k / 60;
        const cur = new Vector3(sx + f * scallop, top - sag * Math.sin(Math.PI * f), z);
        carried += cur.distanceTo(prev);
        prev = cur;
        if (carried >= FLOWER_STEP) {
          carried = 0;
          const i = swag.length;
          swag.push({ p: cur.clone(), color: i % 3 === 2 ? YELLOW : i % 2 ? SAFFRON : ORANGE });
          if (i % 3 === 1) swagLeaves.push({ p: cur.clone().setZ(z - 6), angle: i % 2 ? 0.5 : -0.5 });
        }
      }
    }
    cusps.push(new Vector3(x1, top, z + 4));

    flowers = new InstancedMesh(flowerGeo, flowerMat, swag.length + cusps.length * STRAND_FLOWERS);
    leaves = new InstancedMesh(leafGeo, leafMat, swagLeaves.length + cusps.length);
    swag.forEach(({ p, color }, i) => {
      dummy.position.copy(p);
      dummy.rotation.set(0, 0, i * 1.7);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      flowers!.setMatrixAt(i, dummy.matrix);
      flowers!.setColorAt(i, color);
    });
    swagLeaves.forEach(({ p, angle }, i) => {
      dummy.position.copy(p);
      dummy.rotation.set(0, 0, angle);
      dummy.scale.setScalar(0.85);
      dummy.updateMatrix();
      leaves!.setMatrixAt(i, dummy.matrix);
    });
    let fi = swag.length;
    cusps.forEach((anchor, s) => {
      const ids: number[] = [];
      for (let k = 0; k < STRAND_FLOWERS; k++) {
        flowers!.setColorAt(fi, k % 2 ? YELLOW : ORANGE);
        ids.push(fi++);
      }
      strands.push({ anchor, phase: s * 1.37, flowers: ids, leaf: swagLeaves.length + s });
    });
    flowers.instanceColor!.needsUpdate = true;
    layer.add(flowers, leaves);
  }

  /** Lamps with flame, glow and an ember pool. */
  function diyas(spots: Vector3[]) {
    const origins: number[] = [];
    const seeds: number[] = [];
    spots.forEach((at, i) => {
      const g = new Group();
      g.position.copy(at);
      const bowl = new Mesh(diyaGeo, diyaMat);
      bowl.scale.set(1, 1, 0.75);
      bowl.rotation.x = 0.2;
      const oil = new Mesh(oilGeo, oilMat);
      oil.position.y = 1.5;
      oil.scale.set(1, 1, 0.75);
      oil.rotation.x = 0.2;
      const uniforms = { uTime: { value: 0 }, uPhase: { value: i * 2.31 } };
      const flameMat = new ShaderMaterial({
        uniforms,
        vertexShader: FLAME_VERT,
        fragmentShader: FLAME_FRAG,
        transparent: true,
        depthWrite: false,
      });
      const glowMat = new ShaderMaterial({
        uniforms,
        vertexShader: FLAME_VERT,
        fragmentShader: GLOW_FRAG,
        transparent: true,
        depthWrite: false,
      });
      timed.push(flameMat, glowMat);
      const glow = new Mesh(glowGeo, glowMat);
      glow.position.set(0, 18, -6);
      const flame = new Mesh(flameGeo, flameMat);
      flame.position.set(0, 4, 6);
      g.add(glow, bowl, oil, flame);
      layer.add(g);
      for (let e = 0; e < EMBERS_PER_DIYA; e++) {
        origins.push(at.x, at.y, at.z + 6);
        seeds.push(seq(i * EMBERS_PER_DIYA + e));
      }
    });
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(origins.length), 3));
    geo.setAttribute("aOrigin", new BufferAttribute(new Float32Array(origins), 3));
    geo.setAttribute("aSeed", new BufferAttribute(new Float32Array(seeds), 1));
    const mat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      transparent: true,
      depthWrite: false,
    });
    timed.push(mat);
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    layer.add(pts);
  }

  /**
   * Where falling petal f drifts, across the band but never inside keepOut (the door
   * opening, where the headline sits): a bright petal behind a glyph broke text contrast.
   */
  function petalX(f: number, keepOut?: [number, number]) {
    const left = -width * 0.55;
    const right = width * 0.55;
    if (!keepOut) return left + seq(f) * (right - left);
    const a = Math.max(0, keepOut[0] - left);
    const b = Math.max(0, right - keepOut[1]);
    const u = seq(f) * (a + b);
    return u < a ? left + u : keepOut[1] + (u - a);
  }

  /** Concentric rings of petals on the floor, like a rangoli of marigold, rose and jasmine. */
  function rangoli(cx: number, y: number, cz: number, radius: number, count: number, keepOut?: [number, number]) {
    const rings = [
      { r: radius, color: ORANGE },
      { r: radius * 0.8, color: YELLOW },
      { r: radius * 0.6, color: VERMILION },
      { r: radius * 0.42, color: CREAM },
      { r: radius * 0.24, color: SAFFRON },
    ];
    const per = rings.map((g) => Math.max(10, Math.round((2 * Math.PI * g.r) / 9)));
    const total = per.reduce((a, b) => a + b, 0) + count;
    const mesh = new InstancedMesh(petalGeo, petalMat, total);
    let i = 0;
    rings.forEach((ring, k) => {
      for (let j = 0; j < per[k]!; j++) {
        const a = (j / per[k]!) * Math.PI * 2;
        dummy.position.set(cx + Math.cos(a) * ring.r, y + 0.5, cz + Math.sin(a) * ring.r * 0.9);
        dummy.rotation.set(-Math.PI / 2, 0, -a);
        dummy.scale.set(1.15, 1.6, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i++, ring.color);
      }
    });
    // Falling petals share this mesh; their matrices are set every frame.
    for (let f = 0; f < count; f++) {
      fallers.push({
        x: petalX(f, keepOut),
        z: 20 + seq(f + 40) * 120,
        speed: 22 + seq(f + 80) * 26,
        phase: seq(f + 120) * 50,
        color: [ORANGE, YELLOW, SAFFRON, VERMILION][f % 4]!,
      });
      mesh.setColorAt(i + f, fallers[f]!.color);
    }
    mesh.instanceColor!.needsUpdate = true;
    petals = mesh;
    layer.add(mesh);
    return i;
  }

  let firstFaller = 0;

  function layoutDoorway(door: Box) {
    const s = Math.max(0.5, Math.min(1, width / 1200));
    const L = door.left - width / 2;
    const R = L + door.width;
    const T = height / 2 - door.top;
    const B = T - door.height;
    const cx = (L + R) / 2;

    // Wall with the opening cut out, the reveal, and the room beyond.
    const wall = plane(width * 1.6, height * 1.6, wallMat);
    wall.position.set(0, 0, -2);
    wallMat.uniforms.uHole!.value = [L, R, B, T];
    const room = plane(door.width + 40, door.height + 40, roomMat);
    room.position.set(cx, (T + B) / 2, -REVEAL_DEPTH);
    for (const side of [L, R]) {
      box(2, door.height, REVEAL_DEPTH, side + (side === L ? -1 : 1), (T + B) / 2, -REVEAL_DEPTH / 2, stoneMat);
    }
    box(door.width, 2, REVEAL_DEPTH, cx, T + 1, -REVEAL_DEPTH / 2, stoneMat);

    // Carved frame: three stepped teak rings, the inner bead standing out most.
    const rings = [
      { o: 0, w: 12 * s, d: 34 },
      { o: 12 * s, w: 30 * s, d: 22 },
      { o: 42 * s, w: 34 * s, d: 12 },
    ];
    for (const r of rings) {
      const x0 = L - r.o - r.w;
      const x1 = R + r.o + r.w;
      const top = T + r.o + r.w;
      const h = top - B;
      box(r.w, h, r.d, L - r.o - r.w / 2, B + h / 2, r.d / 2, teakMat);
      box(r.w, h, r.d, R + r.o + r.w / 2, B + h / 2, r.d / 2, teakMat);
      box(x1 - x0, r.w, r.d, cx, T + r.o + r.w / 2, r.d / 2, teakMat);
    }
    // A cornice above the lintel.
    const outer = 76 * s;
    box(door.width + outer * 2 + 28 * s, 14 * s, 40, cx, T + outer + 7 * s, 20, teakMat);

    // Brass studs down the middle ring.
    const studs: Vector3[] = [];
    const mid = 12 * s + 15 * s;
    for (let y = B + 30; y < T + mid; y += 52 * s) studs.push(new Vector3(L - mid, y, 23), new Vector3(R + mid, y, 23));
    for (let x = L - mid + 52 * s; x < R + mid - 20; x += 52 * s) studs.push(new Vector3(x, T + mid, 23));
    const studMesh = new InstancedMesh(studGeo, brassMat, studs.length);
    studs.forEach((p, i) => {
      dummy.position.copy(p);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(4.5 * s + 1, 4.5 * s + 1, 3);
      dummy.updateMatrix();
      studMesh.setMatrixAt(i, dummy.matrix);
    });
    layer.add(studMesh);

    // Threshold step and the floor in front of it.
    box(door.width + outer * 2 + 20, 12, 46, cx, B - 6, 23, stoneMat);
    const floor = plane(width * 2, FLOOR_DEPTH, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, B - 12, FLOOR_DEPTH / 2);

    // Lamplight centred on the threshold.
    lamp.uLamp.value.set(cx, B, 150);
    lamp.uLampR.value = Math.max(320, door.width * 0.55);
    for (const x of [cx - door.width * 0.3, cx + door.width * 0.3]) {
      const l = new PointLight(0xffa64d, 2.2, 0, 0);
      l.position.set(x, B + 40, 160);
      lights.push(l);
      layer.add(l);
    }

    // The toran hangs just under the lintel, inside the opening.
    garland(L - 6, R + 6, T - 6, 40);

    // Rangoli and lamps on the floor in front of the door.
    const floorY = B - 12;
    const rr = Math.min(120, door.width * 0.12);
    // The petals' sway (24 px) and depth (up to z 140) shift them on screen; 48 px covers both.
    firstFaller = rangoli(cx, floorY, 150, rr, PETALS, [L - 48, R + 48]);
    const n = width < 700 ? 3 : 5;
    const spots: Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.15 + (0.7 * i) / (n - 1));
      spots.push(new Vector3(cx - Math.cos(a) * (rr + 46 * s + 20), floorY + 8, 150 + Math.sin(a) * (rr * 0.9 + 30)));
    }
    if (width >= 700)
      spots.push(new Vector3(L - outer - 50, floorY + 8, 70), new Vector3(R + outer + 50, floorY + 8, 70));
    diyas(spots);
  }

  function layoutHeader() {
    const wall = plane(width * 1.6, height * 1.6, wallMat);
    wall.position.set(0, 0, -2);
    wallMat.uniforms.uHole!.value = [1, 0, 0, 0];
    lamp.uLamp.value.set(width * 0.3, -height / 2, 0);
    lamp.uLampR.value = Math.max(260, height * 1.2);
    garland(-width / 2 - 20, width / 2 + 20, height / 2 - 4, 30);
    const dummyFloor = height / 2 + 200; // petals only, no rangoli
    firstFaller = rangoli(0, dummyFloor, -9999, 0, Math.round(PETALS * 0.6));
  }

  function layout() {
    clearLayout();
    const door = opts.mode === "doorway" ? opts.measureDoor?.() : null;
    if (door) layoutDoorway(door);
    else layoutHeader();
    scene.add(layer);
  }

  function animate(t: number) {
    if (flowers && leaves) {
      for (const s of strands) {
        const angle = 0.07 * Math.sin(t * 1.25 + s.phase) + 0.025 * Math.sin(t * 2.9 + s.phase * 2.0);
        q.setFromAxisAngle(zAxis, angle);
        s.flowers.forEach((id, k) => {
          offset.set(0, -(k + 1) * STRAND_STEP, 4).applyQuaternion(q);
          dummy.position.copy(s.anchor).add(offset);
          dummy.rotation.set(0, 0, t * 0.2 + id);
          dummy.scale.setScalar(0.88 - k * 0.04);
          dummy.updateMatrix();
          flowers!.setMatrixAt(id, dummy.matrix);
        });
        offset.set(0, -(STRAND_FLOWERS + 0.6) * STRAND_STEP, 2).applyQuaternion(q);
        dummy.position.copy(s.anchor).add(offset);
        dummy.quaternion.copy(q);
        dummy.scale.setScalar(0.8);
        dummy.updateMatrix();
        leaves.setMatrixAt(s.leaf, dummy.matrix);
      }
      flowers.instanceMatrix.needsUpdate = true;
      leaves.instanceMatrix.needsUpdate = true;
    }
    if (petals) {
      // Petals fall through the band and wrap; analytic, so a still frame is just one value of t.
      const span = height + 60;
      fallers.forEach((f, i) => {
        const y = height / 2 + 30 - ((t * f.speed + f.phase * 20) % span);
        dummy.position.set(f.x + Math.sin(t * 0.8 + f.phase) * 24, y, f.z);
        dummy.rotation.set(t * 1.1 + f.phase, t * 0.7 + f.phase * 2, f.phase);
        dummy.scale.set(1.1, 1.5, 1);
        dummy.updateMatrix();
        petals!.setMatrixAt(firstFaller + i, dummy.matrix);
      });
      petals.instanceMatrix.needsUpdate = true;
    }
    for (const m of timed) m.uniforms.uTime!.value = t;
  }

  const pointer = new Vector2();
  const look = new Vector2();
  function aim() {
    const d = height / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.position.set(look.x * PARALLAX.x, look.y * PARALLAX.y, d);
    camera.lookAt(0, 0, 0);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    layout();
    aim();
    if (opts.still) {
      animate(STILL_TIME);
      renderer.render(scene, camera);
    }
  }

  const clock = new Clock();
  let raf = 0;
  let visible = true;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    look.lerp(pointer, 1 - Math.exp(-dt * FOLLOW_RATE));
    aim();
    animate(clock.elapsedTime);
    renderer.render(scene, camera);
  }

  function onPointer(e: PointerEvent) {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  }

  const resizer = new ResizeObserver(resize);
  resizer.observe(canvas);
  const seen = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
  });
  seen.observe(canvas);
  resize();
  if (!opts.still) {
    window.addEventListener("pointermove", onPointer, { passive: true });
    raf = requestAnimationFrame(frame);
  }

  return {
    dispose() {
      cancelAnimationFrame(raf);
      resizer.disconnect();
      seen.disconnect();
      window.removeEventListener("pointermove", onPointer);
      clearLayout();
      for (const g of [flowerGeo, leafGeo, petalGeo, diyaGeo, oilGeo, flameGeo, glowGeo, boxGeo, studGeo, planeGeo]) {
        g.dispose();
      }
      for (const m of [
        flowerMat,
        leafMat,
        petalMat,
        diyaMat,
        oilMat,
        teakMat,
        brassMat,
        stoneMat,
        wallMat,
        roomMat,
        floorMat,
      ]) {
        m.dispose();
      }
      renderer.dispose();
    },
  };
}
