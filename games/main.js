/* ================================================================
   METRO DASH 3D  –  main.js
   A cyberpunk endless runner powered by Three.js r128.
   Original concept – NOT based on any specific game's assets.
   Gameplay inspired by the endless-runner genre.

   Architecture:
   ┌─ Config & Colors
   ├─ Game State (G) + Player State (P)
   ├─ Three.js: renderer / scene / camera / lights
   ├─ Environment: sky / stars / ground / buildings
   ├─ Player model with run animation
   ├─ Object pools: obstacles / coins / particles
   ├─ Physics: jump, slide, lane transitions
   ├─ Collision detection (AABB)
   ├─ Spawn system (patterns)
   ├─ Audio (Web Audio API – no files needed)
   ├─ Input (keyboard + touch swipe)
   ├─ UI management
   └─ Main loop (requestAnimationFrame)
   ================================================================ */
'use strict';

/* ─────────────────────────────────────────────────────────────
   [1]  CONFIG
   ───────────────────────────────────────────────────────────── */
const CFG = {
  // Track layout
  LANES:          [-3.5, 0, 3.5],    // X positions of each lane
  TRACK_W:        12,                 // Track width
  TRACK_HALF:     6,

  // Player movement & physics
  JUMP_VEL:       14.5,              // Initial jump velocity (units/s)
  GRAVITY:        -32,               // Gravity (units/s²)
  SLIDE_DUR:      0.65,              // Slide hold duration (s)
  LANE_SPD:       14,                // Lane transition speed (units/s)
  PLAYER_HW:      0.40,              // Collision half-width
  PLAYER_HH:      1.80,              // Collision height standing
  PLAYER_HH_S:    0.88,              // Collision height sliding
  PLAYER_Z:       0,                 // Player always at this Z

  // World speed
  INIT_SPEED:     14,                // Starting speed (units/s)
  MAX_SPEED:      42,                // Speed cap
  SPEED_STEP:     1.0,               // Speed increase per interval
  SCORE_INTERVAL: 450,               // Score between speed increases

  // Spawn Z positions
  SPAWN_Z:        -92,               // Obstacles/coins spawn here
  RECYCLE_Z:      22,                // Recycle when past player

  // Ground tiles
  SEG_LEN:        56,
  SEG_COUNT:      6,

  // Object pools
  OBS_POOL:       24,
  COIN_POOL:      48,
  PART_POOL:      96,

  // Camera
  CAM_Y:          8.5,
  CAM_Z:          16,
  CAM_FOV:        70,
  CAM_LERP:       4.5,

  // Scoring
  COIN_VAL:       5,                 // Score per coin
};

/* ─────────────────────────────────────────────────────────────
   [2]  COLORS  (cyberpunk palette)
   ───────────────────────────────────────────────────────────── */
const C = {
  CYAN:      0x00f5ff,
  CYAN_D:    0x003344,
  MAGENTA:   0xff006e,
  ORANGE:    0xff6835,
  RED:       0xff2200,
  GOLD:      0xffd700,
  GREEN:     0x00ff88,
  TRACK:     0x06090f,
  TRACK2:    0x090e1c,
  BUILD:     0x050810,
  PLAYER_B:  0x0d1522,
  SKY:       0x000510,
};

/* ─────────────────────────────────────────────────────────────
   [3]  GAME STATE
   ───────────────────────────────────────────────────────────── */
const G = {
  mode:       'menu',       // 'menu' | 'playing' | 'paused' | 'gameover'
  score:      0,
  coins:      0,
  hs:         0,            // High score
  speed:      CFG.INIT_SPEED,
  nextStep:   CFG.SCORE_INTERVAL,
  spawnT:     0,            // Timer until next spawn
  spawnInt:   2.0,          // Spawn interval (decreases)
  newBest:    false,
  running:    false,        // Physics active flag
};

/* Player state (separate from Three.js group) */
const P = {
  lane:       1,            // 0=left, 1=center, 2=right
  x:          0,            // Current X (lerped)
  y:          0,            // Feet Y (0 = on ground)
  velY:       0,            // Vertical velocity
  jumping:    false,
  sliding:    false,
  slideT:     0,
  runT:       0,            // Animation clock
  alive:      true,
  moveLock:   false,        // Prevent double-input
  group:      null,         // THREE.Group
  parts:      {},           // Named mesh refs
};

/* ─────────────────────────────────────────────────────────────
   [4]  THREE.JS GLOBALS
   ───────────────────────────────────────────────────────────── */
let scene, camera, renderer, clock;
let groundSegs  = [];       // Array of ground segment Groups
let obPool      = [];       // Obstacle pool items
let coPool      = [];       // Coin pool items
let ptPool      = [];       // Particle pool items

/* ─────────────────────────────────────────────────────────────
   [5]  INPUT STATE
   ───────────────────────────────────────────────────────────── */
const INPUT = {
  left: false, right: false, up: false, down: false,
  // Touch / swipe tracking
  tx: 0, ty: 0, tTime: 0,
  minSwipe: 45,             // Minimum swipe pixels
  maxTime:  350,            // Max swipe duration (ms)
};

/* ─────────────────────────────────────────────────────────────
   [6]  AUDIO  (Web Audio API – procedural sounds)
   ───────────────────────────────────────────────────────────── */
let AC = null;              // AudioContext (created on first user gesture)
let masterGain = null;
let bgmNodes = [];
let bgmRunning = false;

/* ─────────────────────────────────────────────────────────────
   [7]  ENTRY POINT
   ───────────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', init);

function init() {
  loadHS();
  buildRenderer();
  buildScene();
  buildCamera();
  buildLights();
  buildSky();
  buildGround();
  buildBuildings();
  buildPlayer();
  buildObstaclePool();
  buildCoinPool();
  buildParticlePool();
  setupInput();
  setupUI();
  updateMenuHS();
  clock = new THREE.Clock();
  loop();
}

/* ─────────────────────────────────────────────────────────────
   [8]  THREE.JS SETUP
   ───────────────────────────────────────────────────────────── */
function buildRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('gameCanvas'),
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(C.SKY);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function buildScene() {
  scene = new THREE.Scene();
  // Exponential fog for atmospheric depth
  scene.fog = new THREE.FogExp2(0x000814, 0.016);
}

function buildCamera() {
  camera = new THREE.PerspectiveCamera(CFG.CAM_FOV,
    window.innerWidth / window.innerHeight, 0.1, 600);
  camera.position.set(0, CFG.CAM_Y, CFG.CAM_Z);
  camera.lookAt(0, 1.5, -8);
}

