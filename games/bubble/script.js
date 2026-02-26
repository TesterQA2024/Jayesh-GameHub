/**
 * COSMIC BUBBLE BLAST — script.js
 * A professional Bubble Shooter game using Three.js
 */

'use strict';

// ════════════════════════════════════════════════════════════════
// THREE.JS CORE
// ════════════════════════════════════════════════════════════════
let scene, camera, renderer;
let clock;

// ════════════════════════════════════════════════════════════════
// GAME CONSTANTS (recalculated on resize)
// ════════════════════════════════════════════════════════════════
const COLS = 11;           // bubbles per even row
let BR = 22;               // bubble radius (world units = CSS pixels)
let BD = 44;               // bubble diameter
let ROW_H = 38;            // row height (BR * √3)
let GRID_LEFT = 0;         // left edge where first even-row bubble center sits
let GRID_TOP = 62;         // Y of first row bubble center
let W = 0, H = 0;         // canvas dimensions

// Hex bubble colors: index → 0xRRGGBB
const COLORS = [
  0xff3355,   // hot pink-red
  0x00ddff,   // neon cyan
  0xffcc00,   // gold
  0x44ff77,   // neon green
  0xcc44ff,   // purple
  0xff7700,   // orange
];

const COLOR_HEX = ['#ff3355','#00ddff','#ffcc00','#44ff77','#cc44ff','#ff7700'];

// ════════════════════════════════════════════════════════════════
// GAME STATE
// ════════════════════════════════════════════════════════════════
let grid = [];             // grid[row][col] = Bubble | null
let shooter = null;        // current bubble at cannon
let nextB = null;          // next bubble ready
let flyingB = null;        // bubble in flight
let score = 0;
let highScore = 0;
let level = 1;
let combo = 1;
let canShoot = false;
let gameRunning = false;
let aimAngle = -Math.PI / 2;
let time = 0;

// ════════════════════════════════════════════════════════════════
// THREE.JS OBJECTS
// ════════════════════════════════════════════════════════════════
let bgMesh;
let trajectoryObj = null;
let particles = [];        // active particle systems
let bubbleMats = {};       // reusable materials per color

// ════════════════════════════════════════════════════════════════
// AUDIO
// ════════════════════════════════════════════════════════════════
let ctx = null;

function initAudio() {
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) {}
}

function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function playTone(freq, duration, type = 'sine', vol = 0.15, freqEnd = null) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  } catch (_) {}
}

function playShoot()     { playTone(440, 0.08, 'sawtooth', 0.12, 220); }
function playBounce()    { playTone(330, 0.04, 'square', 0.06); }
function playPop()       {
  playTone(880, 0.12, 'sine', 0.18, 110);
  setTimeout(() => playTone(1200, 0.08, 'sine', 0.1, 300), 30);
}
function playCombo()     { playTone(660, 0.15, 'sine', 0.2, 1320); }
function playWin()       {
  [523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => playTone(f, 0.25, 'sine', 0.2), i * 100));
}
function playGameOver()  {
  [440, 330, 220, 110].forEach((f, i) =>
    setTimeout(() => playTone(f, 0.3, 'sawtooth', 0.15), i * 120));
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function colsForRow(r) { return r % 2 === 0 ? COLS : COLS - 1; }

/** Convert grid position to world (screen-pixel) center */
function g2w(row, col) {
  const odd = row % 2 === 1;
  return {
    x: GRID_LEFT + (odd ? BR : 0) + col * BD,
    y: GRID_TOP + row * ROW_H
  };
}

/** Get the 6 hex neighbors of a grid cell */
function neighbors(row, col) {
  const even = row % 2 === 0;
  const raw = [
    [row, col - 1], [row, col + 1],
    even ? [row - 1, col - 1] : [row - 1, col],
    even ? [row - 1, col]     : [row - 1, col + 1],
    even ? [row + 1, col - 1] : [row + 1, col],
    even ? [row + 1, col]     : [row + 1, col + 1],
  ];
  return raw.filter(([r, c]) => r >= 0 && c >= 0 && c < colsForRow(r));
}

/** Check if a grid cell has at least one occupied neighbor */
function hasNeighborBubble(row, col) {
  return neighbors(row, col).some(([r, c]) => grid[r] && grid[r][c]);
}

// ════════════════════════════════════════════════════════════════
// THREE.JS MATERIALS
// ════════════════════════════════════════════════════════════════
function getBubbleMat(ci) {
  if (!bubbleMats[ci]) {
    bubbleMats[ci] = new THREE.MeshPhongMaterial({
      color: COLORS[ci],
      shininess: 180,
      specular: new THREE.Color(0xffffff),
      emissive: new THREE.Color(COLORS[ci]).multiplyScalar(0.12),
    });
  }
  return bubbleMats[ci];
}

function makeGlossyBubble(ci, radius) {
  const grp = new THREE.Group();

  // Main sphere
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 24),
    getBubbleMat(ci)
  );
  grp.add(sphere);

  // Specular highlight (small white sphere offset toward camera-top-left)
  const hl = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.32, 10, 10),
    new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      shininess: 300,
    })
  );
  hl.position.set(-radius * 0.28, -radius * 0.28, radius * 0.68);
  grp.add(hl);

  // Rim glow ring (torus)
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.85, radius * 0.07, 8, 32),
    new THREE.MeshBasicMaterial({
      color: COLORS[ci],
      transparent: true,
      opacity: 0.35,
    })
  );
  rim.rotation.x = Math.PI * 0.3;
  grp.add(rim);

  grp.userData.colorIdx = ci;
  return grp;
}

