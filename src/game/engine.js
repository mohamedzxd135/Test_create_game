import * as THREE from 'three';
import { CLASSES, QUESTS, RANKS, VILLAGES, DUNGEONS } from './data.js';
import { buildWorld } from './world.js';
import { buildPlayerModel, buildEnemyModel, toon, basic } from './models.js';

const ENEMY_TYPES = {
  goblin: { name: 'Goblin', hp: 58, dmg: 9, speed: 5.2, radius: 1.0, xp: 36, gold: 9, model: 'goblin', scale: 1, aggro: 24 },
  wolf: { name: 'Grey Wolf', hp: 52, dmg: 10, speed: 7.6, radius: 1.0, xp: 38, gold: 8, model: 'wolf', scale: 1, aggro: 26 },
  orc: { name: 'Orc Ravager', hp: 185, dmg: 20, speed: 4.2, radius: 1.3, xp: 92, gold: 26, model: 'orc', scale: 1, aggro: 23 },
  wraith: { name: 'Ash Wraith', hp: 270, dmg: 24, speed: 4.6, radius: 1.1, xp: 160, gold: 42, model: 'wraith', scale: 1, aggro: 30, ranged: true },
  direwolf: { name: 'Direwolf', hp: 320, dmg: 32, speed: 8.4, radius: 1.2, xp: 185, gold: 38, model: 'direwolf', scale: 1, aggro: 30 },
  ogre: { name: 'Ogre Shaman', hp: 560, dmg: 42, speed: 3.8, radius: 1.7, xp: 320, gold: 88, model: 'ogre', scale: 1, aggro: 26, ranged: true }
};

const BOSS_MAP = {
  hollow: { type: 'goblin', model: 'goblinking', scale: 1, hp: 1250, dmg: 34, speed: 4.6, radius: 2.6, xp: 900, gold: 420, name: 'Grelk the Goblin King' },
  crypt: { type: 'wraith', model: 'lich', scale: 1, hp: 1900, dmg: 42, speed: 4.4, radius: 1.9, xp: 1400, gold: 650, name: 'Marrow, the Bonecaller' },
  spire: { type: 'ogre', model: 'ogre', scale: 1.8, hp: 2700, dmg: 52, speed: 4.0, radius: 2.4, xp: 2200, gold: 1000, name: 'Veyra the Ashen' },
  sanctum: { type: 'wraith', model: 'lich', scale: 1.5, hp: 4200, dmg: 64, speed: 4.8, radius: 2.2, xp: 3600, gold: 1800, name: 'The Hollow Sovereign' }
};

const WEAPON_COLORS = { swordsman: '#ffd27a', archer: '#b6ffcf', mage: '#b4c4ff' };

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

export class Game {
  constructor(canvas, classId, onState, onEvent) {
    this.canvas = canvas;
    this.classId = classId;
    this.C = CLASSES[classId];
    this.onState = onState;
    this.onEvent = onEvent;
    this.blocked = true;
    this.alive = true;
    this.insideDungeon = null;
    this.cleared = new Set();
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.loot = [];
    this.damageBursts = [];
    this.relics = [];
    this.quests = QUESTS.map(q => ({ ...q, progress: 0, done: false }));
    this.level = 1;
    this.xp = 0;
    this.xpNext = 120;
    this.gold = 180;
    this.potions = 3;
    this.manaPotions = 2;
    this.cooldowns = { q: 0, e: 0, r: 0, dash: 0 };
    this.keys = {};
    this.camYaw = 0;
    this.camPitch = 0.12;
    this.camDist = 12.4;
    this.shake = 0;
    this.time = 0;
    this.hudTimer = 0;
    this.prompt = null;
    this.hitFlash = 0;
    this.locked = false;

    this.initRenderer();
    this.initWorld();
    this.initPlayer();
    this.spawnOverworldEnemies();
    this.bindInput();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.pushHud();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    this.gpuName = gpu;
    // software rasterisers (headless CI, llvmpipe) need a lighter scene
    this.lowQuality = /swiftshader|llvmpipe|software rasterizer|softpipe/i.test(gpu);
    this.quality = this.lowQuality ? 'low' : 'high';
    this.renderer.setPixelRatio(this.lowQuality ? 1 : Math.min(window.devicePixelRatio, 1.6));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = !this.lowQuality;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#a6d3e6');
    this.scene.fog = new THREE.Fog('#b3d1d2', 220, 900);

    this.camera = new THREE.PerspectiveCamera(47, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 4200);

    this.hemi = new THREE.HemisphereLight('#d8eeff', '#4a5c42', 1.32);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffedc4', 2.45);
    this.sun.castShadow = !this.lowQuality;
    this.sun.shadow.mapSize.set(this.lowQuality ? 1024 : 2048, this.lowQuality ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target);
    // cool bounce fill from the opposite side, no shadows
    this.fill = new THREE.DirectionalLight('#9fc4e8', 0.45);
    this.fill.position.set(-60, 40, -50);
    this.scene.add(this.fill);

    // sky dome
    const skyGeo = new THREE.SphereGeometry(2600, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#5ba6d6') },
        mid: { value: new THREE.Color('#b7e1ed') },
        bottom: { value: new THREE.Color('#f0dfb8') },
        sunDir: { value: new THREE.Vector3(0.45, 0.42, 0.58).normalize() }
      },
      vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir;
        void main(){
          float h = clamp(vP.y*0.5+0.5, 0.0, 1.0);
          vec3 col = mix(bottom, mid, smoothstep(0.42,0.56,h));
          col = mix(col, top, smoothstep(0.55,0.95,h));
          float s = max(dot(vP, sunDir), 0.0);
          col += vec3(1.0,0.85,0.55) * pow(s, 90.0) * 1.4;
          col += vec3(1.0,0.9,0.7) * pow(s, 8.0) * 0.12;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
    // sun disc
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: (() => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
        grd.addColorStop(0, 'rgba(255,250,225,1)'); grd.addColorStop(0.28, 'rgba(255,238,185,.9)'); grd.addColorStop(1, 'rgba(255,220,140,0)');
        g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
      })(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    this.sunSprite.scale.set(190, 190, 1);
    this.sunSprite.position.set(1100, 640, 1000);
    this.scene.add(this.sunSprite);
  }

  initWorld() {
    this.world = buildWorld(this.scene, { lowQuality: this.lowQuality, density: this.lowQuality ? 0.55 : 1 });
    this.atmo = {
      bg: new THREE.Color('#9fcadd'), fog: new THREE.Color('#b3d1d2'), fogNear: 220, fogFar: 900, sun: 2.45, hemi: 1.32
    };
  }

  initPlayer() {
    this.player = {
      pos: new THREE.Vector3(0, 0, 24),
      facing: Math.PI,
      radius: 0.75,
      vel: new THREE.Vector3(),
      speed: this.C.speed,
      hp: this.C.hp, maxHp: this.C.hp,
      mp: this.C.mp, maxMp: this.C.mp,
      stamina: this.C.stamina, maxStamina: this.C.stamina,
      moving: false, sprinting: false,
      attackTimer: 0, attackAnim: 0, dashTimer: 0, dashDir: new THREE.Vector3(),
      invuln: 0, buffs: { power: 0, speed: 0, invis: 0, timewarp: 0 },
      inCombat: 0, regen: 0, hitFlash: 0,
      returnPos: new THREE.Vector3()
    };
    this.player.mesh = buildPlayerModel(this.classId);
    this.player.mesh.position.copy(this.player.pos);
    this.player.mesh.rotation.y = this.player.facing;
    this.scene.add(this.player.mesh);
    this.baseDamage = 1;
    this.glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
  }

  // ---------------- spawning ----------------
  spawnEnemies(count, zone) {
    const defs = zone.kind === 'beginner'
      ? [['goblin', 0.46], ['wolf', 0.32], ['orc', 0.22]]
      : [['wraith', 0.34], ['direwolf', 0.34], ['ogre', 0.32]];
    const trail = zone.kind === 'beginner'
      ? [[-300, -360], [-400, -470], [-540, -620], [-660, -760], [-720, -820], [-820, -960], [-930, -1110], [-1060, -1320]]
      : [[300, -540], [400, -700], [500, -940], [560, -1180], [700, -1360], [900, -1500], [1010, -1620]];
    const segs = [];
    for (let i = 0; i < trail.length - 1; i++) segs.push({ a: trail[i], b: trail[i + 1] });
    for (let i = 0; i < count; i++) {
      let r = Math.random(), type = defs[0][0], acc = 0;
      for (const [t, w] of defs) { acc += w; if (r <= acc) { type = t; break; } }
      let x, z, tries = 0;
      do {
        // hunt in packs along the forest trail, with some roamers deeper in
        if (Math.random() < 0.78) {
          const s = segs[Math.min(segs.length - 1, Math.floor(Math.random() * segs.length))];
          const t = Math.random();
          const px = s.a[0] + (s.b[0] - s.a[0]) * t;
          const pz = s.a[1] + (s.b[1] - s.a[1]) * t;
          const side = Math.random() < 0.5 ? -1 : 1;
          x = px + rand(8, 62) * side + rand(-14, 14);
          z = pz + rand(-24, 24);
        } else {
          x = rand(zone.x0 + 40, zone.x1 - 40);
          z = rand(zone.z0 + 40, zone.z1 - 40);
        }
        x = clamp(x, zone.x0 + 30, zone.x1 - 30);
        z = clamp(z, zone.z0 + 30, zone.z1 - 30);
        tries++;
      } while (tries < 8 && this.world.portals.some(p => (p.pos.x - x) ** 2 + (p.pos.z - z) ** 2 < 45 * 45));
      const depth = clamp((zone.z1 - 40 - z) / (zone.z1 - zone.z0 - 80), 0, 1);
      this.spawnEnemy(type, new THREE.Vector3(x, 0, z), { zone, depth });
    }
  }

  spawnEnemy(type, pos, opts = {}) {
    const base = ENEMY_TYPES[type] ?? ENEMY_TYPES.orc;
    let def = base;
    const depth = opts.depth ?? 0;
    const elite = !opts.boss && Math.random() < 0.11;
    if (opts.boss) def = { ...base, ...opts.boss };
    const modelType = opts.boss?.model ?? def.model;
    const scale = (opts.boss?.scale ?? def.scale ?? 1) * (elite ? 1.28 : 1);
    const mesh = buildEnemyModel(modelType, scale);
    mesh.position.copy(pos);
    mesh.rotation.y = rand(0, Math.PI * 2);
    this.scene.add(mesh);
    const baseScale = mesh.scale.x;
    const zone = opts.zone;
    const depthMult = 1 + depth * (zone?.kind === 'monster' ? 3.2 : 2.2);
    const rankIdx = zone
      ? (zone.kind === 'monster' ? clamp(4 + Math.floor(depth * 4), 4, 7) : clamp(Math.floor(depth * 7), 0, 6))
      : 0;
    const hp = Math.round((opts.boss?.hp ?? def.hp ?? 100) * (opts.boss ? 1 : depthMult) * (elite ? 1.8 : 1));
    const dmg = (opts.boss?.dmg ?? def.dmg ?? 10) * (opts.boss ? 1 : (1 + depth * (zone?.kind === 'monster' ? 1.6 : 0.9))) * (elite ? 1.25 : 1);
    const e = {
      id: Math.random().toString(36).slice(2),
      type, name: (elite ? 'Elder ' : '') + (opts.boss?.name ?? def.name ?? 'Beast'),
      hp, maxHp: hp, dmg, speed: (def.speed ?? 4.5) * (elite ? 1.08 : 1),
      radius: (def.radius ?? 1.3) * (elite ? 1.2 : 1),
      xp: Math.round((opts.boss?.xp ?? def.xp ?? 100) * (opts.boss ? 1 : depthMult) * (elite ? 2.1 : 1)),
      gold: Math.round((opts.boss?.gold ?? def.gold ?? 20) * (opts.boss ? 1 : depthMult) * (elite ? 2 : 1)),
      mesh, home: pos.clone(), zone, depth, elite,
      dead: false, deathT: 0, aggro: false, attackCd: 0, slow: 0, stun: 0,
      ranged: def.ranged && !opts.boss, boss: !!opts.boss, rank: opts.boss ? opts.bossRank : (zone ? RANKS[rankIdx] : 'F'),
      interior: this.insideDungeon, flash: 0, wanderT: rand(0, 6), wanderA: Math.random() * 6, wander: new THREE.Vector3(pos.x, 0, pos.z),
      specialCd: 5, baseScale
    };
    this.enemies.push(e);
    return e;
  }

  spawnOverworldEnemies() {
    this.spawnEnemies(34, this.world.spawnZones.beginner);
    this.spawnEnemies(28, this.world.spawnZones.monster);
  }

  spawnDungeon(id) {
    const d = DUNGEONS[id];
    const bossInfo = BOSS_MAP[id];
    const boss = this.spawnEnemy(bossInfo.type, this.world.dungeonInteriors[id].bossPos.clone(), {
      boss: { ...bossInfo, hp: bossInfo.hp, dmg: bossInfo.dmg }, bossRank: d.rank
    });
    boss.aggro = false;
    const minionType = id === 'hollow' ? 'goblin' : id === 'crypt' ? 'wraith' : id === 'spire' ? 'direwolf' : 'ogre';
    this.world.dungeonInteriors[id].minionSpawns.forEach(([x, z], i) => {
      if (i > 3) return;
      const m = this.spawnEnemy(minionType, new THREE.Vector3(x, 0, z), { zone: null });
      m.dmg *= 1.3; m.hp = Math.round(m.hp * 1.5); m.maxHp = m.hp;
      m.aggro = true;
    });
    return boss;
  }

  // ---------------- input ----------------
  bindInput() {
    this._down = e => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (this.blocked || !this.alive) return;
      if (k === 'q' || k === 'e' || k === 'r') this.useAbility(k);
      if (k === '1') this.useHealthPotion();
      if (k === '2') this.useManaPotion();
      if (k === ' ') this.dash();
      if (k === 'f') this.interact();
    };
    this._up = e => { this.keys[e.key.toLowerCase()] = false; };
    this._blur = () => { this.keys = {}; };
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);