function buildLights() {
  // Dim ambient – dark world
  const ambient = new THREE.AmbientLight(0x111133, 1.2);
  scene.add(ambient);

  // Hemisphere – sky/ground color
  const hemi = new THREE.HemisphereLight(0x001a3a, 0x000508, 0.8);
  scene.add(hemi);

  // Main directional light (moonlight-ish)
  const dir = new THREE.DirectionalLight(0x8899cc, 1.0);
  dir.position.set(5, 18, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near   = 0.1;
  dir.shadow.camera.far    = 80;
  dir.shadow.camera.left   = -20;
  dir.shadow.camera.right  = 20;
  dir.shadow.camera.top    = 20;
  dir.shadow.camera.bottom = -20;
  dir.shadow.bias = -0.0005;
  scene.add(dir);

  // Neon cyan point light on player (follows player)
  const cyanLight = new THREE.PointLight(C.CYAN, 1.2, 14);
  cyanLight.position.set(0, 3, 1);
  scene.add(cyanLight);
  // Store for update
  scene.userData.playerLight = cyanLight;

  // Distant fill lights for scene atmosphere
  const fillL = new THREE.PointLight(C.MAGENTA, 0.4, 40);
  fillL.position.set(-15, 8, -40);
  scene.add(fillL);

  const fillR = new THREE.PointLight(0x002244, 0.5, 50);
  fillR.position.set(15, 6, -30);
  scene.add(fillR);
}

/* ─────────────────────────────────────────────────────────────
   [9]  ENVIRONMENT
   ───────────────────────────────────────────────────────────── */

/* Sky dome with gradient texture + stars */
function buildSky() {
  // Sky gradient sphere (inside view)
  const skyGeo = new THREE.SphereGeometry(280, 24, 16);
  skyGeo.scale(-1, 1, 1); // Invert normals
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0,  '#000208');
  grad.addColorStop(0.35, '#00081e');
  grad.addColorStop(0.7,  '#001230');
  grad.addColorStop(1.0,  '#001a28');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, 256);
  const skyTex = new THREE.CanvasTexture(canvas);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Star field (Points geometry)
  const starCount = 700;
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // Random point on sphere
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1) * 0.5; // upper hemisphere only
    const r     = 240 + Math.random() * 20;
    starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi) + 20; // bias upward
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    // Star color variety
    const warm = Math.random();
    if (warm > 0.85) {
      starColors[i*3] = 1; starColors[i*3+1] = 0.8; starColors[i*3+2] = 0.6; // warm
    } else if (warm > 0.6) {
      starColors[i*3] = 0.7; starColors[i*3+1] = 0.85; starColors[i*3+2] = 1; // blue
    } else {
      starColors[i*3] = 1; starColors[i*3+1] = 1; starColors[i*3+2] = 1; // white
    }
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color',    new THREE.BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.35, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.85,
  });
  scene.add(new THREE.Points(starGeo, starMat));
}

/* Ground: scrolling tile segments with neon edge strips */
function buildGround() {
  const trackMat = new THREE.MeshPhongMaterial({
    color: C.TRACK, shininess: 60,
  });
  // Cyan edge emissive material
  const edgeMat = new THREE.MeshPhongMaterial({
    color: C.CYAN, emissive: C.CYAN, emissiveIntensity: 1.6,
  });
  // Lane divider material (subtle)
  const divMat = new THREE.MeshPhongMaterial({
    color: 0x003355, emissive: 0x001a2e, emissiveIntensity: 0.8,
  });

  const totalLen = CFG.SEG_LEN * CFG.SEG_COUNT;
  const startZ = -(totalLen / 2) + 20; // Center the tiles around player

  for (let i = 0; i < CFG.SEG_COUNT; i++) {
    const seg = new THREE.Group();

    // Main platform slab
    const plat = new THREE.Mesh(
      new THREE.BoxGeometry(CFG.TRACK_W, 0.3, CFG.SEG_LEN),
      trackMat.clone()
    );
    plat.receiveShadow = true;
    plat.position.y = -0.15; // Top surface at y=0
    seg.add(plat);

    // Left neon edge strip
    const leftEdge = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.12, CFG.SEG_LEN),
      edgeMat.clone()
    );
    leftEdge.position.set(-CFG.TRACK_HALF, 0.07, 0);
    seg.add(leftEdge);

    // Right neon edge strip
    const rightEdge = leftEdge.clone();
    rightEdge.position.x = CFG.TRACK_HALF;
    seg.add(rightEdge);

    // Lane dividers (2 lines between 3 lanes)
    [-1.17, 1.17].forEach(x => {
      const div = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.08, CFG.SEG_LEN),
        divMat.clone()
      );
      div.position.set(x, 0.04, 0);
      seg.add(div);
    });

    // Ground-level side drop-off (gives the feel of elevated track)
    const dropMat = new THREE.MeshPhongMaterial({ color: 0x030508, shininess: 20 });
    [[-CFG.TRACK_HALF - 1, C.CYAN_D], [CFG.TRACK_HALF + 1, C.CYAN_D]].forEach(([x]) => {
      const drop = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.8, CFG.SEG_LEN),
        dropMat
      );
      drop.position.set(x, -0.55, 0);
      seg.add(drop);
    });

    seg.position.z = startZ + i * CFG.SEG_LEN;
    scene.add(seg);
    groundSegs.push(seg);
  }
}

/* Background city silhouette */
function buildBuildings() {
  const buildMat = new THREE.MeshPhongMaterial({ color: C.BUILD, shininess: 40 });
  // Window materials (random colors)
  const winColors = [0x003366, 0x220033, 0x002211, 0x221100, 0x001a22];

  const bldGroup = new THREE.Group();

  [-1, 1].forEach(side => {
    for (let b = 0; b < 18; b++) {
      const w  = 2 + Math.random() * 3.5;
      const h  = 5 + Math.random() * 22;
      const d  = 2 + Math.random() * 4;
      const x  = side * (16 + Math.random() * 18);
      const z  = -20 - b * 14 + Math.random() * 10;

      const geo  = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, buildMat.clone());
      mesh.position.set(x, h / 2, z);
      mesh.castShadow = true;
      bldGroup.add(mesh);

      // Random lit windows (emissive panels)
      const numWin = Math.floor(Math.random() * 4) + 1;
      for (let w2 = 0; w2 < numWin; w2++) {
        const wMat = new THREE.MeshPhongMaterial({
          color: winColors[Math.floor(Math.random() * winColors.length)],
          emissive: winColors[Math.floor(Math.random() * winColors.length)],
          emissiveIntensity: 0.9 + Math.random() * 0.8,
        });
        const wGeo  = new THREE.BoxGeometry(0.5, 0.35, 0.1);
        const wMesh = new THREE.Mesh(wGeo, wMat);
        wMesh.position.set(
          (Math.random() - 0.5) * w * 0.7,
          (Math.random() - 0.5) * h * 0.6,
          side > 0 ? -d / 2 - 0.05 : d / 2 + 0.05
        );
        mesh.add(wMesh);
      }
    }
  });

  scene.add(bldGroup);
}

/* ─────────────────────────────────────────────────────────────
   [10]  PLAYER  (cyberpunk android design)
   ───────────────────────────────────────────────────────────── */