// ════════════════════════════════════════════════════════════════
// SCENE SETUP
// ════════════════════════════════════════════════════════════════
function initScene() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;

  // Lights
  scene.add(new THREE.AmbientLight(0x8899cc, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(-0.3, -0.8, 1);
  scene.add(dir);
  const pt = new THREE.PointLight(0x44aaff, 0.6, 600);
  pt.position.set(150, 150, 300);
  scene.add(pt);

  // Animated background shader
  const bgGeo = new THREE.PlaneGeometry(2, 2);
  const bgMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      uTime:  { value: 0 },
      uRes:   { value: new THREE.Vector2(400, 700) },
    },
    vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
    fragmentShader: `
      precision mediump float;
      uniform float uTime;
      uniform vec2 uRes;

      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }

      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        // Deep space gradient
        vec3 c1 = vec3(0.01, 0.03, 0.12);
        vec3 c2 = vec3(0.05, 0.01, 0.18);
        vec3 c3 = vec3(0.00, 0.08, 0.20);
        float t = uTime * 0.15;
        float b  = sin(uv.y * 1.8 + t) * 0.5 + 0.5;
        float b2 = cos(uv.x * 2.5 + t * 0.6) * 0.5 + 0.5;
        vec3 col = mix(mix(c1, c2, b), c3, b2 * 0.5);

        // Nebula wisps
        for(int i=0;i<3;i++){
          float fi = float(i);
          vec2 np = uv * (2.0 + fi) + vec2(t*(0.04+fi*0.01));
          float n = hash(floor(np*10.0));
          col += vec3(0.0, 0.02, 0.06) * n * (1.0 - uv.y) * 0.4;
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.renderOrder = -999;
  scene.add(bgMesh);
}

function updateCamera() {
  const cont = document.getElementById('gameContainer');
  W = cont.clientWidth;
  H = cont.clientHeight;
  renderer.setSize(W, H, false);
  bgMesh.material.uniforms.uRes.value.set(W, H);

  // Orthographic camera: (0,W) → X left-right,  Y=0 top, Y=H bottom
  camera = new THREE.OrthographicCamera(0, W, 0, H, -500, 500);
  camera.position.z = 200;
  camera.updateProjectionMatrix();
}

// ════════════════════════════════════════════════════════════════
// GRID MANAGEMENT
// ════════════════════════════════════════════════════════════════
function computeLayout() {
  BR = Math.min(Math.floor(W / (COLS * 2 + 1)), 22);
  BD = BR * 2;
  ROW_H = Math.round(BR * Math.sqrt(3));
  GRID_LEFT = Math.round((W - (COLS - 1) * BD) / 2);
  GRID_TOP = 70 + BR;
}

function initGrid() {
  clearGridMeshes();
  grid = [];

  const rows = 5 + Math.min(level, 6);
  const colorCount = Math.min(2 + level, COLORS.length);

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    const cols = colsForRow(r);
    for (let c = 0; c < cols; c++) {
      const ci = Math.floor(Math.random() * colorCount);
      spawnGridBubble(r, c, ci);
    }
  }
}

function spawnGridBubble(r, c, ci) {
  while (grid.length <= r) grid.push([]);
  while (grid[r].length <= c) grid[r].push(null);

  const mesh = makeGlossyBubble(ci, BR - 2);
  const pos = g2w(r, c);
  mesh.position.set(pos.x, pos.y, 0);
  scene.add(mesh);

  grid[r][c] = { ci, mesh, r, c };
}

function clearGridMeshes() {
  for (const row of grid) {
    if (!row) continue;
    for (const b of row) {
      if (b && b.mesh) { scene.remove(b.mesh); disposeGroup(b.mesh); }
    }
  }
}

function repositionGrid() {
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r]) continue;
    for (let c = 0; c < grid[r].length; c++) {
      const b = grid[r][c];
      if (!b) continue;
      const p = g2w(r, c);
      b.mesh.position.set(p.x, p.y, 0);
    }
  }
}

function disposeGroup(grp) {
  grp.traverse(obj => {
    if (obj.isMesh) {
      obj.geometry.dispose();
      if (obj.material !== getBubbleMat(obj.userData?.ci)) obj.material.dispose();
    }
  });
}

// ════════════════════════════════════════════════════════════════
// CANNON / SHOOTER SETUP
// ════════════════════════════════════════════════════════════════
function cannonPos() { return { x: W / 2, y: H - 55 }; }

function pickColor() {
  const colors = activeGridColors();
  return colors[Math.floor(Math.random() * colors.length)] ?? 0;
}

function activeGridColors() {
  const s = new Set();
  for (const row of grid) {
    if (!row) continue;
    for (const b of row) if (b) s.add(b.ci);
  }
  return s.size ? [...s] : [0, 1, 2];
}

function createShooterBubble(ci) {
  const mesh = makeGlossyBubble(ci, BR - 2);
  scene.add(mesh);
  return { ci, mesh };
}

function placeShooterBubble() {
  if (!shooter) return;
  const p = cannonPos();
  shooter.mesh.position.set(p.x, p.y, 2);
}

function placeNextBubble() {
  if (!nextB) return;
  const p = cannonPos();
  nextB.mesh.position.set(p.x - BR * 3.2, p.y, 1);
  nextB.mesh.scale.setScalar(0.65);
  // update mini color dot in DOM
  const dot = document.getElementById('nextBubbleColor');
  if (dot) dot.style.background = COLOR_HEX[nextB.ci];
}

function resetShooter() {
  if (shooter) { scene.remove(shooter.mesh); disposeGroup(shooter.mesh); }
  if (nextB)   { scene.remove(nextB.mesh);   disposeGroup(nextB.mesh); }
  shooter = createShooterBubble(pickColor());
  nextB   = createShooterBubble(pickColor());
  placeShooterBubble();
  placeNextBubble();
}

// ════════════════════════════════════════════════════════════════
// TRAJECTORY PREDICTION
// ════════════════════════════════════════════════════════════════
function buildTrajectory(angle) {
  const cp = cannonPos();
  let x = cp.x, y = cp.y;
  let vx = Math.cos(angle), vy = Math.sin(angle);
  const step = 8;
  const pts = [new THREE.Vector3(x, y, 1)];
  let bounces = 0;

  for (let i = 0; i < 600; i++) {
    x += vx * step;
    y += vy * step;

    if (x - BR < 0)  { x = BR;    vx =  Math.abs(vx); bounces++; }
    if (x + BR > W)  { x = W - BR; vx = -Math.abs(vx); bounces++; }
    if (bounces > 2) break;

    pts.push(new THREE.Vector3(x, y, 1));

    if (y - BR < GRID_TOP + ROW_H * 0.5) break;

    // Hit a grid bubble?
    let hit = false;
    for (let r = 0; r < grid.length && !hit; r++) {
      if (!grid[r]) continue;
      for (let c = 0; c < grid[r].length && !hit; c++) {
        if (!grid[r][c]) continue;
        const p = g2w(r, c);
        const dx = x - p.x, dy = y - p.y;
        if (dx*dx + dy*dy < (BD * 0.92) ** 2) hit = true;
      }
    }
    if (hit) break;
  }
  return pts;
}

function drawTrajectory(angle) {
  clearTrajectory();
  const pts = buildTrajectory(angle);
  if (pts.length < 2) return;

  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    dashSize: 10,
    gapSize: 8,
    linewidth: 1,
  });
  trajectoryObj = new THREE.Line(geo, mat);
  trajectoryObj.computeLineDistances();
  scene.add(trajectoryObj);
}

function clearTrajectory() {
  if (trajectoryObj) {
    scene.remove(trajectoryObj);
    trajectoryObj.geometry.dispose();
    trajectoryObj.material.dispose();
    trajectoryObj = null;
  }
}

// ════════════════════════════════════════════════════════════════
// SHOOTING MECHANICS
// ════════════════════════════════════════════════════════════════
function shoot() {
  if (!canShoot || !shooter || flyingB) return;
  resumeAudio();
  playShoot();

  const spd = 14;
  flyingB = {
    ci: shooter.ci,
    mesh: shooter.mesh,
    x: cannonPos().x,
    y: cannonPos().y,
    vx: Math.cos(aimAngle) * spd,
    vy: Math.sin(aimAngle) * spd,
  };

  // Advance queue
  shooter = nextB;
  nextB = createShooterBubble(pickColor());
  placeShooterBubble();
  placeNextBubble();

  clearTrajectory();
  canShoot = false;
}

function updateFlying() {
  if (!flyingB) return;
  const STEPS = 3; // sub-steps per frame for accuracy
  for (let s = 0; s < STEPS; s++) {
    flyingB.x += flyingB.vx / STEPS;
    flyingB.y += flyingB.vy / STEPS;

    // Wall bounces
    if (flyingB.x - BR < 0)  { flyingB.x = BR;    flyingB.vx =  Math.abs(flyingB.vx); playBounce(); }
    if (flyingB.x + BR > W)  { flyingB.x = W - BR; flyingB.vx = -Math.abs(flyingB.vx); playBounce(); }

    flyingB.mesh.position.set(flyingB.x, flyingB.y, 5);
    flyingB.mesh.rotation.z += 0.05;

    // Hit top wall — attach when bubble center nears row-0 level
    if (flyingB.y <= GRID_TOP + ROW_H * 0.5) {
      attachFlying(flyingB.x, flyingB.y);
      return;
    }

    // Hit a grid bubble
    for (let r = 0; r < grid.length; r++) {
      if (!grid[r]) continue;
      for (let c = 0; c < grid[r].length; c++) {
        if (!grid[r][c]) continue;
        const p = g2w(r, c);
        const dx = flyingB.x - p.x, dy = flyingB.y - p.y;
        if (dx*dx + dy*dy < (BD * 0.88) ** 2) {
          attachFlying(flyingB.x, flyingB.y);
          return;
        }
      }
    }

    // Fell off screen (safety)
    if (flyingB.y > H + BD) {
      scene.remove(flyingB.mesh); disposeGroup(flyingB.mesh);
      flyingB = null;
      enableShooting();
      return;
    }
  }
}

function attachFlying(hitX, hitY) {
  const ci = flyingB.ci;
  const mesh = flyingB.mesh;
  flyingB = null;

  const cell = nearestEmptyCell(hitX, hitY);
  if (!cell) {
    scene.remove(mesh); disposeGroup(mesh);
    enableShooting();
    return;
  }

  const { r, c } = cell;
  while (grid.length <= r) grid.push([]);
  while (grid[r].length <= c) grid[r].push(null);
  grid[r][c] = { ci, mesh, r, c };

  const snap = g2w(r, c);
  mesh.position.set(snap.x, snap.y, 0);
  mesh.scale.setScalar(1);

  // Find matches
  const matched = bfsMatch(r, c, ci);
  if (matched.length >= 3) {
    combo++;
    popBubbles(matched);
    if (combo > 1) { playCombo(); showComboFlash(combo); }
    else playPop();
  } else {
    combo = 1;
  }

  // Drop disconnected bubbles
  setTimeout(() => {
    dropFloating();
    setTimeout(() => {
      checkEndConditions();
      enableShooting();
    }, 200);
  }, 100);
}

function nearestEmptyCell(hitX, hitY) {
  let best = null, bestD = Infinity;

  const approxRow = Math.round((hitY - GRID_TOP) / ROW_H);
  const rMin = Math.max(0, approxRow - 2);
  const rMax = Math.max(approxRow + 2, 2); // always search at least first 3 rows

  for (let r = rMin; r <= rMax; r++) {
    const maxC = colsForRow(r);
    for (let c = 0; c < maxC; c++) {
      if (grid[r] && grid[r][c]) continue; // occupied
      // Row 0 is always valid (attached to ceiling); others must be adjacent
      if (r > 0 && !hasNeighborBubble(r, c)) continue;
      const p = g2w(r, c);
      const dx = hitX - p.x, dy = hitY - p.y;
      const d = dx*dx + dy*dy;
      if (d < bestD) { bestD = d; best = { r, c }; }
    }
  }
  return best;
}

// ════════════════════════════════════════════════════════════════
// MATCH / POP LOGIC
// ════════════════════════════════════════════════════════════════
function bfsMatch(r0, c0, ci) {
  const visited = new Set();
  const queue = [[r0, c0]];
  const found = [];

  while (queue.length) {
    const [r, c] = queue.shift();
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    if (!grid[r] || !grid[r][c]) continue;
    if (grid[r][c].ci !== ci) continue;
    visited.add(key);
    found.push([r, c]);
    for (const [nr, nc] of neighbors(r, c)) queue.push([nr, nc]);
  }
  return found;
}

function popBubbles(cells) {
  let pts = 0;
  for (const [r, c] of cells) {
    const b = grid[r] && grid[r][c];
    if (!b) continue;
    const p = g2w(r, c);
    spawnParticles(p.x, p.y, b.ci);
    scene.remove(b.mesh); disposeGroup(b.mesh);
    grid[r][c] = null;
    pts += 10 * combo;
  }
  addScore(pts);
}

function dropFloating() {
  // Find all bubbles connected to top row (row 0)
  const connected = new Set();

  // Seed: all row-0 bubbles
  for (let c = 0; c < (grid[0] ? grid[0].length : 0); c++) {
    if (grid[0] && grid[0][c]) bfsConnected(0, c, connected);
  }

  // Any bubble NOT in connected set → drop it
  let droppedCount = 0;
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r]) continue;
    for (let c = 0; c < grid[r].length; c++) {
      const b = grid[r][c];
      if (!b) continue;
      if (!connected.has(`${r},${c}`)) {
        const p = g2w(r, c);
        spawnParticles(p.x, p.y, b.ci);
        scene.remove(b.mesh); disposeGroup(b.mesh);
        grid[r][c] = null;
        droppedCount++;
        addScore(15 * combo);
      }
    }
  }
  if (droppedCount > 0) setTimeout(playPop, 80);
}

function bfsConnected(r0, c0, visited) {
  const queue = [[r0, c0]];
  while (queue.length) {
    const [r, c] = queue.shift();
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    if (!grid[r] || !grid[r][c]) continue;
    visited.add(key);
    for (const [nr, nc] of neighbors(r, c)) queue.push([nr, nc]);
  }
}

// ════════════════════════════════════════════════════════════════
// PARTICLES
// ════════════════════════════════════════════════════════════════
function spawnParticles(x, y, ci) {
  const count = 14;
  const col = new THREE.Color(COLORS[ci]);
  const sys = { meshes: [], life: 1.0 };

  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(BR * (0.1 + Math.random() * 0.18), 6, 6);
    const mat = new THREE.MeshPhongMaterial({
      color: col, transparent: true, opacity: 0.9,
      shininess: 80, emissive: col, emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 3);

    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const spd = 3 + Math.random() * 6;
    mesh.userData.vx = Math.cos(angle) * spd;
    mesh.userData.vy = Math.sin(angle) * spd;
    mesh.userData.vz = (Math.random() - 0.5) * 2;
    mesh.userData.spin = (Math.random() - 0.5) * 0.3;

    scene.add(mesh);
    sys.meshes.push(mesh);
  }
  particles.push(sys);
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const sys = particles[i];
    sys.life -= 0.04;
    if (sys.life <= 0) {
      sys.meshes.forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
      particles.splice(i, 1);
      continue;
    }
    sys.meshes.forEach(m => {
      m.position.x += m.userData.vx;
      m.position.y += m.userData.vy;
      m.position.z += m.userData.vz;
      m.userData.vy += 0.4; // gravity
      m.userData.vx *= 0.94;
      m.rotation.x += m.userData.spin;
      m.rotation.z += m.userData.spin;
      m.material.opacity = sys.life * 0.9;
      const sc = sys.life * 0.8 + 0.2;
      m.scale.setScalar(sc);
    });
  }
}

// ════════════════════════════════════════════════════════════════
// SCORE
// ════════════════════════════════════════════════════════════════
function addScore(pts) {
  score += pts;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('cbHighScore', highScore);
  }
  updateHUD();

  // Pop animation on score element
  const el = document.getElementById('score');
  el.classList.remove('score-pop');
  void el.offsetWidth;
  el.classList.add('score-pop');
}

// ════════════════════════════════════════════════════════════════
// UI / HUD
// ════════════════════════════════════════════════════════════════
function updateHUD() {
  document.getElementById('score').textContent     = score;
  document.getElementById('highScore').textContent = highScore;
  document.getElementById('level').textContent     = level;
  const cv = document.getElementById('combo');
  cv.textContent = combo > 1 ? `×${combo}` : '';
}

function showComboFlash(n) {
  const el = document.getElementById('comboText');
  el.textContent = n >= 5 ? `🔥 ULTRA ×${n}!` : n >= 3 ? `⚡ COMBO ×${n}!` : `COMBO ×${n}!`;
  el.style.opacity = '1';
  el.style.transform = 'translate(-50%, -50%) scale(1.4)';
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -50%) scale(0.8)';
  }, 900);
}

// ════════════════════════════════════════════════════════════════
// GAME FLOW
// ════════════════════════════════════════════════════════════════
function checkEndConditions() {
  // Win: grid empty
  if (isGridEmpty()) { winLevel(); return; }

  // Game over: any bubble below danger line
  const dangerY = H - 108;
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r]) continue;
    for (let c = 0; c < grid[r].length; c++) {
      if (!grid[r][c]) continue;
      const p = g2w(r, c);
      if (p.y + BR >= dangerY) { doGameOver(); return; }
    }
  }
}

function isGridEmpty() {
  return grid.every(row => !row || row.every(b => !b));
}

function enableShooting() {
  canShoot = true;
  drawTrajectory(aimAngle);
}

function doGameOver() {
  gameRunning = false;
  canShoot = false;
  clearTrajectory();
  playGameOver();
  document.getElementById('finalScore').textContent   = score;
  document.getElementById('finalHighScore').textContent = highScore;
  setTimeout(() => {
    document.getElementById('gameOverScreen').style.display = 'flex';
  }, 500);
}

function winLevel() {
  gameRunning = false;
  canShoot = false;
  clearTrajectory();
  playWin();
  document.getElementById('winScore').textContent = score;
  setTimeout(() => {
    document.getElementById('winScreen').style.display = 'flex';
  }, 400);
}

function startGame(keepScore = false) {
  // Clear scene
  clearGridMeshes();
  clearTrajectory();
  particles.forEach(sys => sys.meshes.forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }));
  particles.length = 0;
  if (flyingB) { scene.remove(flyingB.mesh); disposeGroup(flyingB.mesh); flyingB = null; }

  if (!keepScore) { score = 0; combo = 1; }
  else combo = 1;

  gameRunning = true;
  canShoot = false;

  computeLayout();
  initGrid();
  resetShooter();
  updateHUD();

  // Brief delay then allow shooting
  setTimeout(enableShooting, 600);
}

function restartFresh() {
  level = 1;
  score = 0;
  startGame(false);
}

function advanceLevel() {
  level++;
  startGame(true);
}

// ════════════════════════════════════════════════════════════════
// INPUT
// ════════════════════════════════════════════════════════════════
function clientToAimAngle(cx, cy) {
  const rect = document.getElementById('gameCanvas').getBoundingClientRect();
  const x = cx - rect.left;
  const y = cy - rect.top;
  const cp = cannonPos();
  let angle = Math.atan2(y - cp.y, x - cp.x);

  // Clamp: don't shoot downward or straight sideways
  const MIN = -Math.PI + 0.18;
  const MAX = -0.18;
  if (angle > -0.001 || angle < -Math.PI + 0.001) angle = -Math.PI / 2;
  angle = Math.max(MIN, Math.min(MAX, angle));
  return angle;
}

function handleAim(cx, cy) {
  if (!canShoot) return;
  aimAngle = clientToAimAngle(cx, cy);
  drawTrajectory(aimAngle);
}

// Mouse
document.addEventListener('mousemove', e => {
  if (!gameRunning) return;
  handleAim(e.clientX, e.clientY);
});

document.addEventListener('click', e => {
  if (!gameRunning || !canShoot) return;
  resumeAudio();
  handleAim(e.clientX, e.clientY);
  shoot();
});

// Touch
let touchActive = false;
document.addEventListener('touchstart', e => {
  e.preventDefault();
  if (!gameRunning) return;
  resumeAudio();
  touchActive = true;
  handleAim(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

document.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!gameRunning || !touchActive) return;
  handleAim(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

document.addEventListener('touchend', e => {
  e.preventDefault();
  if (!gameRunning || !touchActive) return;
  touchActive = false;
  shoot();
}, { passive: false });

// ════════════════════════════════════════════════════════════════
// STARFIELD (on separate canvas)
// ════════════════════════════════════════════════════════════════
function initStarfield() {
  const sc = document.getElementById('starCanvas');
  const ctx2 = sc.getContext('2d');
  const stars = [];

  function resize() {
    sc.width  = window.innerWidth;
    sc.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 160; i++) {
    stars.push({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4,
      a: Math.random(),
      spd: 0.002 + Math.random() * 0.005,
      phase: Math.random() * Math.PI * 2,
    });
  }

  let t = 0;
  (function drawStars() {
    t += 0.016;
    ctx2.clearRect(0, 0, sc.width, sc.height);
    stars.forEach(s => {
      const alpha = s.a * (0.5 + 0.5 * Math.sin(t * s.spd * 20 + s.phase));
      ctx2.beginPath();
      ctx2.arc(s.x * sc.width, s.y * sc.height, s.r, 0, Math.PI * 2);
      ctx2.fillStyle = `rgba(180,210,255,${alpha})`;
      ctx2.fill();
    });
    requestAnimationFrame(drawStars);
  })();
}

// ════════════════════════════════════════════════════════════════
// MAIN LOOP
// ════════════════════════════════════════════════════════════════
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  time += dt;

  // Animate background
  bgMesh.material.uniforms.uTime.value = time;

  // Subtle grid bubble wobble
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r]) continue;
    for (let c = 0; c < grid[r].length; c++) {
      const b = grid[r][c];
      if (!b) continue;
      const s = 1 + 0.025 * Math.sin(time * 2.5 + r * 0.5 + c * 0.7);
      b.mesh.scale.setScalar(s);
      b.mesh.rotation.y += 0.008;
    }
  }

  // Shooter idle animation
  if (shooter && shooter.mesh) {
    const p = cannonPos();
    shooter.mesh.position.y = p.y + Math.sin(time * 3) * 2;
    shooter.mesh.rotation.z += 0.015;
  }

  // Fly
  if (flyingB) updateFlying();

  // Particles
  updateParticles();

  // Trajectory dash animate
  if (trajectoryObj) {
    trajectoryObj.material.dashOffset = -(time * 12) % 18;
  }

  renderer.render(scene, camera);
}

// ════════════════════════════════════════════════════════════════
// RESIZE
// ════════════════════════════════════════════════════════════════
function onResize() {
  updateCamera();
  if (gameRunning || grid.length) {
    computeLayout();
    repositionGrid();
    placeShooterBubble();
    placeNextBubble();
    if (canShoot) drawTrajectory(aimAngle);
  }
}

window.addEventListener('resize', onResize);

// ════════════════════════════════════════════════════════════════
// BUTTON BINDINGS
// ════════════════════════════════════════════════════════════════
document.getElementById('startBtn').addEventListener('click', () => {
  resumeAudio();
  document.getElementById('splashScreen').style.display = 'none';
  startGame(false);
});

document.getElementById('restartBtn').addEventListener('click', () => {
  resumeAudio();
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('winScreen').style.display = 'none';
  restartFresh();
});

document.getElementById('gameOverRestartBtn').addEventListener('click', () => {
  resumeAudio();
  document.getElementById('gameOverScreen').style.display = 'none';
  restartFresh();
});

document.getElementById('nextLevelBtn').addEventListener('click', () => {
  resumeAudio();
  document.getElementById('winScreen').style.display = 'none';
  advanceLevel();
});

document.getElementById('winRestartBtn').addEventListener('click', () => {
  resumeAudio();
  document.getElementById('winScreen').style.display = 'none';
  restartFresh();
});

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  highScore = parseInt(localStorage.getItem('cbHighScore') || '0');

  initAudio();
  initScene();
  updateCamera();
  computeLayout();
  initStarfield();
  animate();
  updateHUD();
});