    let drag = null;
    this._pd = e => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: 0 };
      this.canvas.setPointerCapture?.(e.pointerId);
    };
    this._pm = e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      this.camYaw -= dx * 0.006;
      this.camPitch = clamp(this.camPitch + dy * 0.0045, 0.02, 1.05);
      drag.x = e.clientX; drag.y = e.clientY;
    };
    this._pu = e => {
      if (!drag) return;
      const wasClick = drag.moved < 8;
      drag = null;
      if (wasClick && !this.blocked && this.alive) this.basicAttack();
    };
    this._wheel = e => { this.camDist = clamp(this.camDist + e.deltaY * 0.012, 7, 24); };
    this.canvas.addEventListener('pointerdown', this._pd);
    window.addEventListener('pointermove', this._pm);
    window.addEventListener('pointerup', this._pu);
    this.canvas.addEventListener('wheel', this._wheel, { passive: true });
    this._resize = () => {
      if (!this.canvas.clientWidth) return;
      this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    };
    window.addEventListener('resize', this._resize);
  }

  setBlocked(v) { this.blocked = v; if (v) this.keys = {}; }

  // ---------------- combat primitives ----------------
  scaledDamage(base) {
    return base * (1 + (this.level - 1) * 0.13) * (this.player.buffs.power > 0 ? 1.6 : 1);
  }

  nearestEnemy(range = 30, facingLimit = null, onlyAggro = false) {
    let best = null, bestD = range;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.interior !== this.insideDungeon) continue;
      if (onlyAggro && !e.aggro) continue;
      const d = e.mesh.position.distanceTo(this.player.pos);
      if (d > bestD) continue;
      if (facingLimit != null) {
        const dir = e.mesh.position.clone().sub(this.player.pos).normalize();
        const f = new THREE.Vector3(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
        const ang = Math.acos(clamp(dir.dot(f), -1, 1));
        if (ang > facingLimit) continue;
      }
      best = e; bestD = d;
    }
    return best;
  }

  faceTowards(v) {
    const dx = v.x - this.player.pos.x, dz = v.z - this.player.pos.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.01) this.player.facing = Math.atan2(dx, dz);
  }

  dealDamage(e, raw, opts = {}) {
    if (e.dead) return;
    const crit = opts.crit ?? Math.random() < 0.16;
    const dmg = Math.round(raw * (crit ? 1.8 : 1));
    e.hp -= dmg;
    e.aggro = true;
    e.flash = 0.18;
    this.player.inCombat = 5;
    const p = e.mesh.position.clone(); p.y += 2.4 * (e.elite ? 1.25 : 1);
    this.emitDamage(p, dmg, crit, opts.color ?? '#ffe4a8');
    this.burst(p, opts.color ?? '#ffd27a', crit ? 12 : 6, crit ? 7 : 4.5);
    if (e.hp <= 0) this.killEnemy(e);
    else if (opts.knockback) {
      const dir = e.mesh.position.clone().sub(this.player.pos).setY(0).normalize();
      e.mesh.position.add(dir.multiplyScalar(opts.knockback));
      if (e.boss) e.mesh.position.copy(e.mesh.position);
    }
    if (opts.stun) e.stun = opts.stun;
    if (opts.slow) e.slow = Math.max(e.slow, opts.slow);
  }

  emitDamage(pos, amount, crit, color) {
    const v = pos.clone().project(this.camera);
    if (v.z > 1 || v.z < -1) return;
    this.onEvent?.({
      type: 'damage', id: Math.random().toString(36).slice(2),
      text: (crit ? '✦ ' : '') + amount, crit,
      x: clamp((v.x * 0.5 + 0.5) * 100, 4, 96),
      y: clamp((-v.y * 0.5 + 0.5) * 100, 10, 92),
      color
    });
  }

  killEnemy(e) {
    e.dead = true; e.deathT = 0.001;
    e.hp = 0;
    this.gainXp(e.xp);
    this.gold += e.gold;
    this.burst(e.mesh.position.clone().setY(1.4), e.boss ? '#ffce75' : '#c8f0b0', e.boss ? 40 : 16, e.boss ? 12 : 7);
    this.ring(e.mesh.position.clone(), e.boss ? 9 : 3.4, e.boss ? '#ffd98a' : '#e7f3c0', 0.7);
    if (Math.random() < 0.22 || e.boss) this.dropLoot(e.mesh.position.clone(), Math.random() < 0.3 ? 'mana' : 'health');
    if (e.boss) {
      this.onEvent?.({ type: 'bossDown', name: e.name });
      this.completeDungeon(e.id);
    } else {
      const questType = e.type === 'goblink' ? 'goblin' : e.type;
      this.progressQuests('kill', questType);
      if (this.player.buffs.timewarp > 0) this.player.buffs.timewarp = Math.min(this.player.buffs.timewarp, 4);
    }
  }

  gainXp(n) {
    if (!Number.isFinite(n) || n <= 0) return;
    this.xp += n;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.floor(120 * Math.pow(this.level, 1.45));
      this.player.maxHp = Math.round(this.C.hp + (this.level - 1) * 24);
      this.player.maxMp = Math.round(this.C.mp + (this.level - 1) * 9);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.35));
      this.player.mp = this.player.maxMp;
      this.onEvent?.({ type: 'toast', title: `LEVEL ${this.level}`, sub: 'Your legend grows stronger', tone: 'gold' });
      this.ring(this.player.pos.clone().setY(0.4), 7, '#ffe29a', 1.2);
      this.burst(this.player.pos.clone().setY(1.6), '#ffe9b0', 24, 9);
    }
    this.pushHud();
  }

  dropLoot(pos, kind) {
    const g = new THREE.Group();
    const color = kind === 'health' ? '#ff6b6b' : '#66c8ff';
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8), toon(color, { emissive: color, emissiveIntensity: 0.6 }));
    bottle.position.y = 0.6; g.add(bottle);
    g.position.set(pos.x + rand(-1, 1), 0, pos.z + rand(-1, 1));
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    spr.scale.set(3, 3, 1); g.add(spr);
    this.scene.add(g);
    this.loot.push({ mesh: g, kind, t: 0, pos: g.position.clone() });
  }

  // ---------------- player actions ----------------
  basicAttack() {
    if (this.player.attackTimer > 0 || !this.alive) return;
    const b = this.C.basic;
    this.player.attackTimer = b.cd;
    this.player.attackAnim = 0.26;
    this.player.inCombat = 4;
    const target = this.nearestEnemy(b.range + 4, 1.1);
    if (target) this.faceTowards(target.mesh.position);
    if (b.kind === 'melee') {
      this.playSlash(this.player.pos.clone(), this.player.facing, 4.6, WEAPON_COLORS[this.classId], 0.3);
      this.damageInArc(b.range, b.arc, this.scaledDamage(b.dmg), { knockback: 0.8, color: '#ffe3af' });
    } else {
      const f = new THREE.Vector3(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
      const origin = this.player.pos.clone().add(new THREE.Vector3(0, 1.7, 0)).add(f.clone().multiplyScalar(1.2));
      const aim = target ? target.mesh.position.clone().setY(1.4) : origin.clone().add(f.clone().multiplyScalar(30));
      this.spawnProjectile({
        origin, target: aim, targetEnemy: target, speed: b.kind === 'arrow' ? 52 : 38,
        damage: this.scaledDamage(b.dmg), color: b.kind === 'arrow' ? '#d9ffb8' : '#b6c4ff',
        size: b.kind === 'arrow' ? 0.16 : 0.3, homing: b.kind === 'bolt' ? 0.14 : 0.04,
        kind: b.kind, trail: true
      });
    }
  }

  dash() {
    const p = this.player;
    if (this.cooldowns.dash > 0 || p.stamina < 26 || p.dashTimer > 0) return;
    const dir = this.moveDir();
    if (dir.lengthSq() < 0.1) dir.set(Math.sin(p.facing), 0, Math.cos(p.facing));
    p.dashDir.copy(dir).normalize();
    p.dashTimer = 0.22;
    p.invuln = 0.32;
    p.stamina -= 26;
    this.cooldowns.dash = 0.65;
    this.ring(p.pos.clone().setY(0.3), 2.2, '#dff3ff', 0.35);
    this.burst(p.pos.clone().setY(0.8), '#e9f8ff', 8, 4);
  }

  useAbility(key) {
    const ab = this.C.abilities.find(a => a.key === key);
    if (!ab || this.cooldowns[key] > 0 || this.player.mp < ab.cost || !this.alive) return;
    this.player.mp -= ab.cost;
    this.cooldowns[key] = ab.cd;
    this.player.attackAnim = 0.32;
    this.player.inCombat = 5;
    const target = this.nearestEnemy(36, 1.4);
    if (target && ['solar', 'shieldbreak', 'pierce'].includes(ab.type)) this.faceTowards(target.mesh.position);
    const p = this.player;
    const f = new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
    const dmgBase = (v) => this.scaledDamage(v);
    switch (ab.type) {
      case 'solar': {
        this.playSlash(p.pos.clone(), p.facing, 10, ab.color, 0.55, 2.2);
        this.damageInArc(9.5, 1.35, dmgBase(ab.damage), { knockback: 5, color: ab.color, crit: false });
        this.ring(p.pos.clone().setY(0.35), 8, ab.color, 0.5);
        this.burst(p.pos.clone().setY(1.2).add(f.clone().multiplyScalar(4)), ab.color, 26, 11);
        this.shake = 0.25;
        this.onEvent?.({ type: 'ability', name: ab.name, color: ab.color });
        break;
      }
      case 'shieldbreak': {
        p.dashDir.copy(f); p.dashTimer = 0.28; p.invuln = 0.4;
        this.playBeam(p.pos.clone().setY(1.2), p.pos.clone().setY(1.2).add(f.clone().multiplyScalar(16)), ab.color, 3.2, 0.3);
        this.damageInRectangle(p.pos.clone(), f, 18, 5.5, dmgBase(ab.damage), { stun: 1.4, knockback: 4, color: ab.color });
        this.ring(p.pos.clone().add(f.clone().multiplyScalar(7)).setY(0.3), 7, ab.color, 0.7);
        this.burst(p.pos.clone().add(f.clone().multiplyScalar(6)).setY(1.2), ab.color, 26, 11);
        this.shake = 0.35;
        this.onEvent?.({ type: 'ability', name: ab.name, color: ab.color });
        break;
      }
      case 'lionheart': {
        p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.35));
        p.buffs.power = 10;
        this.ring(p.pos.clone().setY(0.25), 6, ab.color, 1.2);
        this.aura(p.pos.clone(), ab.color, 1.4);
        this.burst(p.pos.clone().setY(1.6), ab.color, 36, 9);
        this.onEvent?.({ type: 'ability', name: ab.name, color: ab.color });
        break;
      }
      case 'volley': {
        const cands = this.enemies.filter(e => !e.dead && e.interior === this.insideDungeon && e.mesh.position.distanceTo(p.pos) < 36).sort((a, b) => a.mesh.position.distanceTo(p.pos) - b.mesh.position.distanceTo(p.pos)).slice(0, 3);
        const origin = p.pos.clone().setY(1.7).add(f.clone().multiplyScalar(1.1));
        for (let i = 0; i < 6; i++) {
          const tgt = cands.length ? cands[i % cands.length] : target;
          const aim = tgt && !tgt.dead ? tgt.mesh.position.clone().setY(1.3) : origin.clone().add(f.clone().multiplyScalar(32)).add(new THREE.Vector3(rand(-4, 4), rand(-1, 3), rand(-4, 4)));
          this.spawnProjectile({ origin: origin.clone().add(new THREE.Vector3(rand(-1, 1), rand(-0.5, 1), rand(-1, 1))), target: aim, targetEnemy: tgt, speed: 46, damage: dmgBase(ab.damage), color: ab.color, size: 0.2, homing: 0.1, kind: 'arrow' });
        }
        this.burst(origin, ab.color, 14, 5);
        this.onEvent?.({ type: 'ability', name: ab.name, color: ab.color });
        break;
      }
      case 'pierce': {
        const origin = p.pos.clone().setY(1.6);
        const end = origin.clone().add(f.clone().multiplyScalar(42));
        this.playBeam(origin, end, ab.color, 1.4, 0.4);
        this.damageInRectangle(p.pos.clone(), f, 42, 2.6, dmgBase(ab.damage), { slow: 3, color: ab.color });
        this.burst(origin.clone().add(f.clone().multiplyScalar(4)), ab.color, 18, 8);
        this.shake = 0.18;
        this.onEvent?.({ type: 'ability', name: ab.name, color: ab.color });
        break;
      }
      case 'windstep': {
        const from = p.pos.clone();
        const dir = this.moveDir();
        if (dir.lengthSq() < 0.1) dir.copy(f);
        dir.normalize();
        const dest = p.pos.clone().add(dir.multiplyScalar(14));
        p.pos.copy(this.clampToLand(dest));
        p.invuln = 0.5;
        p.buffs.invis = 3;
        p.buffs.speed = 5;
        this.trail(from, p.pos.clone(), ab.color);
        this.ring(p.pos.clone().setY(0.3), 4, ab.color, 0.6);
        this.burst(p.pos.clone().setY(1.2), ab.color, 20, 8);
        for (const e of this.enemies) if (!e.dead && e.mesh.position.distanceTo(p.pos) > 18) e.aggro = false;
        this.onEvent?.({ type: 'ability', name: ab.name, color: ab.color });
        break;
      }
      case 'arcanebolt': {
        const origin = p.pos.clone().setY(1.8).add(f.clone().multiplyScalar(1));
        for (let i = 0; i < 3; i++) {
          const aim = target ? target.mesh.position.clone().setY(1.3) : origin.clone().add(f.clone().multiplyScalar(30)).add(new THREE.Vector3(rand(-6, 6), rand(-2, 3), rand(-6, 6)));
          this.spawnProjectile({ origin: origin.clone().add(new THREE.Vector3((i - 1) * 0.8, 0, 0)), target: aim, targetEnemy: target, speed: 30, damage: dmgBase(ab.damage), color: ab.color, size: 0.34, homing: 0.42, kind: 'bolt' });
        }
        this.burst(origin, ab.color, 12, 4);
        this.onEvent?.({ type: 'ability', name: ab.name, color: ab.color });
        break;
      }
      case 'frostnova': {
        this.ring(p.pos.clone().setY(0.2), 10, ab.color, 0.8, true);
        this.ring(p.pos.clone().setY(0.5), 7.5, '#ffffff', 0.5, true);
        this.damageInRadius(p.pos.clone(), 10, dmgBase(ab.damage), { slow: 4, color: ab.color });
        this.burst(p.pos.clone().setY(1), ab.color, 34, 10);
        this.shake = 0.28;
        this.onEvent?.({ type: 'ability', name: ab.name, color: ab.color });
        break;
      }
      case 'timewarp': {
        this.dome(p.pos.clone(), 15, ab.color, 1.6);
        this.ring(p.pos.clone().setY(0.2), 15, ab.color, 1.6, true);
        for (const e of this.enemies) {
          if (e.dead || e.interior !== this.insideDungeon) continue;
          if (e.mesh.position.distanceTo(p.pos) < 17) { e.slow = 6; e.stun = 0.2; }
        }
        p.buffs.timewarp = 6;
        this.onEvent?.({ type: 'ability', name: ab.name, color: ab.color });
        break;
      }
    }
  }

  moveDir() {
    const d = new THREE.Vector3();
    const f = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const r = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    if (this.keys['w'] || this.keys['arrowup']) d.add(f);
    if (this.keys['s'] || this.keys['arrowdown']) d.sub(f);
    if (this.keys['d'] || this.keys['arrowright']) d.add(r);
    if (this.keys['a'] || this.keys['arrowleft']) d.sub(r);
    if (d.lengthSq() > 0) d.normalize();
    return d;
  }

  useHealthPotion() {
    if (this.potions <= 0 || this.player.hp >= this.player.maxHp) return;
    this.potions--;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.45));
    this.burst(this.player.pos.clone().setY(1.4), '#ff9a8a', 16, 4);
    this.onEvent?.({ type: 'toast', title: 'HEALING DRAUGHT', sub: 'Restored 45% health', tone: 'health' });
    this.pushHud();
  }

  useManaPotion() {
    if (this.manaPotions <= 0 || this.player.mp >= this.player.maxMp) return;
    this.manaPotions--;
    this.player.mp = Math.min(this.player.maxMp, this.player.mp + Math.round(this.player.maxMp * 0.5));
    this.burst(this.player.pos.clone().setY(1.4), '#9ad4ff', 16, 4);
    this.onEvent?.({ type: 'toast', title: 'AZURE TONIC', sub: 'Restored 50% mana', tone: 'mana' });
    this.pushHud();
  }

  buy(item) {
    const prices = { health: 45, mana: 40 };
    const price = prices[item];
    if (!price || this.gold < price) return false;
    this.gold -= price;
    if (item === 'health') this.potions++; else this.manaPotions++;
    this.onEvent?.({ type: 'toast', title: 'PURCHASE COMPLETE', sub: item === 'health' ? 'Healing Draught added' : 'Azure Tonic added', tone: 'gold' });
    this.pushHud();
    return true;
  }

  travelTo(poi) {
    if (this.insideDungeon) this.exitDungeon(false);
    if (poi.kind === 'city') this.player.pos.set(0, 0, 10);
    else if (poi.kind === 'village') this.player.pos.set(poi.x + 12, 0, poi.z + 22);
    else if (poi.kind === 'dungeon') {
      const p = this.world.portals.find(p => p.id === poi.id);
      if (p) this.player.pos.set(p.pos.x + 2, 0, p.pos.z + 8);
    }
    this.camYaw = 0;
    this.onEvent?.({ type: 'toast', title: 'WAYFARER’S BLESSING', sub: `Arrived at ${poi.name}`, tone: 'mana' });
    this.pushHud();
  }

  // ---------------- world interactions ----------------
  interact() {
    if (this.blocked || !this.alive) return;
    if (this.insideDungeon) {
      const exit = this.world.dungeonInteriors[this.insideDungeon].exitPos;
      if (this.player.pos.distanceTo(exit) < 7) { this.exitDungeon(true); return; }
      return;
    }
    const npc = this.world.npcs.find(n => Math.hypot(n.data.x - this.player.pos.x, n.data.z - this.player.pos.z) < 5.2);
    if (npc) {
      if (npc.data.kind === 'shop') {
        this.blocked = true;
        this.onEvent?.({ type: 'shop', npc: npc.data });
      } else {
        this.blocked = true;
        this.onEvent?.({ type: 'dialogue', npc: npc.data });
      }
      return;
    }
    const portal = this.world.portals.find(p => p.pos.distanceTo(this.player.pos) < 8.5);
    if (portal) {
      portal.discovered = true;
      this.blocked = true;
      this.onEvent?.({ type: 'portal', portal: { id: portal.id, name: portal.dungeon.name, rank: portal.dungeon.rank, desc: portal.dungeon.desc, cleared: this.cleared.has(portal.id) } });
    }
  }

  enterDungeon(id) {
    if (this.insideDungeon) return;
    const d = DUNGEONS[id];
    this.player.returnPos.copy(this.player.pos);
    this.insideDungeon = id;
    this.world.overworld.visible = false;
    this.sky.visible = false;
    this.sunSprite.visible = false;
    for (const [kid, interior] of Object.entries(this.world.dungeonInteriors)) interior.group.visible = kid === id;
    this.player.pos.copy(this.world.dungeonInteriors[id].spawnPos);
    this.player.facing = Math.PI;
    this.camYaw = 0;
    this.player.buffs.invis = 0;
    this.boss = this.spawnDungeon(id);
    this.atmo.bg.set('#0a0b12'); this.atmo.fog.set('#0d0f18');
    this.atmo.fogNear = 12; this.atmo.fogFar = 78; this.atmo.sun = 0.24; this.atmo.hemi = 0.52;
    this.onEvent?.({ type: 'toast', title: d.name.toUpperCase(), sub: `Rank ${d.rank} · ${d.boss} awaits`, tone: 'danger' });
    this.pushHud();
  }

  exitDungeon(voluntary = true) {
    if (!this.insideDungeon) return;
    const id = this.insideDungeon;
    for (const e of this.enemies) {
      if (e.interior === id && !e.dead) {
        this.scene.remove(e.mesh);
        e.dead = true;
        e.gone = true;
      }
    }
    this.enemies = this.enemies.filter(e => !e.gone);
    this.boss = null;
    this.world.overworld.visible = true;
    this.sky.visible = true;
    this.sunSprite.visible = true;
    for (const interior of Object.values(this.world.dungeonInteriors)) interior.group.visible = false;
    this.insideDungeon = null;
    this.player.pos.copy(this.player.returnPos);
    this.atmo.sun = 2.4; this.atmo.hemi = 1.5;
    if (voluntary) this.onEvent?.({ type: 'toast', title: 'RETURNED TO THE SURFACE', sub: 'The wilds remember you', tone: 'mana' });
    this.pushHud();
  }

  completeDungeon(bossId) {
    const d = Object.values(DUNGEONS).find(d => d.id === this.insideDungeon);
    if (!d) return;
    if (!this.cleared.has(d.id)) {
      this.cleared.add(d.id);
      this.gold += d.reward.gold;
      this.gainXp(d.reward.xp);
      this.relics.push(d.reward.item);
      this.progressQuests('dungeon', d.id);
      if (d.id === 'spire' || d.id === 'sanctum') this.progressQuests('dungeonAny', 'monster');
      this.onEvent?.({ type: 'clear', name: d.name, rank: d.rank, reward: d.reward, boss: d.boss });
      this.ring(this.player.pos.clone().setY(0.2), 16, '#ffd98a', 2);
      this.burst(this.player.pos.clone().setY(2), '#ffe6a4', 60, 16);
      this.pushHud();
    }
  }

  progressQuests(type, target) {
    for (const q of this.quests) {
      if (q.done || q.type !== type) continue;
      if (type === 'kill' && q.target !== target) continue;
      if (type === 'dungeon' && q.target !== target) continue;
      q.progress = Math.min(q.count, q.progress + 1);
      if (q.progress >= q.count) {
        q.done = true;
        this.gold += q.gold;
        this.gainXp(q.xp);
        if (q.item) this.relics.push(q.item);
        this.onEvent?.({ type: 'toast', title: 'QUEST COMPLETE', sub: `${q.title} · +${q.gold}g`, tone: 'gold' });
      }
    }
    this.pushHud();
  }

  respawn() {
    if (this.insideDungeon) this.exitDungeon(false);
    this.alive = true;
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this.player.stamina = this.player.maxStamina;
    this.player.pos.set(0, 0, 24);
    this.player.returnPos.copy(this.player.pos);
    this.player.mesh.rotation.z = 0;
    this.player.buffs.power = 0; this.player.buffs.speed = 0; this.player.buffs.invis = 0;
    this.player.invuln = 2;
    this.camYaw = 0;
    this.blocked = false;
    this.onEvent?.({ type: 'respawn' });
    this.pushHud();
  }

  // ---------------- effects ----------------
  addEffect(group, life, update) {
    this.scene.add(group);
    this.effects.push({ group, life, max: life, update, t: 0 });
  }

  ring(pos, radius, color, life = 0.6, isAoe = false) {
    const geo = new THREE.RingGeometry(radius * 0.55, radius, 48);
    const mat = basic(color, { transparent: true, opacity: 0.42, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    this.addEffect(m, life, (obj, k) => { obj.scale.setScalar(0.35 + k * 0.9); obj.material.opacity = 0.42 * (1 - k); });
  }

  playSlash(pos, facing, radius, color, life = 0.3, arc = 1.2) {
    const geo = new THREE.RingGeometry(radius * 0.55, radius, 32, 1, facing - Math.PI / 2 - arc / 2, arc);
    const mat = basic(color, { transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos).setY(1.2);
    this.addEffect(m, life, (obj, k) => {
      obj.material.opacity = 0.9 * (1 - k);
      obj.rotation.z = Math.sin(k * Math.PI) * 0.15;
      obj.scale.setScalar(0.75 + k * 0.35);
    });
    // core
    const geo2 = new THREE.RingGeometry(radius * 0.45, radius * 0.72, 32, 1, facing - Math.PI / 2 - arc * 0.35, arc * 0.7);
    const m2 = new THREE.Mesh(geo2, basic('#ffffff', { transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m2.rotation.x = -Math.PI / 2; m2.position.copy(pos).setY(1.25);
    this.addEffect(m2, life, (obj, k) => { obj.material.opacity = 0.8 * (1 - k); });
  }

  playBeam(a, b, color, width = 1, life = 0.35) {
    const dist = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(width, width * 0.4, dist, 8, 1, true);
    geo.translate(0, dist / 2, 0);
    const m = new THREE.Mesh(geo, basic(color, { transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.addEffect(m, life, (obj, k) => { obj.material.opacity = 0.75 * (1 - k); obj.scale.x = obj.scale.z = 1 - k * 0.5; });
  }

  trail(a, b, color) {
    for (let i = 0; i < 6; i++) {
      const p = a.clone().lerp(b, i / 5).setY(1.2);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), basic(color, { transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.position.copy(p);
      this.addEffect(mesh, 0.5, (obj, k) => { obj.material.opacity = 0.5 * (1 - k); obj.scale.setScalar(1 + k * 1.5); });
    }
  }

  dome(pos, radius, color, life) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), basic(color, { transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos).setY(0.1);
    m.scale.y = 0.35;
    this.addEffect(m, life, (obj, k) => { obj.material.opacity = 0.16 * (1 - k); obj.scale.setScalar(1 + k * 0.15); });
  }

  aura(pos, color, life) {
    const g = new THREE.Group();
    const ring1 = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 32), basic(color, { transparent: true, opacity: 0.3, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring1.rotation.x = -Math.PI / 2; ring1.position.y = 0.2; g.add(ring1);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 5, 16, 1, true), basic(color, { transparent: true, opacity: 0.09, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    col.position.y = 2.7; g.add(col);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(3.4, 3.4, 1); s.position.y = 1.2; g.add(s);
    g.position.copy(pos);
    this.addEffect(g, life, (obj, k) => { obj.rotation.y += 0.04; obj.children[1].material.opacity = 0.09 * (1 - k); obj.children[2].material.opacity = 0.5 * (1 - k); obj.scale.setScalar(1 + k * 0.18); });
  }

  burst(pos, color, count = 10, speed = 5) {
    const g = new THREE.BufferGeometry();
    const n = count;
    const positions = new Float32Array(n * 3);
    const vel = [];
    for (let i = 0; i < n; i++) {
      positions[i * 3] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0;
      vel.push(new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(1, speed)));
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.5, map: this.glowTex, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(g, mat);
    pts.position.copy(pos);
    this.addEffect(pts, 0.7, (obj, k) => {
      obj.material.opacity = 1 - k;
      const arr = obj.geometry.attributes.position.array;
      for (let i = 0; i < n; i++) {
        arr[i * 3] += vel[i].x * 0.035; arr[i * 3 + 1] += vel[i].y * 0.035; arr[i * 3 + 2] += vel[i].z * 0.035;
      }
      obj.geometry.attributes.position.needsUpdate = true;
    });
  }

  spawnProjectile(o) {
    const color = o.color ?? '#ffffff';
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(o.size ?? 0.25, 10, 8), basic(color, { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(core);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    spr.scale.setScalar((o.size ?? 0.25) * 9);
    g.add(spr);
    if (o.kind === 'arrow') {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.4, 5), basic('#f4f0d8'));
      shaft.rotation.x = Math.PI / 2; g.add(shaft);
    }
    g.position.copy(o.origin);
    this.scene.add(g);
    const dir = o.target ? o.target.clone().sub(o.origin).normalize() : new THREE.Vector3(0, 0, -1);
    this.projectiles.push({
      mesh: g, pos: g.position, vel: dir.multiplyScalar(o.speed), speed: o.speed,
      damage: o.damage, color, targetEnemy: o.targetEnemy ?? null, homing: o.homing ?? 0,
      player: o.from !== 'enemy', life: 2.5, size: o.size ?? 0.25, pierce: o.pierce ?? false, hit: new Set(),
      start: o.origin.clone()
    });
    if (o.kind === 'arrow') g.lookAt(o.target ? o.target.clone() : o.origin.clone().add(dir));
  }

  enemyShoot(e) {
    const from = e.mesh.position.clone().add(new THREE.Vector3(0, e.boss ? 3.4 : 1.8, 0));
    const aim = this.player.pos.clone().setY(1.2);
    const g = new THREE.Group();
    const color = e.type === 'wraith' ? '#c09aff' : '#ffb07a';
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), basic(color, { transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    spr.scale.set(4, 4, 1); g.add(spr);
    g.position.copy(from);
    this.scene.add(g);
    this.projectiles.push({
      mesh: g, pos: g.position, vel: aim.sub(from).normalize().multiplyScalar(17), speed: 17,
      damage: e.dmg, color, player: false, life: 4, size: 0.42, homing: 0, pierce: false, hit: new Set(), start: from.clone()
    });
  }

  damageInArc(range, halfArc, dmg, opts) {
    for (const e of this.enemies) {
      if (e.dead || e.interior !== this.insideDungeon) continue;
      const d = e.mesh.position.distanceTo(this.player.pos);
      if (d > range + e.radius) continue;
      const dir = e.mesh.position.clone().sub(this.player.pos).normalize();
      const f = new THREE.Vector3(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
      if (Math.acos(clamp(dir.dot(f), -1, 1)) > halfArc) continue;
      this.dealDamage(e, dmg, opts);
    }
  }

  damageInRectangle(origin, f, length, width, dmg, opts) {
    for (const e of this.enemies) {
      if (e.dead || e.interior !== this.insideDungeon) continue;
      const rel = e.mesh.position.clone().sub(origin).setY(0);
      const along = rel.dot(f);
      if (along < -1 || along > length) continue;
      const perp = rel.clone().addScaledVector(f, -along).length();
      if (perp > width + e.radius) continue;
      this.dealDamage(e, dmg, opts);
    }
  }

  damageInRadius(pos, radius, dmg, opts) {
    for (const e of this.enemies) {
      if (e.dead || e.interior !== this.insideDungeon) continue;
      if (e.mesh.position.distanceTo(pos) <= radius + e.radius) this.dealDamage(e, dmg, opts);
    }
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (p.invuln > 0 || !this.alive) return;
    p.hp -= dmg;
    p.invuln = 0.35;
    this.shake = 0.32;
    this.hitFlash = 1;
    p.inCombat = 6;
    this.onEvent?.({ type: 'hurt' });
    if (p.hp <= 0) {
      p.hp = 0;
      this.alive = false;
      this.blocked = true;
      this.player.mesh.rotation.z = Math.PI / 2.2;
      this.onEvent?.({ type: 'death' });
    }
    this.pushHud();
  }

  // ---------------- collisions & zones ----------------
  clampToLand(pos) {
    pos.x = clamp(pos.x, -1300, 1300);
    pos.z = clamp(pos.z, -1900, 1000);
    for (const c of this.world.colliders) {
      if (c.type === 'box') {
        const r = 0.7;
        if (pos.x > c.minX - r && pos.x < c.maxX + r && pos.z > c.minZ - r && pos.z < c.maxZ + r) {
          const dl = pos.x - (c.minX - r), dr = (c.maxX + r) - pos.x;
          const dt = pos.z - (c.minZ - r), db = (c.maxZ + r) - pos.z;
          const m = Math.min(dl, dr, dt, db);
          if (m === dl) pos.x = c.minX - r;
          else if (m === dr) pos.x = c.maxX + r;
          else if (m === dt) pos.z = c.minZ - r;
          else pos.z = c.maxZ + r;
        }
      } else {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d = Math.hypot(dx, dz);
        if (d < c.r + 0.7 && d > 0.001) {
          pos.x = c.x + dx / d * (c.r + 0.7);
          pos.z = c.z + dz / d * (c.r + 0.7);
        }
      }
    }
    return pos;
  }

  getZone() {
    if (this.insideDungeon) {
      const d = DUNGEONS[this.insideDungeon];
      return { id: 'dungeon', name: d.name, sub: `Rank ${d.rank} Dungeon`, rank: d.rank, depth: 1 };
    }
    const { x, z } = this.player.pos;
    if (Math.abs(x) < 300 && Math.abs(z) < 300) return { id: 'capital', name: 'Royal Capital', sub: 'Valley District · 600 × 600 m', rank: null };
    for (const v of VILLAGES) if (Math.hypot(v.x - x, v.z - z) < 95) return { id: 'village', name: v.name, sub: 'Outlying Village', rank: null, village: v };
    const b = this.world.spawnZones.beginner;
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) {
      const depth = clamp((b.z1 - 20 - z) / (b.z1 - b.z0 - 40), 0, 1);
      return { id: 'beginner', name: 'Beginner’s Forest', sub: `Depth ${Math.round(depth * 100)}% · Rank scaling`, rank: RANKS[clamp(Math.floor(depth * 7), 0, 6)], depth };
    }
    const m = this.world.spawnZones.monster;
    if (x > m.x0 && x < m.x1 && z > m.z0 && z < m.z1) {
      const depth = clamp((m.z1 - 20 - z) / (m.z1 - m.z0 - 40), 0, 1);
      return { id: 'monster', name: 'Monster Forest', sub: `Depth ${Math.round(depth * 100)}% · Rank scaling`, rank: RANKS[clamp(4 + Math.floor(depth * 4), 4, 7)], depth };
    }
    return { id: 'wilds', name: 'Elyndor Wilds', sub: 'Open Country', rank: null };
  }

  // ---------------- update ----------------
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const realDt = Math.min((now - this.last) / 1000, 0.25);
    const dt = Math.min(realDt, 1 / 20);
    this.last = now;
    this.time += dt;
    this.update(dt, realDt);
    this.renderer.render(this.scene, this.camera);
  }

  // headless-friendly fixed-step simulation (used by automated checks)
  simulate(seconds) {
    const step = 1 / 60;
    const frames = Math.min(2400, Math.ceil(seconds / step));
    for (let i = 0; i < frames; i++) {
      this.time += step;
      this.update(step, step);
    }
    this.pushHud();
  }

  update(dt, rdt = dt) {
    const p = this.player;
    const active = this.alive && !this.blocked;
    this.world.update(dt, this.time);
    for (const key of ['q', 'e', 'r', 'dash']) this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);

    // movement
    p.moving = false;
    p.sprinting = false;
    if (active) {
      const dir = this.moveDir();
      const wantSprint = (this.keys['shift'] || this.keys['shiftleft'] || this.keys['shiftright']) && dir.lengthSq() > 0;
      let speed = p.speed;
      if (wantSprint && p.stamina > 1) { speed *= 1.55; p.sprinting = true; p.stamina = Math.max(0, p.stamina - dt * 22); }
      else p.stamina = Math.min(p.maxStamina, p.stamina + dt * 19);
      if (p.buffs.speed > 0) speed *= 1.4;
      if (p.dashTimer > 0) {
        p.dashTimer -= dt;
        const step = p.dashDir.clone().multiplyScalar(30 * dt);
        p.pos.add(step);
        p.moving = true;
        p.facing = Math.atan2(p.dashDir.x, p.dashDir.z);
      } else if (dir.lengthSq() > 0.01) {
        p.pos.add(dir.clone().multiplyScalar(speed * dt));
        p.moving = true;
        p.facing = Math.atan2(dir.x, dir.z);
        p.vel.copy(dir);
      }
      this.clampToLand(p.pos);
      p.pos.y = 0;
      if (p.inCombat <= 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + dt * 4);
      p.inCombat = Math.max(0, p.inCombat - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      for (const k of Object.keys(p.buffs)) p.buffs[k] = Math.max(0, p.buffs[k] - dt);
      if (p.buffs.timewarp > 0) p.mp = Math.min(p.maxMp, p.mp + dt * 7);
      p.mp = Math.min(p.maxMp, p.mp + dt * 6);
      if (p.attackTimer > 0) p.attackTimer -= dt;
      if (p.attackAnim > 0) p.attackAnim -= dt;
    }

    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.facing;
    this.animatePlayer(dt, active);

    // loot
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i];
      l.t += dt;
      l.mesh.rotation.y += dt * 1.8;
      l.mesh.position.y = Math.sin(l.t * 3) * 0.15;
      if (active && l.mesh.position.distanceTo(p.pos) < 2.6) {
        if (l.kind === 'health') this.potions++;
        else this.manaPotions++;
        this.onEvent?.({ type: 'toast', title: l.kind === 'health' ? 'HEALING DRAUGHT FOUND' : 'AZURE TONIC FOUND', sub: 'Added to your satchel', tone: l.kind === 'health' ? 'health' : 'mana' });
        this.scene.remove(l.mesh);
        this.loot.splice(i, 1);
        this.pushHud();
      }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.player && pr.targetEnemy && !pr.targetEnemy.dead && pr.homing > 0) {
        const tgt = pr.targetEnemy.pos ?? pr.targetEnemy.mesh.position.clone().setY(1.2);
        const desired = tgt.clone().add(new THREE.Vector3(0, 1.3, 0)).sub(pr.pos).normalize().multiplyScalar(pr.speed);
        pr.vel.lerp(desired, pr.homing);
      }
      pr.pos.addScaledVector(pr.vel, dt);
      if (pr.life <= 0) { this.scene.remove(pr.mesh); this.projectiles.splice(i, 1); continue; }
      if (pr.player) {
        let hit = false;
        for (const e of this.enemies) {
          if (e.dead || e.interior !== this.insideDungeon || pr.hit.has(e)) continue;
          if (e.mesh.position.distanceTo(pr.pos) < e.radius + 0.85) {
            pr.hit.add(e);
            this.dealDamage(e, pr.damage, { color: pr.color });
            this.burst(pr.pos.clone(), pr.color, 8, 4);
            hit = true;
            if (!pr.pierce) break;
          }
        }
        if (hit && !pr.pierce) { this.scene.remove(pr.mesh); this.projectiles.splice(i, 1); continue; }
      } else {
        if (pr.pos.distanceTo(p.pos.clone().setY(1.2)) < 1.5) {
          this.hurtPlayer(pr.damage);
          this.burst(pr.pos.clone(), pr.color, 10, 5);
          this.scene.remove(pr.mesh); this.projectiles.splice(i, 1); continue;
        }
      }
      if (pr.pos.distanceTo(pr.start) > 60 || (this.insideDungeon && pr.pos.length() > 40)) {
        this.scene.remove(pr.mesh); this.projectiles.splice(i, 1);
      }
    }

    // effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.t += dt;
      const k = clamp(fx.t / fx.life, 0, 1);
      fx.update?.(fx.group, k);
      if (fx.t >= fx.life) { this.scene.remove(fx.group); this.effects.splice(i, 1); }
    }

    this.updateEnemies(dt, active);
    this.updatePrompt();
    this.updateAtmosphere(rdt);
    this.updateCamera(rdt);
    this.updateBoss();

    // HUD
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.hudTimer = 0.1; this.pushHud(); }

    // sun follows player
    this.sun.position.set(p.pos.x + 60, 92, p.pos.z + 52);
    this.sun.target.position.set(p.pos.x, 0, p.pos.z);
    this.sky.position.copy(this.camera.position);
    this.sunSprite.position.set(p.pos.x + 1100, 640, p.pos.z + 1000);
  }

  animatePlayer(dt, active) {
    const a = this.player.mesh.userData.anim;
    if (!a) return;
    const moving = this.player.moving && this.player.dashTimer <= 0;
    const t = this.time;
    a.phase += dt * (moving ? 11 : 2);
    const swing = moving ? Math.sin(a.phase) * 0.75 : Math.sin(a.phase * 0.9) * 0.06;
    a.legL.rotation.x = swing;
    a.legR.rotation.x = -swing;
    a.armL.rotation.x = -swing * 0.7 + (this.player.attackAnim > 0 ? -0.6 : 0);
    a.armR.rotation.x = swing * 0.5;
    if (this.player.attackAnim > 0) {
      const k = 1 - this.player.attackAnim / 0.3;
      a.armR.rotation.x = -1.9 + k * 2.2;
      a.torso.rotation.y = -0.25 + k * 0.5;
    } else {
      a.armR.rotation.x = -swing * 0.35;
      a.torso.rotation.y *= 0.85;
    }
    a.rig.position.y = moving ? Math.abs(Math.sin(a.phase)) * 0.08 : Math.sin(t * 1.8) * 0.03;
    a.head.rotation.y = Math.sin(t * 0.7) * 0.1;
    if (a.cape) a.cape.rotation.x = 0.1 - (moving ? 0.22 : 0) + Math.sin(t * 2.4) * 0.03;
    if (this.player.mesh.rotation.z !== 0 && this.alive) this.player.mesh.rotation.z = 0;
  }

  updateEnemies(dt, active) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) {
        if (e.deathT > 0) {
          e.deathT += dt;
          const k = clamp(1 - e.deathT / 0.7, 0, 1);
          e.mesh.scale.setScalar(Math.max(0.001, k) * (e.baseScale ?? 1));
          e.mesh.position.y = (1 - k) * 0.5;
          if (e.deathT > 0.7 && !e.removed) { e.removed = true; e.mesh.visible = false; }
        }
        continue;
      }
      const inZone = e.interior === this.insideDungeon;
      const dist = e.mesh.position.distanceTo(p.pos);
      e.mesh.visible = inZone && (dist < 200 || e.boss);
      if (!inZone) continue;
      if (e.flash > 0) {
        e.flash -= dt;
        const s = 1 + Math.max(0, e.flash) * 0.4;
        e.mesh.scale.setScalar((e.baseScale ?? 1) * s);
      } else {
        e.mesh.scale.setScalar(e.baseScale ?? 1);
      }
      const a = e.mesh.userData.anim;
      if (a) {
        if (a.kind === 'float') { e.mesh.position.y = 0.65 + Math.sin(this.time * 2 + a.phase) * 0.15; a.arms?.forEach((arm, i) => arm.rotation.x = Math.sin(this.time * 1.5 + i) * 0.12); }
        else if (a.kind === 'quad') {
          a.legs.forEach((leg, i) => leg.rotation.x = Math.sin(this.time * (e.aggro ? 10 : 3) + a.phase + i) * (e.aggro ? 0.55 : 0.12));
          if (a.tail) a.tail.rotation.z = Math.sin(this.time * 2 + a.phase) * 0.15;
          if (e.aggro) e.mesh.rotation.y += dt * 0.4;
        } else {
          const moving = e.aggro;
          a.legs.forEach((leg, i) => leg.rotation.x = Math.sin(this.time * (moving ? 8 : 2) + a.phase + i * Math.PI) * (moving ? 0.55 : 0.08));
          a.arms?.forEach((arm, i) => arm.rotation.x = Math.sin(this.time * (moving ? 8 : 2) + a.phase + i * Math.PI) * (moving ? 0.3 : 0.05) - (e.attackCd > 0.8 ? 0.6 : 0));
        }
        if (inZone && dist < 110 && !e.dead) {
          const toP = p.pos.clone().sub(e.mesh.position);
          if (toP.lengthSq() > 0.001) e.mesh.rotation.y = Math.atan2(toP.x, toP.z);
        }
      }
      if (!active) continue;
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.specialCd = Math.max(0, e.specialCd - dt);
      const speedMult = e.slow > 0 ? 0.35 : 1;
      const aggroRange = e.boss ? 34 : (e.zone?.aggro ?? 24);
      if (p.buffs.invis > 0 && !e.boss) e.aggro = false;
      if (!e.aggro && dist < aggroRange && !(p.buffs.invis > 0)) e.aggro = true;
      if (e.aggro && dist > (e.boss ? 80 : 55)) e.aggro = false;

      if (e.stun <= 0 && e.aggro) {
        if (e.ranged && dist > 9 && dist < 30) {
          // strafe / keep distance
          const dir = p.pos.clone().sub(e.mesh.position).setY(0).normalize();
          e.mesh.position.addScaledVector(dir, -dt * 1.6 * speedMult);
          if (e.attackCd <= 0) { this.enemyShoot(e); e.attackCd = e.slow > 0 ? 3.6 : 2.4; }
        } else if (dist > (e.boss ? 4.6 : 2.6) + e.radius * 0.5) {
          const dir = p.pos.clone().sub(e.mesh.position).setY(0).normalize();
          e.mesh.position.addScaledVector(dir, dt * e.speed * speedMult);
          if (e.slow > 0) {
            if (Math.random() < dt * 3) this.burst(e.mesh.position.clone().setY(1), '#a8e6ff', 2, 1.5);
          }
        } else if (e.attackCd <= 0) {
          e.attackCd = e.boss ? 1.25 : 1.5;
          this.hurtPlayer(e.dmg * (e.boss ? 1 : 0.85));
          this.ring(e.mesh.position.clone().setY(0.3), 2.4, '#ff9f7a', 0.3);
          this.burst(p.pos.clone().setY(1.3), '#ff8f78', 6, 3);
        }
        if (e.boss && e.specialCd <= 0) {
          e.specialCd = 6;
          if (dist < 18) {
            this.ring(e.mesh.position.clone().setY(0.2), 12, '#ffb066', 0.8, true);
            this.shake = 0.5;
            if (dist < 10) this.hurtPlayer(e.dmg * 0.9);
            this.burst(e.mesh.position.clone().setY(0.5), '#ffb066', 30, 10);
          }
        }
      } else if (!e.aggro) {
        e.wanderT -= dt;
        if (e.wanderT <= 0) {
          e.wanderT = rand(3, 7);
          e.wanderA = Math.random() * Math.PI * 2;
          e.wander.set(e.home.x + Math.cos(e.wanderA) * rand(2, 9), 0, e.home.z + Math.sin(e.wanderA) * rand(2, 9));
        }
        if (e.mesh.position.distanceTo(e.wander) > 0.6) {
          const dir = e.wander.clone().sub(e.mesh.position).setY(0).normalize();
          e.mesh.position.addScaledVector(dir, dt * e.speed * 0.22 * speedMult);
          e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
      }
      if (e.boss) e.hp = Math.max(0, e.hp);
    }
    // target info
    const t = this.nearestEnemy(34);
    this.targetEnemy = t;
  }

  updateBoss() {
    if (!this.boss || this.boss.dead) { this.bossInfo = this.boss && !this.boss.dead ? this.boss : null; return; }
    this.bossInfo = this.boss;
  }

  updatePrompt() {
    if (!this.alive || this.blocked) { this.prompt = null; return; }
    if (this.insideDungeon) {
      const exit = this.world.dungeonInteriors[this.insideDungeon].exitPos;
      this.prompt = this.player.pos.distanceTo(exit) < 7 ? { kind: 'exit', label: 'Return to the surface', key: 'F' } : null;
      return;
    }
    let best = null, bestD = 1e9;
    for (const n of this.world.npcs) {
      const d = Math.hypot(n.data.x - this.player.pos.x, n.data.z - this.player.pos.z);
      if (d < 5.2 && d < bestD) { best = { kind: n.data.kind === 'shop' ? 'shop' : 'npc', label: n.data.name, role: n.data.role, key: 'F' }; bestD = d; }
    }
    for (const p of this.world.portals) {
      const d = p.pos.distanceTo(this.player.pos);
      if (d < 8.5 && d < bestD) { best = { kind: 'portal', label: p.dungeon.name, role: `Rank ${p.dungeon.rank} Dungeon`, key: 'F', id: p.id }; bestD = d; }
    }
    this.prompt = best;
  }

  updateCamera(dt) {
    const p = this.player;
    const tx = p.pos.x, tz = p.pos.z;
    const dist = this.insideDungeon ? Math.min(this.camDist, 8.6) : this.camDist;
    const horiz = Math.cos(this.camPitch) * dist;
    const desired = new THREE.Vector3(
      tx + Math.sin(this.camYaw) * horiz,
      p.pos.y + 2.8 + Math.sin(this.camPitch) * dist,
      tz + Math.cos(this.camYaw) * horiz
    );
    if (this.insideDungeon) {
      // keep the camera inside the circular chamber, away from walls and the exit gate
      const flat = new THREE.Vector2(desired.x, desired.z);
      if (flat.length() > 21) {
        flat.setLength(21);
        desired.x = flat.x; desired.z = flat.y;
      }
      desired.z = Math.min(desired.z, 19.5);
      desired.y = Math.max(3.4, desired.y);
    }
    const k = 1 - Math.pow(0.001, dt);
    if (!this.camPos.lengthSq()) this.camPos.copy(desired);
    this.camPos.lerp(desired, Math.min(1, dt * 7));
    this.camLook.lerp(new THREE.Vector3(tx, p.pos.y + 2.55, tz), Math.min(1, dt * 9));
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sh = this.shake * 0.6;
    this.camera.position.copy(this.camPos).add(new THREE.Vector3(rand(-sh, sh), rand(-sh, sh), rand(-sh, sh)));
    this.camera.lookAt(this.camLook);
  }

  updateAtmosphere(dt) {
    const zone = this.getZone();
    this.currentZone = zone;
    let t;
    if (this.insideDungeon) t = { bg: '#0a0b12', fog: '#0d0f18', near: 12, far: 78, sun: 0.24, hemi: 0.52 };
    else if (zone.id === 'monster') t = { bg: '#7b8397', fog: '#8c94a0', near: 70, far: 760, sun: 1.45, hemi: 0.92 };
    else if (zone.id === 'beginner') t = { bg: '#94b890', fog: '#a3bd97', near: 80, far: 900, sun: 1.9, hemi: 1.05 };
    else if (zone.id === 'village') t = { bg: '#a2cfdf', fog: '#bcd8da', near: 260, far: 2100, sun: 2.15, hemi: 1.12 };
    else if (zone.id === 'capital') t = { bg: '#9fcadd', fog: '#bdd9dd', near: 320, far: 2400, sun: 2.2, hemi: 1.14 };
    else t = { bg: '#aad3e0', fog: '#c2dad8', near: 280, far: 2300, sun: 2.2, hemi: 1.12 };
    const lerpK = Math.min(1, dt * 1.2);
    this.scene.background.lerp(new THREE.Color(t.bg), lerpK);
    this.scene.fog.color.lerp(new THREE.Color(t.fog), lerpK);
    this.scene.fog.near = lerp(this.scene.fog.near, t.near, lerpK);
    this.scene.fog.far = lerp(this.scene.fog.far, t.far, lerpK);
    this.sun.intensity = lerp(this.sun.intensity, t.sun, lerpK);
    this.hemi.intensity = lerp(this.hemi.intensity, t.hemi, lerpK);
  }

  pushHud() {
    const p = this.player;
    const zone = this.currentZone ?? this.getZone();
    const quests = this.quests.map(q => ({ id: q.id, title: q.title, desc: q.desc, progress: q.progress, count: q.count, done: q.done, xp: q.xp, gold: q.gold, item: q.item }));
    const cds = {};
    for (const ab of this.C.abilities) {
      cds[ab.key] = { left: this.cooldowns[ab.key], ratio: this.cooldowns[ab.key] / ab.cd, cd: ab.cd };
    }
    this.onState?.({
      hp: Math.max(0, Math.round(p.hp)), maxHp: p.maxHp,
      mp: Math.round(p.mp), maxMp: p.maxMp,
      stamina: Math.round(p.stamina), maxStamina: p.maxStamina,
      level: this.level, xp: this.xp, xpNext: this.xpNext,
      gold: this.gold, potions: this.potions, manaPotions: this.manaPotions,
      cooldowns: cds, dashCd: this.cooldowns.dash,
      zone: { name: zone.name, sub: zone.sub, rank: zone.rank },
      insideDungeon: this.insideDungeon,
      quests,
      prompt: this.prompt,
      boss: this.bossInfo && !this.bossInfo.dead ? { name: this.bossInfo.name, hp: Math.max(0, Math.round(this.bossInfo.hp)), maxHp: this.bossInfo.maxHp, rank: this.bossInfo.rank } : null,
      target: this.targetEnemy && !this.targetEnemy.dead ? { name: this.targetEnemy.name, hp: Math.max(0, Math.round(this.targetEnemy.hp)), maxHp: this.targetEnemy.maxHp, rank: this.targetEnemy.rank, elite: this.targetEnemy.elite } : null,
      buffs: { power: p.buffs.power, invis: p.buffs.invis, speed: p.buffs.speed, timewarp: p.buffs.timewarp },
      relics: this.relics,
      alive: this.alive,
      cleared: [...this.cleared],
      classId: this.classId,
      inCombat: p.inCombat > 0,
      playerX: p.pos.x, playerZ: p.pos.z, facing: p.facing
    });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
    window.removeEventListener('blur', this._blur);
    window.removeEventListener('pointermove', this._pm);
    window.removeEventListener('pointerup', this._pu);
    window.removeEventListener('resize', this._resize);
    this.canvas.removeEventListener('pointerdown', this._pd);
    this.canvas.removeEventListener('wheel', this._wheel);
    this.renderer.dispose();
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { m.map?.dispose?.(); m.dispose?.(); });
      }
    });
  }
}