function buildPlayer() {
  const group = new THREE.Group();

  // Shared materials
  const bodyMat = new THREE.MeshPhongMaterial({
    color: C.PLAYER_B, shininess: 120,
    specular: 0x224466,
  });
  const accentMat = new THREE.MeshPhongMaterial({
    color: C.CYAN, emissive: C.CYAN, emissiveIntensity: 0.8, shininess: 200,
  });
  const visorMat = new THREE.MeshPhongMaterial({
    color: C.CYAN, emissive: C.CYAN, emissiveIntensity: 2.0, transparent: true, opacity: 0.9,
  });
  const shoulderMat = new THREE.MeshPhongMaterial({
    color: 0x1a0025, emissive: C.MAGENTA, emissiveIntensity: 0.5, shininess: 100,
  });

  // ── Torso ──────────────────────────────────────────────────
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 1.05, 0.46),
    bodyMat.clone()
  );
  torso.position.y = 0.88; // Center at y=0.88 → spans 0.355 to 1.405
  torso.castShadow = true;
  group.add(torso);

  // Chest accent strip (cyan horizontal line)
  const chestStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.06, 0.48),
    accentMat.clone()
  );
  chestStrip.position.set(0, 1.05, 0);
  group.add(chestStrip);

  // ── Head ───────────────────────────────────────────────────
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.62, 0.48),
    bodyMat.clone()
  );
  head.position.y = 1.68; // sits on torso
  head.castShadow = true;
  group.add(head);

  // Visor (front of head, glowing)
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.18, 0.06),
    visorMat
  );
  visor.position.set(0, 1.70, 0.26);
  group.add(visor);

  // Head top accent
  const headTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.06, 0.48),
    accentMat.clone()
  );
  headTop.position.set(0, 2.0, 0);
  group.add(headTop);

  // ── Shoulder pads (magenta accent) ─────────────────────────
  [-0.58, 0.58].forEach(x => {
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.26, 0.56),
      shoulderMat
    );
    shoulder.position.set(x, 1.28, 0);
    group.add(shoulder);
  });

  // ── Arms ───────────────────────────────────────────────────
  const armGeo = new THREE.BoxGeometry(0.24, 0.68, 0.24);
  const lArm = new THREE.Mesh(armGeo, bodyMat.clone());
  lArm.position.set(-0.58, 0.72, 0);
  lArm.castShadow = true;
  group.add(lArm);

  const rArm = new THREE.Mesh(armGeo, bodyMat.clone());
  rArm.position.set(0.58, 0.72, 0);
  rArm.castShadow = true;
  group.add(rArm);

  // ── Legs (pivot from hip joint) ────────────────────────────
  // Use pivot groups so rotation looks natural
  const lLegPivot = new THREE.Group();
  lLegPivot.position.set(-0.26, 0.35, 0); // Hip position
  const lLegMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.72, 0.28),
    bodyMat.clone()
  );
  lLegMesh.position.y = -0.36; // Dangle below pivot
  lLegMesh.castShadow = true;
  lLegPivot.add(lLegMesh);
  group.add(lLegPivot);

  const rLegPivot = new THREE.Group();
  rLegPivot.position.set(0.26, 0.35, 0);
  const rLegMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.72, 0.28),
    bodyMat.clone()
  );
  rLegMesh.position.y = -0.36;
  rLegMesh.castShadow = true;
  rLegPivot.add(rLegMesh);
  group.add(rLegPivot);

  // Leg accent strips
  const legAccentGeo = new THREE.BoxGeometry(0.28, 0.06, 0.29);
  [lLegPivot, rLegPivot].forEach(pivot => {
    const acc = new THREE.Mesh(legAccentGeo, accentMat.clone());
    acc.position.set(0, -0.05, 0);
    pivot.add(acc);
  });

  // ── Boot bottoms ───────────────────────────────────────────
  [lLegPivot, rLegPivot].forEach(pivot => {
    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.36),
      bodyMat.clone()
    );
    boot.position.set(0, -0.72, 0.04);
    pivot.add(boot);
  });

  // Store references for animation
  P.parts = { lArm, rArm, lLegPivot, rLegPivot, torso, head, visor };

  // Group base at y=0 → bottom of boots at y=0 (feet touch ground)
  group.position.set(CFG.LANES[1], 0, CFG.PLAYER_Z);
  scene.add(group);
  P.group = group;
}

/* ─────────────────────────────────────────────────────────────
   [11]  OBSTACLE POOL
   ───────────────────────────────────────────────────────────── */

/**
 * Obstacle types:
 *   'barrier'  – Short wall (~y=0 to 1.3). Player must JUMP.
 *   'train'    – Full-height metro car (~y=0 to 2.9). Player must DODGE.
 *   'overhead' – High beam spanning all lanes (~y=1.4 to 1.9). Player must SLIDE.
 */
function buildObstaclePool() {
  const types = ['barrier', 'train', 'overhead'];
  const perType = Math.floor(CFG.OBS_POOL / types.length);

  types.forEach(type => {
    for (let i = 0; i < perType; i++) {
      const item = createObstacleMesh(type);
      item.group.visible = false;
      obPool.push(item);
    }
  });
}

function createObstacleMesh(type) {
  const group = new THREE.Group();
  let hw, hh, oy; // Collision half-width, height, base Y offset

  if (type === 'barrier') {
    hw = 1.4; hh = 1.3; oy = 0;

    // Main concrete block
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 1.3, 1.0),
      new THREE.MeshPhongMaterial({ color: 0x1a1614, shininess: 60 })
    );
    body.position.y = 0.65;
    body.castShadow = true;
    group.add(body);

    // Orange warning stripes (alternating)
    const stripeM = new THREE.MeshPhongMaterial({
      color: C.ORANGE, emissive: C.ORANGE, emissiveIntensity: 1.2,
    });
    [0.25, 0.75, 1.15].forEach(y => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.05), stripeM.clone());
      s.position.y = y;
      group.add(s);
    });

    // Top warning light strip
    const topLight = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.08, 0.15),
      new THREE.MeshPhongMaterial({ color: C.RED, emissive: C.RED, emissiveIntensity: 2 })
    );
    topLight.position.set(0, 1.35, -0.45);
    group.add(topLight);

  } else if (type === 'train') {
    hw = 1.38; hh = 2.9; oy = 0;

    // Metro car body (dark maroon/steel)
    const bodyM = new THREE.MeshPhongMaterial({ color: 0x0d0b0a, shininess: 140, specular: 0x334455 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.9, 2.8), bodyM);
    body.position.y = 1.45;
    body.castShadow = true;
    group.add(body);

    // Front face accent strip (orange side stripe)
    const stripeM = new THREE.MeshPhongMaterial({
      color: C.ORANGE, emissive: C.ORANGE, emissiveIntensity: 1.0,
    });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.22, 0.08), stripeM);
    stripe.position.set(0, 1.9, 1.45);
    group.add(stripe);

    // Route number board (cyan)
    const boardM = new THREE.MeshPhongMaterial({
      color: C.CYAN, emissive: C.CYAN, emissiveIntensity: 0.9,
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.32, 0.06), boardM);
    board.position.set(0, 2.5, 1.46);
    group.add(board);

    // Two bright headlights
    const headM = new THREE.MeshPhongMaterial({
      color: 0xffeecc, emissive: 0xffeecc, emissiveIntensity: 2.5,
    });
    [[-0.7, 0.65, 1.45], [0.7, 0.65, 1.45]].forEach(([x, y, z]) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.08), headM);
      hl.position.set(x, y, z);
      group.add(hl);
    });

    // Subtle ambient glow (PointLight) – hints at oncoming train
    const light = new THREE.PointLight(C.ORANGE, 0.8, 10);
    light.position.set(0, 1, 2);
    group.add(light);

    // Door lines (vertical dark strips)
    const doorM = new THREE.MeshPhongMaterial({ color: 0x1a0500 });
    for (let d = 0; d < 2; d++) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.06), doorM);
      door.position.set(d === 0 ? -0.35 : 0.35, 1.45, 1.45);
      group.add(door);
    }

  } else if (type === 'overhead') {
    // Spans ALL lanes – player must SLIDE
    hw = 6.5; hh = 0.5; oy = 1.42;

    const beamM = new THREE.MeshPhongMaterial({ color: 0x0c1420, shininess: 80, specular: 0x223344 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(13, 0.5, 1.6), beamM);
    // Local y=0, world y = oy (set when placed)
    group.add(beam);

    // Cyan under-strip (makes gap visible)
    const underM = new THREE.MeshPhongMaterial({
      color: C.CYAN, emissive: C.CYAN, emissiveIntensity: 1.5,
    });
    const under = new THREE.Mesh(new THREE.BoxGeometry(13, 0.06, 1.62), underM);
    under.position.y = -0.23;
    group.add(under);

    // Red warning end-lights
    const warnM = new THREE.MeshPhongMaterial({ color: C.RED, emissive: C.RED, emissiveIntensity: 2.5 });
    [-6.3, 6.3].forEach(x => {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), warnM.clone());
      w.position.set(x, -0.1, 0);
      group.add(w);
    });

    // Support pillars on sides
    const pillarM = new THREE.MeshPhongMaterial({ color: 0x08111e });
    [-5.8, 5.8].forEach(x => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.22), pillarM);
      pillar.position.set(x, -0.8, 0);
      group.add(pillar);
    });
  }

  group.visible = false;
  scene.add(group);

  return { group, type, hw, hh, oy, active: false };
}

/* Get an inactive obstacle from pool or warn if exhausted */
function getObstacle(type) {
  return obPool.find(o => !o.active && o.type === type) || null;
}

/* Activate an obstacle: place it in the given lane at spawn Z */
function spawnObs(type, lane) {
  const ob = getObstacle(type);
  if (!ob) return;

  ob.active = true;
  ob.group.visible = true;
  ob.group.position.set(CFG.LANES[lane], ob.oy, CFG.SPAWN_Z);
  ob.group.rotation.set(0, 0, 0);
  ob.group.scale.set(1, 1, 1);
}

/* Return obstacle to pool */
function recycleObs(ob) {
  ob.active = false;
  ob.group.visible = false;
  ob.group.position.z = 999;
}

/* ─────────────────────────────────────────────────────────────
   [12]  COIN POOL
   ───────────────────────────────────────────────────────────── */
function buildCoinPool() {
  const coinMat = new THREE.MeshPhongMaterial({
    color: C.GOLD, emissive: C.GOLD, emissiveIntensity: 0.9, shininess: 200,
  });
  // Use OctahedronGeometry for a diamond-like coin shape
  const coinGeo = new THREE.OctahedronGeometry(0.32, 0);

  for (let i = 0; i < CFG.COIN_POOL; i++) {
    const mesh = new THREE.Mesh(coinGeo, coinMat.clone());
    mesh.castShadow = false;
    mesh.visible = false;
    scene.add(mesh);
    coPool.push({ mesh, active: false });
  }
}

/* Spawn a row of N coins in the given lane at spawn Z */
function spawnCoinRow(lane, count) {
  const laneX = CFG.LANES[lane];
  const spacing = 3.2;
  for (let i = 0; i < count; i++) {
    const co = coPool.find(c => !c.active);
    if (!co) continue;
    co.active = true;
    co.mesh.visible = true;
    co.mesh.position.set(laneX, 0.9 + Math.sin(i * 0.4) * 0.2, CFG.SPAWN_Z - i * spacing);
    co.mesh.rotation.set(0, 0, 0);
    co.mesh.scale.set(1, 1, 1);
  }
}

/* Spawn an arc of coins over a barrier (reward for jumping) */
function spawnCoinArc(lane) {
  const laneX = CFG.LANES[lane];
  const count = 5;
  for (let i = 0; i < count; i++) {
    const co = coPool.find(c => !c.active);
    if (!co) continue;
    co.active = true;
    co.mesh.visible = true;
    const t = i / (count - 1);
    const arcH = 2.5 * Math.sin(t * Math.PI); // Parabolic arc
    co.mesh.position.set(laneX, 0.8 + arcH, CFG.SPAWN_Z - i * 2.5);
  }
}

function recycleCoin(co) {
  co.active = false;
  co.mesh.visible = false;
  co.mesh.position.z = 999;
}

/* ─────────────────────────────────────────────────────────────
   [13]  PARTICLE POOL (coin collection burst)
   ───────────────────────────────────────────────────────────── */
function buildParticlePool() {
  const ptGeo = new THREE.OctahedronGeometry(0.12, 0);
  const ptMat = new THREE.MeshPhongMaterial({
    color: C.GOLD, emissive: C.GOLD, emissiveIntensity: 1.5, transparent: true,
  });
  for (let i = 0; i < CFG.PART_POOL; i++) {
    const mesh = new THREE.Mesh(ptGeo, ptMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    ptPool.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0 });
  }
}

/* Burst particles at world position (coin collection) */
function burstParticles(x, y, z, count = 10) {
  for (let i = 0; i < count; i++) {
    const pt = ptPool.find(p => p.life <= 0);
    if (!pt) continue;
    pt.mesh.visible = true;
    pt.mesh.position.set(x, y, z);
    pt.mesh.scale.set(1, 1, 1);
    pt.mesh.material.opacity = 1;
    const speed = 2.5 + Math.random() * 3;
    const angle = Math.random() * Math.PI * 2;
    pt.vel.set(
      Math.cos(angle) * speed,
      1.5 + Math.random() * 4,
      (Math.random() - 0.5) * speed * 0.5
    );
    pt.maxLife = 0.4 + Math.random() * 0.2;
    pt.life = pt.maxLife;
  }
}

/* Crash particles (red burst) */
function burstCrashParticles(x, y, z) {
  for (let i = 0; i < 20; i++) {
    const pt = ptPool.find(p => p.life <= 0);
    if (!pt) continue;
    pt.mesh.visible = true;
    pt.mesh.position.set(x, y, z);
    pt.mesh.scale.set(1.5, 1.5, 1.5);
    pt.mesh.material.color.setHex(0xff3300);
    pt.mesh.material.emissive.setHex(0xff1100);
    pt.mesh.material.opacity = 1;
    const speed = 4 + Math.random() * 6;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI;
    pt.vel.set(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.cos(phi) * speed * 0.7 + 2,
      Math.sin(phi) * Math.sin(theta) * speed * 0.5
    );
    pt.maxLife = 0.6 + Math.random() * 0.3;
    pt.life = pt.maxLife;
  }
}

/* ─────────────────────────────────────────────────────────────
   [14]  PHYSICS UPDATE
   ───────────────────────────────────────────────────────────── */
function updatePhysics(dt) {
  if (!G.running || !P.alive) return;

  // ── Lane transition (horizontal) ──────────────────────────
  const targetX = CFG.LANES[P.lane];
  P.x += (targetX - P.x) * Math.min(1, CFG.LANE_SPD * dt);
  P.group.position.x = P.x;

  // Reset move lock once we're close enough to target lane
  if (Math.abs(P.x - targetX) < 0.08) {
    P.moveLock = false;
  }

  // ── Vertical (jump/gravity) ────────────────────────────────
  if (P.jumping) {
    P.velY += CFG.GRAVITY * dt;
    P.y    += P.velY * dt;

    if (P.y <= 0) {
      P.y       = 0;
      P.velY    = 0;
      P.jumping = false;
      playSound('land');
    }
  }
  P.group.position.y = P.y;

  // ── Slide timer ────────────────────────────────────────────
  if (P.sliding) {
    P.slideT -= dt;
    if (P.slideT <= 0) {
      P.sliding = false;
      P.group.scale.y = 1;
      P.group.position.y = P.y;
    } else {
      // Crouch by scaling Y (keeps feet at y=0)
      P.group.scale.y = 0.52;
      // Adjust Y position so bottom stays on ground
      P.group.position.y = P.y;
    }
  }

  // ── Run animation ──────────────────────────────────────────
  P.runT += dt * (G.speed / 10);
  animatePlayer(dt);

  // ── Score & speed ──────────────────────────────────────────
  G.score += dt * G.speed * 0.55; // Score based on distance
  if (G.score >= G.nextStep) {
    G.speed     = Math.min(G.speed + CFG.SPEED_STEP, CFG.MAX_SPEED);
    G.nextStep += CFG.SCORE_INTERVAL;
  }
  // Update spawn interval based on speed
  G.spawnInt = Math.max(0.85, 2.2 - (G.speed - CFG.INIT_SPEED) * 0.055);

  // ── HUD update ─────────────────────────────────────────────
  refreshHUD();
}

/* Player run cycle + idle animations */
function animatePlayer(dt) {
  const { lLegPivot, rLegPivot, lArm, rArm, torso, visor } = P.parts;
  const t = P.runT;

  if (P.sliding) {
    // Slide pose: legs straight back, arms forward
    lLegPivot.rotation.x = 0.6;
    rLegPivot.rotation.x = 0.6;
    lArm.rotation.x = -0.7;
    rArm.rotation.x = -0.7;
    torso.rotation.x = 0.25;
  } else if (P.jumping) {
    // Jump pose: arms up, legs tucked
    lLegPivot.rotation.x = -0.5;
    rLegPivot.rotation.x = -0.5;
    lArm.rotation.x = -0.8;
    rArm.rotation.x = -0.8;
    torso.rotation.x = -0.1;
  } else {
    // Running animation
    const swing = Math.sin(t * 7.5) * 0.45;
    lLegPivot.rotation.x =  swing;
    rLegPivot.rotation.x = -swing;
    lArm.rotation.x      = -swing * 0.6;
    rArm.rotation.x      =  swing * 0.6;
    torso.rotation.x     = Math.sin(t * 7.5) * 0.03; // Slight body lean
    torso.position.y = 0.88 + Math.abs(Math.sin(t * 7.5)) * 0.05; // Bounce
  }

  // Visor flicker (subtle emissive pulse)
  visor.material.emissiveIntensity = 1.8 + Math.sin(t * 3) * 0.2;
}

/* ─────────────────────────────────────────────────────────────
   [15]  GROUND SCROLL
   ───────────────────────────────────────────────────────────── */
function updateGround(dt) {
  const move = G.speed * dt;
  groundSegs.forEach(seg => {
    seg.position.z += move;
    // Recycle tile: when fully past player, move behind farthest tile
    if (seg.position.z > CFG.RECYCLE_Z + CFG.SEG_LEN) {
      const minZ = Math.min(...groundSegs.map(s => s.position.z));
      seg.position.z = minZ - CFG.SEG_LEN;
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   [16]  OBSTACLE UPDATE
   ───────────────────────────────────────────────────────────── */
function updateObstacles(dt) {
  const move = G.speed * dt;
  obPool.forEach(ob => {
    if (!ob.active) return;

    ob.group.position.z += move;

    // Rotate train headlights slightly for liveliness
    if (ob.type === 'train') {
      // nothing needed, but we could add train wobble
    }

    // Recycle past player
    if (ob.group.position.z > CFG.RECYCLE_Z) {
      recycleObs(ob);
      return;
    }

    // Collision check
    if (P.alive && checkCollision(ob)) {
      triggerCrash(ob.group.position.clone());
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   [17]  COIN UPDATE
   ───────────────────────────────────────────────────────────── */
function updateCoins(dt) {
  const move = G.speed * dt;
  coPool.forEach(co => {
    if (!co.active) return;

    co.mesh.position.z += move;
    co.mesh.rotation.y += dt * 2.5; // Spin
    co.mesh.position.y = 0.85 + Math.sin(Date.now() * 0.003 + co.mesh.position.x) * 0.12;

    // Recycle
    if (co.mesh.position.z > CFG.RECYCLE_Z) {
      recycleCoin(co);
      return;
    }

    // Collection check
    if (P.alive) {
      const dx = Math.abs(P.x - co.mesh.position.x);
      const dz = Math.abs(co.mesh.position.z - CFG.PLAYER_Z);
      const dy = Math.abs((P.y + 0.9) - co.mesh.position.y);
      if (dx < 0.75 && dz < 1.0 && dy < 0.8) {
        collectCoin(co);
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   [18]  PARTICLE UPDATE
   ───────────────────────────────────────────────────────────── */
function updateParticles(dt) {
  ptPool.forEach(pt => {
    if (pt.life <= 0) return;

    pt.life -= dt;
    const progress = 1 - (pt.life / pt.maxLife); // 0→1 as particle ages

    // Move
    pt.vel.y += -12 * dt; // particle gravity
    pt.mesh.position.addScaledVector(pt.vel, dt);

    // Fade out
    pt.mesh.material.opacity = 1 - progress;
    // Shrink
    const s = Math.max(0, 1 - progress * 1.2);
    pt.mesh.scale.set(s, s, s);

    if (pt.life <= 0) {
      pt.mesh.visible = false;
      // Reset color for reuse
      pt.mesh.material.color.setHex(C.GOLD);
      pt.mesh.material.emissive.setHex(C.GOLD);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   [19]  COLLISION DETECTION  (AABB)
   ───────────────────────────────────────────────────────────── */
function checkCollision(ob) {
  const oz = ob.group.position.z;

  // Only check when obstacle overlaps player's Z region
  if (oz < -1.8 || oz > 3.5) return false;

  const playerH = P.sliding ? CFG.PLAYER_HH_S : CFG.PLAYER_HH;

  if (ob.type === 'overhead') {
    // Overhead beam spans ALL lanes – only check Y
    const playerTop = P.y + playerH;
    const beamBottom = ob.oy; // 1.42
    return playerTop > beamBottom;
  }

  // For barrier / train: check X overlap first
  const obX  = ob.group.position.x;
  const dX   = Math.abs(P.x - obX);
  if (dX > CFG.PLAYER_HW + ob.hw) return false;

  // Y overlap: player from P.y to P.y+playerH vs ob from ob.oy to ob.oy+ob.hh
  const playerTop  = P.y + playerH;
  const obBottom   = ob.oy;
  const obTop      = ob.oy + ob.hh;
  return !(playerTop <= obBottom || P.y >= obTop);
}

/* ─────────────────────────────────────────────────────────────
   [20]  SPAWN SYSTEM
   ───────────────────────────────────────────────────────────── */
const PATTERNS = {
  // Each pattern: array of { type, lane, coinLane (optional), coinCount }
  singleBarrier: (lane)  => [{ type: 'barrier', lane }],
  singleTrain:   (lane)  => [{ type: 'train',   lane }],
  singleOHead:   ()      => [{ type: 'overhead', lane: 1 }], // lane ignored for overhead
  doubleBarrier: (open)  => {
    const blocked = [0, 1, 2].filter(l => l !== open);
    return blocked.map(lane => ({ type: 'barrier', lane }));
  },
  doubleTrain: (open) => {
    const blocked = [0, 1, 2].filter(l => l !== open);
    return blocked.map(lane => ({ type: 'train', lane }));
  },
};

function updateSpawn(dt) {
  if (!G.running) return;
  G.spawnT += dt;
  if (G.spawnT < G.spawnInt) return;
  G.spawnT = 0;

  const roll  = Math.random();
  const speed = G.speed;

  // Weighted pattern selection (gets harder with speed)
  const hardness = Math.min(1, (speed - CFG.INIT_SPEED) / (CFG.MAX_SPEED - CFG.INIT_SPEED));

  if (roll < 0.38 - hardness * 0.1) {
    // ── Coin row ──────────────────────────────────────────────
    spawnCoinRow(rndLane(), 4 + Math.floor(hardness * 3));

  } else if (roll < 0.6 - hardness * 0.05) {
    // ── Single obstacle with coin reward ──────────────────────
    const obsLane  = rndLane();
    const coinLane = rndLane();
    const type     = pickType(hardness);
    spawnObs(type, obsLane);
    if (coinLane !== obsLane || type !== 'train') {
      spawnCoinRow(coinLane, 3);
    }

  } else if (roll < 0.78 + hardness * 0.1) {
    // ── Obstacle with arc coins ───────────────────────────────
    const lane = rndLane();
    const type = pickType(hardness);
    spawnObs(type, lane);
    if (type === 'barrier') spawnCoinArc(lane); // Reward for jumping the barrier

  } else if (hardness > 0.2) {
    // ── Double obstacle (harder) ──────────────────────────────
    const openLane = rndLane();
    const blocked  = [0, 1, 2].filter(l => l !== openLane);
    const type     = Math.random() > 0.5 ? 'barrier' : 'train';
    blocked.forEach(l => spawnObs(type, l));
    spawnCoinRow(openLane, 3); // Coins in open lane = reward for correct choice

  } else {
    // ── Just coins ────────────────────────────────────────────
    spawnCoinRow(rndLane(), 5);
  }
}

function rndLane() { return Math.floor(Math.random() * 3); }

function pickType(hardness) {
  const r = Math.random();
  if (hardness < 0.25)      return r < 0.55 ? 'barrier' : r < 0.85 ? 'train' : 'overhead';
  else if (hardness < 0.55) return r < 0.38 ? 'barrier' : r < 0.72 ? 'train' : 'overhead';
  else                      return r < 0.28 ? 'barrier' : r < 0.60 ? 'train' : 'overhead';
}

/* ─────────────────────────────────────────────────────────────
   [21]  CAMERA UPDATE
   ───────────────────────────────────────────────────────────── */
function updateCamera(dt) {
  // Smoothly follow player's X position
  const targetX = P.x * 0.35; // Partial follow (not full) for dramatic lean
  camera.position.x += (targetX - camera.position.x) * CFG.CAM_LERP * dt;

  // Dynamic camera tilt when jumping
  const targetY = CFG.CAM_Y + P.y * 0.18;
  camera.position.y += (targetY - camera.position.y) * 4 * dt;

  camera.lookAt(P.x * 0.2, 1.5, -8);

  // Player neon light follows player
  const pLight = scene.userData.playerLight;
  if (pLight) {
    pLight.position.x += (P.x - pLight.position.x) * 8 * dt;
    pLight.position.y = 3 + P.y;
  }
}

/* ─────────────────────────────────────────────────────────────
   [22]  COIN COLLECTION
   ───────────────────────────────────────────────────────────── */
function collectCoin(co) {
  // Burst particles at coin position
  burstParticles(co.mesh.position.x, co.mesh.position.y, co.mesh.position.z);

  G.coins++;
  G.score += CFG.COIN_VAL;

  playSound('coin');
  recycleCoin(co);
  refreshHUD();
}

/* ─────────────────────────────────────────────────────────────
   [23]  CRASH
   ───────────────────────────────────────────────────────────── */
function triggerCrash(hitPos) {
  if (!P.alive) return;
  P.alive = false;
  G.running = false;

  playSound('crash');
  burstCrashParticles(hitPos.x, hitPos.y + 1, hitPos.z);

  // Flash player red
  P.group.traverse(child => {
    if (child.isMesh && child.material) {
      const m = child.material;
      m.emissive.setHex(0xff2200);
      m.emissiveIntensity = 3;
    }
  });

  // Camera shake effect
  cameraShake(0.4);

  // Show game over after delay
  setTimeout(endGame, 900);
}

let shakeTimer = 0, shakeMag = 0;
function cameraShake(duration) {
  shakeTimer = duration;
  shakeMag   = 0.35;
}

/* ─────────────────────────────────────────────────────────────
   [24]  GAME STATE MANAGEMENT
   ───────────────────────────────────────────────────────────── */
function startGame() {
  initAudio();

  // Reset game state
  G.score     = 0;
  G.coins     = 0;
  G.speed     = CFG.INIT_SPEED;
  G.nextStep  = CFG.SCORE_INTERVAL;
  G.spawnT    = 0;
  G.spawnInt  = 2.0;
  G.newBest   = false;
  G.mode      = 'playing';
  G.running   = false; // Will be set true after countdown

  // Reset player state
  P.lane     = 1;
  P.x        = 0;
  P.y        = 0;
  P.velY     = 0;
  P.jumping  = false;
  P.sliding  = false;
  P.slideT   = 0;
  P.runT     = 0;
  P.alive    = true;
  P.moveLock = false;

  // Restore player appearance
  P.group.position.set(0, 0, 0);
  P.group.scale.set(1, 1, 1);
  P.group.traverse(child => {
    if (child.isMesh && child.material) {
      // Reset emissives based on mesh type
      const m = child.material;
      m.emissiveIntensity = m.userData.origEmissive ?? m.emissiveIntensity;
    }
  });

  // Recycle all active obstacles and coins
  obPool.forEach(recycleObs);
  coPool.forEach(recycleCoin);
  ptPool.forEach(pt => {
    pt.life = 0;
    pt.mesh.visible = false;
  });

  // Reset ground positions
  groundSegs.forEach((seg, i) => {
    seg.position.z = -(CFG.SEG_LEN * CFG.SEG_COUNT / 2) + 20 + i * CFG.SEG_LEN;
  });

  // Camera reset
  camera.position.set(0, CFG.CAM_Y, CFG.CAM_Z);

  // Show countdown then start
  showScreen(null);
  showCountdown(() => {
    G.running = true;
    showScreen('hud');
    startBGM();
  });
}

function pauseGame() {
  if (G.mode !== 'playing') return;
  G.mode    = 'paused';
  G.running = false;
  clock.stop();
  stopBGM();
  document.getElementById('pauseScore').textContent = Math.floor(G.score);
  showScreen('pause');
}

function resumeGame() {
  G.mode    = 'playing';
  G.running = true;
  clock.start();
  startBGM();
  showScreen('hud');
}

function endGame() {
  G.mode    = 'gameover';
  G.running = false;
  stopBGM();

  // Check high score
  const finalScore = Math.floor(G.score);
  if (finalScore > G.hs) {
    G.hs     = finalScore;
    G.newBest = true;
    saveHS();
  }

  // Update game over screen
  document.getElementById('goScore').textContent  = finalScore.toLocaleString();
  document.getElementById('goCoins').textContent  = G.coins;
  document.getElementById('goHS').textContent     = G.hs.toLocaleString();
  document.getElementById('menuHS').textContent   = G.hs.toLocaleString();

  const badge = document.getElementById('newBestBadge');
  if (G.newBest) badge.classList.remove('hidden');
  else            badge.classList.add('hidden');

  showScreen('gameover');
}

function returnToMenu() {
  G.mode    = 'menu';
  G.running = false;
  stopBGM();
  obPool.forEach(recycleObs);
  coPool.forEach(recycleCoin);
  updateMenuHS();
  showScreen('menu');
}

/* Countdown 3-2-1-GO before game starts */
function showCountdown(onDone) {
  const el    = document.getElementById('countdown');
  const numEl = document.getElementById('countNum');
  let count   = 3;

  el.classList.remove('hidden');
  numEl.textContent = count;

  const tick = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(tick);
      numEl.textContent = 'GO!';
      numEl.style.color = '#00ff88';
      setTimeout(() => {
        el.classList.add('hidden');
        numEl.style.color = '';
        onDone();
      }, 600);
    } else {
      numEl.textContent = count;
      // Re-trigger animation
      numEl.style.animation = 'none';
      void numEl.offsetWidth;
      numEl.style.animation = '';
    }
  }, 800);
}

/* ─────────────────────────────────────────────────────────────
   [25]  HUD
   ───────────────────────────────────────────────────────────── */
function refreshHUD() {
  document.getElementById('hudScore').textContent = Math.floor(G.score).toLocaleString();
  document.getElementById('hudCoins').textContent = G.coins;
  document.getElementById('hudBest').textContent  = G.hs.toLocaleString();

  // Speed bar
  const pct = Math.min(100, ((G.speed - CFG.INIT_SPEED) / (CFG.MAX_SPEED - CFG.INIT_SPEED)) * 100);
  document.getElementById('speedFill').style.width = pct + '%';
}

/* ─────────────────────────────────────────────────────────────
   [26]  SCREEN MANAGEMENT
   ───────────────────────────────────────────────────────────── */
const SCREENS = {
  menu:     document.getElementById('menuScreen'),
  howto:    document.getElementById('howToScreen'),
  pause:    document.getElementById('pauseScreen'),
  gameover: document.getElementById('gameoverScreen'),
  hud:      document.getElementById('hud'),
};

function showScreen(name) {
  // Hide all screens first
  Object.entries(SCREENS).forEach(([key, el]) => {
    if (key === 'hud') {
      el.classList.toggle('hidden', name !== 'hud');
    } else {
      el.classList.toggle('hidden', key !== name);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   [27]  UI EVENT LISTENERS
   ───────────────────────────────────────────────────────────── */
function setupUI() {
  // Menu
  document.getElementById('playBtn').addEventListener('click', startGame);
  document.getElementById('howToBtn').addEventListener('click', () => showScreen('howto'));
  document.getElementById('howToBackBtn').addEventListener('click', () => showScreen('menu'));

  // Pause
  document.getElementById('pauseBtn').addEventListener('click', pauseGame);
  document.getElementById('resumeBtn').addEventListener('click', resumeGame);
  document.getElementById('pauseMenuBtn').addEventListener('click', returnToMenu);

  // Game over
  document.getElementById('restartBtn').addEventListener('click', startGame);
  document.getElementById('goMenuBtn').addEventListener('click', returnToMenu);
}

function updateMenuHS() {
  document.getElementById('menuHS').textContent = G.hs.toLocaleString();
}

/* ─────────────────────────────────────────────────────────────
   [28]  INPUT  (Keyboard + Touch Swipe)
   ───────────────────────────────────────────────────────────── */
function setupInput() {

  /* ── Keyboard ───────────────────────────────────────────── */
  document.addEventListener('keydown', e => {
    if (G.mode !== 'playing' || !G.running) return;

    switch (e.code) {
      case 'ArrowLeft':  case 'KeyA': moveLeft();  break;
      case 'ArrowRight': case 'KeyD': moveRight(); break;
      case 'ArrowUp':    case 'KeyW': case 'Space': doJump();  break;
      case 'ArrowDown':  case 'KeyS': doSlide(); break;
      case 'Escape': case 'KeyP': pauseGame(); break;
    }
  });

  /* ── Touch Swipe ────────────────────────────────────────── */
  document.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    INPUT.tx    = t.clientX;
    INPUT.ty    = t.clientY;
    INPUT.tTime = Date.now();
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', e => {
    if (G.mode !== 'playing' || !G.running) return;

    const t  = e.changedTouches[0];
    const dx = t.clientX - INPUT.tx;
    const dy = t.clientY - INPUT.ty;
    const dt = Date.now() - INPUT.tTime;

    if (dt > INPUT.maxTime) return; // Too slow

    const ax = Math.abs(dx), ay = Math.abs(dy);

    if (ax < INPUT.minSwipe && ay < INPUT.minSwipe) return; // Too short

    if (ax > ay) {
      // Horizontal swipe
      if (dx > 0) moveRight();
      else        moveLeft();
    } else {
      // Vertical swipe
      if (dy < 0) doJump();   // Swipe up
      else        doSlide();  // Swipe down
    }
    e.preventDefault();
  }, { passive: false });
}

/* Player actions */
function moveLeft() {
  if (P.moveLock || P.lane <= 0) return;
  P.lane--;
  P.moveLock = true;
  playSound('swoosh');
}

function moveRight() {
  if (P.moveLock || P.lane >= 2) return;
  P.lane++;
  P.moveLock = true;
  playSound('swoosh');
}

function doJump() {
  if (P.jumping || P.sliding) return;
  P.jumping = true;
  P.velY    = CFG.JUMP_VEL;
  playSound('jump');
}

function doSlide() {
  if (P.jumping) return; // Can't slide while jumping
  if (!P.sliding) {
    P.sliding  = true;
    P.slideT   = CFG.SLIDE_DUR;
  }
}

/* ─────────────────────────────────────────────────────────────
   [29]  WEB AUDIO  (procedural sounds – no files needed)
   ───────────────────────────────────────────────────────────── */
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(AC.destination);
  } catch (e) {
    console.warn('[Metro Dash] Web Audio not supported:', e);
  }
}

function playSound(type) {
  if (!AC) return;
  try {
    const t = AC.currentTime;
    if (type === 'jump') {
      const osc  = AC.createOscillator();
      const gain = AC.createGain();
      osc.connect(gain); gain.connect(masterGain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, t);
      osc.frequency.exponentialRampToValueAtTime(520, t + 0.12);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t); osc.stop(t + 0.25);

    } else if (type === 'land') {
      const osc  = AC.createOscillator();
      const gain = AC.createGain();
      osc.connect(gain); gain.connect(masterGain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.15);

    } else if (type === 'coin') {
      // Quick ascending arpeggio
      [0, 4, 8].forEach((semis, i) => {
        const osc  = AC.createOscillator();
        const gain = AC.createGain();
        osc.connect(gain); gain.connect(masterGain);
        const freq = 660 * Math.pow(2, semis / 12);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const delay = i * 0.055;
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.35, t + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.18);
        osc.start(t + delay);
        osc.stop(t + delay + 0.2);
      });

    } else if (type === 'crash') {
      // Low noise + impact
      const buf   = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
      const data  = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
      const src   = AC.createBufferSource();
      src.buffer  = buf;
      const gain  = AC.createGain();
      const dist  = AC.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x));
      }
      dist.curve = curve;
      src.connect(dist); dist.connect(gain); gain.connect(masterGain);
      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      src.start(t); src.stop(t + 0.55);

      // Sub bass thud
      const sub  = AC.createOscillator();
      const sGain= AC.createGain();
      sub.connect(sGain); sGain.connect(masterGain);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(80, t);
      sub.frequency.exponentialRampToValueAtTime(25, t + 0.3);
      sGain.gain.setValueAtTime(0.7, t);
      sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      sub.start(t); sub.stop(t + 0.4);

    } else if (type === 'swoosh') {
      // Lane switch wind effect
      const buf  = AC.createBuffer(1, AC.sampleRate * 0.12, AC.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
      const src  = AC.createBufferSource();
      src.buffer = buf;
      const filt = AC.createBiquadFilter();
      filt.type  = 'bandpass';
      filt.frequency.value = 1200;
      filt.Q.value = 0.5;
      const gain = AC.createGain();
      src.connect(filt); filt.connect(gain); gain.connect(masterGain);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      src.start(t); src.stop(t + 0.14);
    }
  } catch (e) {
    // Ignore audio errors silently
  }
}

/* Background music – minimalist cyberpunk beat */
let bgmActive = false;
let bgmScheduled = 0;

function startBGM() {
  if (!AC || bgmActive) return;
  bgmActive = true;
  bgmScheduled = AC.currentTime + 0.1;
  scheduleBGM();
}

function scheduleBGM() {
  if (!bgmActive) return;

  const t = bgmScheduled;
  const bpm = 128;
  const beat = 60 / bpm;

  // Kick drum (4-on-the-floor)
  for (let b = 0; b < 4; b++) {
    playKick(t + b * beat);
  }
  // Hi-hat (8ths)
  for (let b = 0; b < 8; b++) {
    playHihat(t + b * beat * 0.5, b % 2 === 0 ? 0.18 : 0.09);
  }
  // Sub bass pulse (root note)
  for (let b = 0; b < 4; b++) {
    playBass(t + b * beat, b % 4 === 0 ? 55 : b % 2 === 0 ? 55 : 82);
  }

  bgmScheduled = t + 4 * beat; // 1 bar at 4/4

  // Schedule next bar
  const delay = (bgmScheduled - AC.currentTime - 0.05) * 1000;
  bgmHandle = setTimeout(scheduleBGM, Math.max(0, delay));
}

function playKick(t) {
  if (!AC || !bgmActive) return;
  const osc  = AC.createOscillator();
  const gain = AC.createGain();
  osc.connect(gain); gain.connect(masterGain);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);
  gain.gain.setValueAtTime(0.55, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.start(t); osc.stop(t + 0.22);
}

function playHihat(t, vol) {
  if (!AC || !bgmActive) return;
  const buf  = AC.createBuffer(1, Math.floor(AC.sampleRate * 0.08), AC.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src  = AC.createBufferSource();
  src.buffer = buf;
  const filt = AC.createBiquadFilter();
  filt.type  = 'highpass';
  filt.frequency.value = 8000;
  const gain = AC.createGain();
  src.connect(filt); filt.connect(gain); gain.connect(masterGain);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  src.start(t); src.stop(t + 0.08);
}

function playBass(t, freq) {
  if (!AC || !bgmActive) return;
  const osc  = AC.createOscillator();
  const gain = AC.createGain();
  osc.connect(gain); gain.connect(masterGain);
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  const filt = AC.createBiquadFilter();
  filt.type  = 'lowpass';
  filt.frequency.setValueAtTime(400, t);
  filt.frequency.exponentialRampToValueAtTime(80, t + 0.15);
  osc.connect(filt); filt.connect(gain);
  gain.gain.setValueAtTime(0.28, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.start(t); osc.stop(t + 0.25);
}

function stopBGM() {
  bgmActive = false;
  if (bgmHandle) clearTimeout(bgmHandle);
  bgmHandle = null;
}

/* ─────────────────────────────────────────────────────────────
   [30]  HIGH SCORE PERSISTENCE
   ───────────────────────────────────────────────────────────── */
function loadHS() {
  G.hs = parseInt(localStorage.getItem('metrodash_hs') || '0', 10);
}
function saveHS() {
  localStorage.setItem('metrodash_hs', G.hs);
}

/* ─────────────────────────────────────────────────────────────
   [31]  MAIN ANIMATION LOOP
   ───────────────────────────────────────────────────────────── */
function loop() {
  requestAnimationFrame(loop);

  let dt = clock.getDelta();
  dt = Math.min(dt, 0.08); // Cap delta to avoid spiral-of-death on tab switch

  // Camera shake (crash effect)
  if (shakeTimer > 0) {
    shakeTimer -= dt;
    const s = shakeMag * (shakeTimer / 0.4);
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s * 0.5;
    if (shakeTimer <= 0) shakeMag = 0;
  }

  if (G.mode === 'playing' || G.mode === 'gameover') {
    updateGround(G.running ? dt : 0);
    updateObstacles(G.running ? dt : 0);
    updateCoins(G.running ? dt : 0);
    updateParticles(dt);
    updateCamera(dt);
    if (G.running) {
      updatePhysics(dt);
      updateSpawn(dt);
    }
  }

  renderer.render(scene, camera);
}

/* ─────────────────────────────────────────────────────────────
   END OF MAIN.JS
   ───────────────────────────────────────────────────────────── */
