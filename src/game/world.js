import * as THREE from 'three';
import { toon, basic, addMesh, labelSprite, buildNpcModel } from './models.js';
import { DUNGEONS, VILLAGES } from './data.js';

function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function grassTex() {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#7ba260'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      g.fillStyle = ['#6d9553', '#86ad6a', '#5f874a', '#93b878', '#789e5e'][(Math.random() * 5) | 0];
      g.globalAlpha = 0.3 + Math.random() * 0.45;
      g.fillRect(x, y, 1.4 + Math.random() * 2.2, 1.5 + Math.random() * 3.2);
    }
    // soft sun-bleached patches
    for (let i = 0; i < 24; i++) {
      const grd = g.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 20 + Math.random() * 30);
      grd.addColorStop(0, 'rgba(190,206,130,.12)');
      grd.addColorStop(1, 'rgba(190,206,130,0)');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
    }
    g.globalAlpha = 1;
  }, [120, 120]);
}

function dirtTex() {
  return canvasTex(128, (g, s) => {
    g.fillStyle = '#a98a5e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = ['#997c50', '#b79764', '#8a6e46', '#c0a473'][(Math.random() * 4) | 0];
      g.globalAlpha = 0.25 + Math.random() * 0.35;
      g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 0.8 + Math.random() * 2.6, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }, [26, 26]);
}

function cobbleTex(rep = [16, 16]) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#7d7a6a'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const px = x * 32 + (y % 2) * 16 + 2, py = y * 32 + 2;
        g.fillStyle = ['#918d7c', '#85816f', '#a39e8a', '#787563'][(Math.random() * 4) | 0];
        g.beginPath();
        g.roundRect(px, py, 28, 28, 7);
        g.fill();
        g.strokeStyle = '#666253'; g.lineWidth = 2; g.stroke();
      }
    }
  }, rep);
}

function forestFloorTex() {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#4a6740'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 3200; i++) {
      g.fillStyle = ['#3f5c38', '#567548', '#365233', '#62815046'][(Math.random() * 4) | 0];
      g.globalAlpha = 0.35 + Math.random() * 0.45;
      g.fillRect(Math.random() * s, Math.random() * s, 1.5 + Math.random() * 3, 1.5 + Math.random() * 4);
    }
    // moss patches
    for (let i = 0; i < 18; i++) {
      const grd = g.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 12 + Math.random() * 26);
      grd.addColorStop(0, 'rgba(116,146,74,.28)');
      grd.addColorStop(1, 'rgba(116,146,74,0)');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
    }
    // fallen leaves
    for (let i = 0; i < 260; i++) {
      g.globalAlpha = 0.35 + Math.random() * 0.4;
      g.fillStyle = ['#9a6c3d', '#b08048', '#7c5533', '#c09254'][(Math.random() * 4) | 0];
      g.beginPath();
      g.ellipse(Math.random() * s, Math.random() * s, 1.4 + Math.random() * 2.4, 0.8 + Math.random() * 1.2, Math.random() * 3, 0, 7);
      g.fill();
    }
    g.globalAlpha = 1;
  }, [55, 55]);
}

export function buildWorld(scene, opts = {}) {
  const density = opts.density ?? 1;
  const lowQuality = !!opts.lowQuality;
  const root = new THREE.Group();
  scene.add(root);
  const overworld = new THREE.Group();
  root.add(overworld);
  const colliders = [];
  const npcs = [];
  const portals = [];
  const labels = [];
  const animators = [];
  const villages = [];

  const addColliderBox = (cx, cz, w, d) => colliders.push({ type: 'box', minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  const addColliderCircle = (cx, cz, r) => colliders.push({ type: 'circle', x: cx, z: cz, r });
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- ground ----------
  const groundMat = toon('#ffffff');
  groundMat.map = grassTex();
  groundMat.color.set('#ffffff');
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3800, 3800, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  overworld.add(ground);

  // low rolling hills far outside the playable bowl
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const r = 1500 + Math.random() * 500;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 26 + Math.random() * 46;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(i % 2 ? '#6f9862' : '#7fa46c'));
    hill.scale.set(120 + Math.random() * 90, h, 120 + Math.random() * 90);
    hill.position.set(x, -2, z);
    overworld.add(hill);
  }

  // ---------- roads ----------
  function ribbon(points, width, mat, y = 0.04, segs = 120) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], y, p[1])));
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t).normalize();
      const n = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(width / 2);
      pos.push(p.x + n.x, y, p.z + n.z, p.x - n.x, y, p.z - n.z);
      uv.push(0, t * 18, 1, t * 18);
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    overworld.add(mesh);
    return mesh;
  }
  const roadMat = toon('#ffffff'); roadMat.map = dirtTex();
  const pathRoad = [[0, 300], [8, 360], [30, 430], [90, 520], [210, 610], [300, 720], [360, 880]];
  ribbon([[0, 300], [-4, 342], [0, 430], [10, 560], [-10, 700]], 14, roadMat);
  ribbon([[300, 0], [360, 10], [470, 40], [580, 80], [700, 90]], 13, roadMat);
  ribbon([[-300, 0], [-380, -40], [-470, -120], [-560, -210], [-640, -300]], 12, roadMat);
  ribbon([[0, -300], [20, -420], [70, -560], [150, -700], [260, -840]], 12, roadMat);
  ribbon([[-470, 430], [-520, 530], [-600, 650], [-680, 760]], 10, roadMat);
  ribbon([[520, 560], [590, 650], [680, 760], [750, 850]], 10, roadMat);

  // ---------- river ----------
  const riverPts = [[-780, -1600], [-620, -1120], [-440, -720], [-300, -380], [-90, -170], [120, -40], [300, 80], [390, 300], [380, 560], [310, 800], [360, 1120], [540, 1600]];
  const waterUniforms = { time: { value: 0 }, deep: { value: new THREE.Color('#2f7f9e') }, shallow: { value: new THREE.Color('#7ed6d3') } };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    vertexShader: `
      varying vec2 vUv; varying vec3 vPos;
      uniform float time;
      void main(){ vUv=uv; vec3 p=position; p.y += sin(p.x*0.22+time*1.3)*0.09 + cos(p.z*0.18+time*1.1)*0.07; vPos=p; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv; varying vec3 vPos;
      uniform float time; uniform vec3 deep; uniform vec3 shallow;
      void main(){
        float w = sin(vUv.y*70.0 + time*2.2 + sin(vUv.x*7.0+time)*2.0)*0.5+0.5;
        float ripple = sin(vUv.x*26.0 - time*1.8)*0.5+0.5;
        vec3 col = mix(deep, shallow, w*0.6+ripple*0.25);
        float foam = smoothstep(0.37,0.5,abs(vUv.x-0.5)) * (0.5+0.5*sin(vUv.y*120.0+time*3.0));
        col = mix(col, vec3(0.92,0.98,0.98), foam*0.5);
        gl_FragColor = vec4(col, 0.88);
      }
    `
  });
  ribbon(riverPts, 46, waterMat, 0.12, 200);
  // river rocks
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    const p = new THREE.CatmullRomCurve3(riverPts.map(v => new THREE.Vector3(v[0], 0.1, v[1]))).getPoint(t);
    const off = (Math.random() - 0.5) * 55;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + Math.random() * 2.2, 0), toon('#8c968d'));
    rock.position.set(p.x + off, 0.4, p.z + (Math.random() - 0.5) * 16);
    rock.scale.y = 0.6;
    rock.castShadow = true;
    overworld.add(rock);
  }
  // bridge on east road
  (() => {
    const g = new THREE.Group();
    g.position.set(372, 0, 70);
    g.rotation.y = 0.32;
    const deck = addMesh(g, new THREE.BoxGeometry(22, 1.2, 24), toon('#9c8d74'), 0, 3.4, 0);
    for (let i = 0; i < 5; i++) {
      addMesh(g, new THREE.BoxGeometry(1, 5, 1), toon('#8b7c64'), -9 + i * 4.5, 1.6, 10);
      addMesh(g, new THREE.BoxGeometry(1, 5, 1), toon('#8b7c64'), -9 + i * 4.5, 1.6, -10);
    }
    addMesh(g, new THREE.BoxGeometry(22, 1.2, 1.2), toon('#8b7c64'), 0, 4.6, 11);
    addMesh(g, new THREE.BoxGeometry(22, 1.2, 1.2), toon('#8b7c64'), 0, 4.6, -11);
    overworld.add(g);
  })();

  // ---------- capital ----------
  const city = new THREE.Group();
  overworld.add(city);
  const cobbleMat = (rx, ry) => { const m = toon('#ffffff'); m.map = cobbleTex([rx, ry]); return m; };
  const cobblePlaza = cobbleMat(40, 40);
  const cobbleNS = cobbleMat(10, 200);
  const cobbleEW = cobbleMat(200, 9);

  // plaza + streets
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(74, 48), cobblePlaza);
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.05, -10); plaza.receiveShadow = true;
  city.add(plaza);
  const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(30, 590), cobbleNS);
  roadNS.rotation.x = -Math.PI / 2; roadNS.position.set(0, 0.04, 0); roadNS.receiveShadow = true; city.add(roadNS);
  const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(580, 26), cobbleEW);
  roadEW.rotation.x = -Math.PI / 2; roadEW.position.set(0, 0.045, -60); roadEW.receiveShadow = true; city.add(roadEW);

  // fountain
  (() => {
    const g = new THREE.Group(); g.position.set(0, 0, -10);
    const stone = toon('#c4bda9'), stoneDark = toon('#a29a87'), gold = toon('#dcc07c');
    addMesh(g, new THREE.CylinderGeometry(9.2, 9.9, 1.3, 36), stoneDark, 0, 0.65, 0);
    addMesh(g, new THREE.CylinderGeometry(8.8, 8.8, 0.35, 36), toon('#6fc9d8', { emissive: '#2b7c8c', emissiveIntensity: 0.55, transparent: true, opacity: 0.82 }), 0, 1.32, 0, false);
    const rim = addMesh(g, new THREE.TorusGeometry(9.2, 0.42, 8, 40), stone, 0, 1.34, 0, false); rim.rotation.x = Math.PI / 2;
    addMesh(g, new THREE.CylinderGeometry(1.9, 2.5, 3.4, 14), stone, 0, 2.5, 0);
    addMesh(g, new THREE.TorusGeometry(2.35, 0.28, 6, 24), gold, 0, 1.1, 0).rotation.x = Math.PI / 2;
    addMesh(g, new THREE.CylinderGeometry(3.5, 3.1, 0.6, 24), stone, 0, 4.5, 0);
    addMesh(g, new THREE.CylinderGeometry(3.1, 3.1, 0.18, 24), toon('#7fd8e2', { emissive: '#2b7c8c', emissiveIntensity: 0.5, transparent: true, opacity: 0.8 }), 0, 4.84, 0, false);
    // winged crown finial
    addMesh(g, new THREE.CylinderGeometry(0.5, 0.7, 2.2, 8), gold, 0, 5.9, 0);
    const orb = addMesh(g, new THREE.SphereGeometry(1.05, 12, 10), toon('#f6e6b0', { emissive: '#a4843c', emissiveIntensity: 0.7 }), 0, 6.2, 0, false);
    for (const sx of [-1, 1]) {
      const wing = addMesh(g, new THREE.ConeGeometry(1.1, 3.6, 4), gold, sx * 1.7, 6.6, 0);
      wing.rotation.z = sx * 0.9;
    }
    // arcing water jets
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p0 = new THREE.Vector3(Math.cos(a) * 3.2, 4.9, Math.sin(a) * 3.2);
      const p1 = new THREE.Vector3(Math.cos(a) * 5.6, 6.2, Math.sin(a) * 5.6);
      const p2 = new THREE.Vector3(Math.cos(a) * 8.3, 1.5, Math.sin(a) * 8.3);
      const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      const jet = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.075, 5, false), basic('#c8f3f8', { transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      g.add(jet);
    }
    const light = new THREE.PointLight('#8fe4ef', 1.6, 18, 1.9);
    light.position.set(0, 5, 0); g.add(light);
    city.add(g);
    addColliderCircle(0, -10, 10);
    animators.push((dt, t) => { orb.position.y = 6.2 + Math.sin(t * 1.6) * 0.08; light.intensity = 1.5 + Math.sin(t * 2.4) * 0.25; });
  })();
  // statues & lamps
  for (const [x, z] of [[-34, -55], [34, -55], [-34, 35], [34, 35], [0, 45], [0, -80]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    addMesh(g, new THREE.CylinderGeometry(0.4, 0.6, 6, 8), toon('#5f6670'), 0, 3, 0);
    addMesh(g, new THREE.BoxGeometry(2.2, 0.3, 0.3), toon('#5f6670'), 0, 6, 0);
    const lamp = addMesh(g, new THREE.SphereGeometry(0.45, 8, 6), toon('#ffe5a0', { emissive: '#ffcb63', emissiveIntensity: 1.8 }), 0, 6.1, 0, false);
    city.add(g);
  }

  function gableRoof(parent, w, d, h, mat, y) {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, h); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    geo.translate(-w / 2, 0, 0);
    const roof = new THREE.Mesh(geo, mat);
    roof.position.y = y;
    roof.castShadow = true;
    parent.add(roof);
    return roof;
  }

  function building(x, z, w, d, h, opts = {}) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = opts.rot ?? 0;
    const wall = toon(opts.wall ?? '#e5d7b6');
    addMesh(g, new THREE.BoxGeometry(w, h, d), wall, 0, h / 2, 0);
    // stone base
    addMesh(g, new THREE.BoxGeometry(w + 0.5, 1, d + 0.5), toon('#9b9180'), 0, 0.5, 0);
    gableRoof(g, w + 2.4, d + 2, h * 0.42, toon(opts.roof ?? '#7c4a3d'), h);
    if (opts.balcony) addMesh(g, new THREE.BoxGeometry(w * 0.6, 0.4, 2.4), toon('#8a6a48'), 0, h * 0.75, d / 2 + 1.2);
    // beams
    const beam = toon(opts.beam ?? '#7a5a3b');
    for (const sx of [-1, 1]) addMesh(g, new THREE.BoxGeometry(0.3, h, 0.3), beam, sx * w / 2, h / 2, d / 2 + 0.12);
    addMesh(g, new THREE.BoxGeometry(w, 0.28, 0.28), beam, 0, h * 0.62, d / 2 + 0.14);
    // door
    addMesh(g, new THREE.BoxGeometry(2.2, 3.4, 0.3), toon('#5d3b24'), 0, 1.9, d / 2 + 0.16);
    // windows
    for (const wx of [-w * 0.28, w * 0.28]) {
      addMesh(g, new THREE.BoxGeometry(1.7, 1.9, 0.2), toon('#ffd98d', { emissive: '#e0a34c', emissiveIntensity: 0.9 }), wx, h * 0.55, d / 2 + 0.18, false);
      if (h > 13) addMesh(g, new THREE.BoxGeometry(1.5, 1.7, 0.2), toon('#ffd98d', { emissive: '#e0a34c', emissiveIntensity: 0.7 }), wx, h * 0.2, d / 2 + 0.18, false);
    }
    if (opts.chimney) {
      addMesh(g, new THREE.BoxGeometry(2, 5, 2), toon('#8d7b66'), w * 0.3, h + 3.5, -d * 0.25);
      addMesh(g, new THREE.BoxGeometry(2.6, 0.7, 2.6), toon('#6e5d4b'), w * 0.3, h + 6.1, -d * 0.25);
    }
    if (opts.shop) {
      addMesh(g, new THREE.BoxGeometry(w * 0.9, 0.25, 3), toon('#8a5a3a'), 0, h * 0.86, d / 2 + 2);
    }
    if (opts.sign) {
      const board = addMesh(g, new THREE.BoxGeometry(4.4, 1.5, 0.2), toon('#5d3b24'), -w / 2 - 0.6, h * 0.55, d / 2 + 0.5);
      const label = labelSprite(opts.sign, '', '#f0dfb0');
      label.scale.set(9, 2.25, 1);
      label.position.set(0, h + 4.4, 0);
      g.add(label);
      labels.push(label);
    }
    city.add(g);
    addColliderBox(x, z, w + 1, d + 1);
    return g;
  }

  // palace
  (() => {
    const g = new THREE.Group(); g.position.set(0, 0, -212); city.add(g);
    const wall = toon('#f3e8c8'), wallShade = toon('#e3d4ad'), trim = toon('#c9b071'), gold = toon('#e2c377', { emissive: '#8a6c2f', emissiveIntensity: 0.18 });
    const roof = toon('#4a6b9c'), roofDark = toon('#3d5a86');
    const glass = toon('#ffd489', { emissive: '#e0a04a', emissiveIntensity: 0.85 });
    addMesh(g, new THREE.BoxGeometry(118, 20, 78), wall, 0, 10, 0);
    addMesh(g, new THREE.BoxGeometry(122, 1.4, 82), trim, 0, 20.6, 0);
    addMesh(g, new THREE.BoxGeometry(126, 0.6, 86), gold, 0, 21.5, 0);
    addMesh(g, new THREE.BoxGeometry(58, 34, 54), wall, 0, 17, -8);
    addMesh(g, new THREE.BoxGeometry(62, 1.6, 58), trim, 0, 34.4, -8);
    addMesh(g, new THREE.BoxGeometry(64, 0.5, 60), gold, 0, 35.4, -8);
    gableRoof(g, 64, 60, 17, roof, 34.4);
    addMesh(g, new THREE.BoxGeometry(4, 3, 3), gold, 0, 52, -8);
    // pilasters along the facade
    for (let i = 0; i < 9; i++) {
      const x = -48 + i * 12;
      addMesh(g, new THREE.CylinderGeometry(1.05, 1.2, 19, 8), wallShade, x, 9.5, 38.6);
      addMesh(g, new THREE.BoxGeometry(2.8, 1.1, 2.8), trim, x, 19.2, 38.6);
      addMesh(g, new THREE.BoxGeometry(2.8, 1.1, 2.8), trim, x, 0.55, 38.6);
    }
    // tall arched windows with gold frames
    for (let i = 0; i < 7; i++) {
      const x = -42 + i * 14;
      addMesh(g, new THREE.BoxGeometry(6.4, 9.5, 0.5), gold, x, 10.5, 39.4, false);
      addMesh(g, new THREE.BoxGeometry(5.4, 8.6, 0.4), glass, x, 10.4, 39.7, false);
      addMesh(g, new THREE.CircleGeometry(2.7, 14, 0, Math.PI), glass, x, 14.7, 39.72, false);
      addMesh(g, new THREE.BoxGeometry(0.5, 8.6, 0.5), gold, x, 10.4, 39.8, false);
      addMesh(g, new THREE.BoxGeometry(5.4, 0.45, 0.5), gold, x, 10.4, 39.8, false);
    }
    // grand doors + balcony
    addMesh(g, new THREE.BoxGeometry(18, 12, 12), toon('#5b3c27'), 0, 6, 39.2);
    addMesh(g, new THREE.BoxGeometry(18.8, 12.8, 1.2), gold, 0, 6, 40.1);
    addMesh(g, new THREE.BoxGeometry(20, 0.5, 12.4), trim, 0, 12.6, 36);
    addMesh(g, new THREE.BoxGeometry(24, 1.2, 7), trim, 0, 16.4, 44);
    for (let i = 0; i < 11; i++) addMesh(g, new THREE.BoxGeometry(0.35, 2.4, 0.35), gold, -11 + i * 2.2, 18, 47.2);
    addMesh(g, new THREE.BoxGeometry(24, 0.4, 0.4), gold, 0, 19.2, 47.2);
    // towers
    for (const [x, z] of [[-31, -8], [31, -8], [-49, 8], [49, 8], [-49, -31], [49, -31]]) {
      addMesh(g, new THREE.CylinderGeometry(5, 6, 30, 10), wall, x, 15, z);
      addMesh(g, new THREE.CylinderGeometry(5.6, 5.6, 1.2, 10), trim, x, 30.4, z);
      addMesh(g, new THREE.CylinderGeometry(5.9, 5.9, 0.4, 10), gold, x, 31.2, z);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 12, 10), roof);
      cone.position.set(x, 37, z); cone.castShadow = true; g.add(cone);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.4, 6), gold);
      tip.position.set(x, 44, z); g.add(tip);
    }
    // banners & flags
    for (const x of [-24, 24]) {
      const banner = addMesh(g, new THREE.PlaneGeometry(5.4, 13), toon('#3e5d9c', { side: THREE.DoubleSide }), x, 12.4, 43.4);
      addMesh(g, new THREE.CircleGeometry(1.5, 12), gold, x, 14, 43.6, false);
      addMesh(g, new THREE.BoxGeometry(5.6, 0.4, 0.4), gold, x, 19, 43.4);
    }
    const flags = [];
    for (const [x, y] of [[0, 54], [-40, 26], [40, 26]]) {
      addMesh(g, new THREE.CylinderGeometry(0.16, 0.2, 8, 5), toon('#6a5639'), x, y, 20);
      const flag = addMesh(g, new THREE.PlaneGeometry(5, 2.8), toon('#3e5d9c', { side: THREE.DoubleSide }), x + 2.5, y + 5.2, 20);
      flags.push(flag);
    }
    animators.push((dt, t) => flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 1.6 + i) * 0.22; f.rotation.z = Math.sin(t * 2.1 + i) * 0.06; }));
    // grand staircase
    for (let i = 0; i < 8; i++) addMesh(g, new THREE.BoxGeometry(40 - i * 2.2, 0.7, 7), i % 2 ? toon('#d7cbae') : toon('#e7dcc0'), 0, 0.35 + i * 0.62, 41 + i * 1.6);
    // garden hedges & flowerbeds
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        addMesh(g, new THREE.BoxGeometry(3, 2.2, 22), toon('#4f7a45'), sx * 30, 1.1, 58 + i * 26);
      }
      for (let i = 0; i < 10; i++) {
        addMesh(g, new THREE.SphereGeometry(0.5, 6, 5), toon(['#d96b6b', '#e8c26a', '#b47fc4', '#e08f5f'][i % 4]), sx * (26 + (i % 2) * 2), 1.8, 52 + i * 9, false);
      }
    }
    // guardian statues
    for (const sx of [-1, 1]) {
      const st = new THREE.Group(); st.position.set(sx * 17, 0, 54); g.add(st);
      addMesh(st, new THREE.BoxGeometry(4.4, 1.4, 4.4), trim, 0, 0.7, 0);
      addMesh(st, new THREE.CylinderGeometry(0.9, 1.1, 4.2, 8), toon('#b9b19c'), 0, 3.4, 0);
      addMesh(st, new THREE.SphereGeometry(0.75, 8, 6), toon('#c8c0aa'), 0, 5.9, 0);
      addMesh(st, new THREE.ConeGeometry(0.9, 2.4, 6), toon('#8a7a5c'), 0, 7.2, 0);
      addMesh(st, new THREE.BoxGeometry(0.22, 4.2, 0.22), gold, 0.9, 3.6, 0.2);
    }
    const label = labelSprite('ROYAL PALACE', 'Crown of Elyndor', '#f4e4b0');
    label.position.set(0, 64, 0); label.scale.set(38, 9.5, 1); g.add(label);
    addColliderBox(0, -212, 124, 84);
  })();

  // guild
  (() => {
    const g = building(-165, -88, 38, 28, 16, { wall: '#dcd2b4', roof: '#4d6f63', sign: 'GUILD HALL', beam: '#6a7c63' });
    const banner = addMesh(g, new THREE.PlaneGeometry(5, 10), toon('#3e6c5b', { side: THREE.DoubleSide }), 0, 12, 15);
    addMesh(g, new THREE.CircleGeometry(1.4, 12), toon('#e2c97a'), 0, 13, 15.1, false);
  })();
  // inn
  building(162, -86, 36, 26, 18, { wall: '#e6d0a8', roof: '#8a4d3e', sign: 'THE GILDED STAG', shop: true });
  // blacksmith
  (() => {
    const g = building(132, 156, 30, 24, 12, { wall: '#c9b795', roof: '#5b4638', sign: 'BLACKSMITH', shop: true });
    addMesh(g, new THREE.CylinderGeometry(2.6, 3.4, 16, 8), toon('#7f7261'), -9, 18, -5);
    const glow = addMesh(g, new THREE.BoxGeometry(4, 3, 1.2), toon('#ff9c3e', { emissive: '#ff6b1a', emissiveIntensity: 2.2 }), 9, 2.4, 13, false);
    addMesh(g, new THREE.BoxGeometry(2.4, 1.4, 1.6), toon('#4b4d52'), 4, 1.1, 16);
  })();
  // market stalls
  (() => {
    const awnings = ['#b74c48', '#3f7d8c', '#c5a04c', '#6a7f4b'];
    for (let i = 0; i < 6; i++) {
      const x = -48 + i * 19, z = 92 + (i % 2) * 6;
      const g = new THREE.Group(); g.position.set(x, 0, z); city.add(g);
      addMesh(g, new THREE.BoxGeometry(12, 0.8, 7), toon('#8b6a46'), 0, 2.2, 0);
      for (const sx of [-5, 5]) for (const sz of [-2.8, 2.8]) addMesh(g, new THREE.BoxGeometry(0.3, 2.4, 0.3), toon('#6d4d31'), sx, 1.2, sz);
      for (let k = 0; k < 7; k++) {
        addMesh(g, new THREE.BoxGeometry(1.86, 0.22, 8.2), toon(k % 2 ? '#e9ddc2' : awnings[i % 4]), -5.58 + k * 1.86, 5.2, 0).rotation.z = 0.04;
      }
      addMesh(g, new THREE.BoxGeometry(13, 0.35, 0.25), toon('#e7dcc0'), 0, 4.9, 4.1);
      for (let k = 0; k < 4; k++) {
        const fruit = addMesh(g, new THREE.SphereGeometry(0.32, 7, 5), toon(['#d9564c', '#e0a039', '#7fa347', '#9b5fa8'][k]), -3.5 + k * 1.6, 2.8, 0.7);
      }
      addColliderBox(x, z, 12, 7);
    }
    // crates and barrels
    for (const [x, z] of [[-60, 70], [66, 84], [20, 122], [-30, 126]]) {
      addMesh(city, new THREE.BoxGeometry(2, 2, 2), toon('#93714a'), x, 1, z);
      addMesh(city, new THREE.CylinderGeometry(0.9, 0.9, 1.8, 10), toon('#805c3b'), x + 2.4, 0.9, z + 0.6);
    }
  })();
  // arena
  (() => {
    const g = new THREE.Group(); g.position.set(-188, 0, 128); city.add(g);
    addMesh(g, new THREE.CylinderGeometry(46, 49, 5, 28), toon('#b6a68a'), 0, 2.5, 0);
    addMesh(g, new THREE.CylinderGeometry(39, 39, 5.6, 28), toon('#d8c88f'), 0, 2.85, 0);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const p = addMesh(g, new THREE.CylinderGeometry(1.5, 1.8, 13, 8), toon('#c0b293'), Math.cos(a) * 46, 9, Math.sin(a) * 46);
      addMesh(g, new THREE.BoxGeometry(4.4, 0.6, 4.4), toon('#9c8e72'), Math.cos(a) * 46, 15.6, Math.sin(a) * 46);
    }
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      addMesh(g, new THREE.CircleGeometry(1.6, 10), toon('#b14848', { side: THREE.DoubleSide }), Math.cos(a) * 44, 10, Math.sin(a) * 44).rotation.y = -a + Math.PI / 2;
    }
    // training dummies
    for (const [dx, dz] of [[-14, -12], [10, -16], [16, 8], [-8, 14]]) {
      addMesh(g, new THREE.CylinderGeometry(0.2, 0.25, 5, 6), toon('#6b5138'), dx, 5.5, dz);
      addMesh(g, new THREE.BoxGeometry(2, 2.6, 1), toon('#c7b27c'), dx, 7.4, dz);
      addMesh(g, new THREE.SphereGeometry(0.6, 8, 6), toon('#a88f62'), dx, 9.1, dz);
    }
    const label = labelSprite('TRAINING ARENA', 'Prove your worth', '#efe1b2');
    label.position.set(0, 22, 0); label.scale.set(26, 6.5, 1); g.add(label);
    addColliderCircle(-188, 128, 40);
  })();
  // residential houses
  const houseSpots = [
    [-245, -180, 26, 20], [-245, -120, 24, 20], [-235, -20, 28, 22], [-225, 55, 24, 20],
    [235, -180, 26, 20], [240, -115, 24, 20], [232, -10, 28, 22], [226, 70, 24, 20],
    [-160, 230, 24, 20], [-110, 230, 24, 20], [110, 230, 24, 20], [160, 230, 24, 20],
    [-70, -265, 24, 18], [74, -262, 24, 18]
  ];
  const walls = ['#e0cda6', '#d9c8a8', '#cdb894', '#e7d7b6'];
  const roofs = ['#7d4a3c', '#576f5b', '#6d5a7a', '#87613e'];
  houseSpots.forEach(([x, z, w, d], i) => {
    building(x, z, w, d, 11 + (i % 3) * 2, {
      wall: walls[i % 4], roof: roofs[i % 4],
      windows: true, rot: x < 0 ? Math.PI / 2 : 0
    });
  });
  // dense inner city blocks
  const innerBlocks = [
    [-98, -158, 26, 20, 17], [-98, -104, 24, 20, 19], [-98, -22, 26, 22, 16], [-98, 34, 24, 20, 18],
    [98, -158, 26, 20, 18], [98, -104, 24, 20, 16], [98, -22, 26, 22, 19], [98, 34, 24, 20, 17],
    [-142, 68, 22, 18, 15], [142, 68, 22, 18, 16],
    [-142, -160, 22, 18, 14], [142, -160, 22, 18, 15]
  ];
  innerBlocks.forEach(([x, z, w, d, h], i) => {
    building(x, z, w, d, h, {
      wall: ['#e3d2ab', '#d8c49c', '#e9dcbb', '#ccb994'][i % 4],
      roof: ['#7a473b', '#566b58', '#7c5a3d', '#4f5f7c'][i % 4],
      chimney: i % 2 === 0, balcony: i % 3 === 0, window: true
    });
  });

  // city park trees
  for (const [x, z, s] of [[-105, -30, 1], [-95, 25, 0.8], [105, -20, 0.9], [98, 30, 1.1], [-70, -130, 1], [78, -132, 0.9]]) {
    makeSimpleTree(city, x, z, s, '#4f7f45');
  }
  function makeSimpleTree(parent, x, z, s, color) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    g.rotation.y = (x * 0.7 + z * 1.3) % 6.28;
    const base = new THREE.Color(color);
    addMesh(g, new THREE.CylinderGeometry(0.42, 0.62, 5.2, 7), toon('#6a4a31'), 0, 2.6, 0);
    addMesh(g, new THREE.ConeGeometry(3.5, 6.6, 8), toon(base.clone().multiplyScalar(0.9)), 0, 6.4, 0);
    addMesh(g, new THREE.ConeGeometry(2.8, 5.4, 8), toon(base.clone().multiplyScalar(1.04)), 0, 9.3, 0);
    addMesh(g, new THREE.ConeGeometry(1.9, 4.2, 8), toon(base.clone().multiplyScalar(1.14)), 0, 11.9, 0);
    parent.add(g);
    return g;
  }

  // walls + gates
  (() => {
    const stone = toon('#aca58f'), stoneDark = toon('#8f8874'), roofB = toon('#4f6385');
    const H = 16, T = 4, L = 268;
    const segments = [
      [-150, -300, L, T, 'h'], [150, -300, L, T, 'h'],
      [-150, 300, L, T, 'h'], [150, 300, L, T, 'h'],
      [-300, -150, T, L, 'v'], [-300, 150, T, L, 'v'],
      [300, -150, T, L, 'v'], [300, 150, T, L, 'v']
    ];
    for (const [x, z, w, d, dir] of segments) {
      const m = addMesh(city, new THREE.BoxGeometry(w, H, d), stone, x, H / 2, z);
      addMesh(city, new THREE.BoxGeometry(w + 1, 1.6, d + 1), stoneDark, x, H, z);
      for (let i = -3; i <= 3; i++) {
        const off = i * (dir === 'h' ? 42 : 0);
        const offZ = i * (dir === 'v' ? 42 : 0);
        addMesh(city, new THREE.BoxGeometry(dir === 'h' ? 6 : T + 1.5, 6, dir === 'h' ? T + 1.5 : 6), stoneDark, x + off, H + 3, z + offZ);
        addMesh(city, new THREE.BoxGeometry(dir === 'h' ? 3 : T + 2.2, 3, dir === 'h' ? T + 2.2 : 3), stone, x + off, H + 7, z + offZ);
      }
      addColliderBox(x, z, w, d);
    }
    const towers = [[-300, -300], [300, -300], [-300, 300], [300, 300], [0, -300], [0, 300], [-300, 0], [300, 0]];
    towers.forEach(([x, z]) => {
      addMesh(city, new THREE.CylinderGeometry(10, 11.5, 26, 10), stone, x, 13, z);
      addMesh(city, new THREE.CylinderGeometry(11.8, 11.8, 1.6, 10), stoneDark, x, 26, z);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(12.6, 16, 10), roofB);
      cone.position.set(x, 34, z); cone.castShadow = true; city.add(cone);
      addColliderCircle(x, z, 10);
    });
    // gate arches
    for (const [x, z, rot] of [[0, -300, 0], [0, 300, 0], [-300, 0, Math.PI / 2], [300, 0, Math.PI / 2]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; city.add(g);
      addMesh(g, new THREE.BoxGeometry(28, 4, 7), stone, 0, 19, 0);
      for (const sx of [-10, 10]) addMesh(g, new THREE.BoxGeometry(4, 22, 7), stone, sx, 11, 0);
      addMesh(g, new THREE.BoxGeometry(32, 1.2, 8), stoneDark, 0, 21.4, 0);
    }
    const cityLabel = labelSprite('ELYNDOR CAPITAL', '600 × 600 m', '#f5e8bc');
    cityLabel.position.set(0, 64, -300); cityLabel.scale.set(56, 14, 1); city.add(cityLabel);
  })();

  // farms
  (() => {
    const soil = toon('#7d5c3b');
    for (let f = 0; f < 3; f++) {
      const fx = -170 + f * 110, fz = 420 + (f % 2) * 30;
      const field = addMesh(overworld, new THREE.PlaneGeometry(78, 62), soil, fx, 0.06, fz);
      field.rotation.x = -Math.PI / 2;
      const cropMat = toon(f % 2 ? '#d8c46a' : '#7da24a');
      for (let i = 0; i < 9; i++) {
        const row = addMesh(overworld, new THREE.BoxGeometry(70, 0.6, 2), cropMat, fx, 0.5, fz - 27 + i * 6.6);
        row.castShadow = false;
      }
      // fence
      for (let i = 0; i < 8; i++) {
        addMesh(overworld, new THREE.BoxGeometry(0.3, 2.2, 0.3), toon('#8b6c49'), fx - 39 + i * 11, 1.1, fz - 32);
        addMesh(overworld, new THREE.BoxGeometry(0.3, 2.2, 0.3), toon('#8b6c49'), fx - 39 + i * 11, 1.1, fz + 32);
      }
    }
    // barn
    building(-196, 520, 34, 24, 14, { wall: '#a8493f', roof: '#5a4034' });
    // windmill
    const wg = new THREE.Group(); wg.position.set(-92, 0, 470); overworld.add(wg);
    addMesh(wg, new THREE.CylinderGeometry(6, 9, 26, 10), toon('#d8c9a8'), 0, 13, 0);
    const blades = new THREE.Group(); blades.position.set(0, 24, 8); wg.add(blades);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; blades.add(arm);
      addMesh(arm, new THREE.BoxGeometry(2.4, 18, 0.4), toon('#8a6c48'), 0, 9, 0);
      addMesh(arm, new THREE.BoxGeometry(5.6, 12, 0.3), toon('#e8ddc2'), 0, 10, 0.1, false);
    }
    blades.userData.spin = 0.5;
    animators.push((dt) => { blades.rotation.z += dt * 0.45; });
    // scarecrow
    addMesh(overworld, new THREE.CylinderGeometry(0.2, 0.2, 5, 6), toon('#6d5338'), -148, 2.5, 410);
    addMesh(overworld, new THREE.BoxGeometry(4, 0.25, 0.25), toon('#6d5338'), -148, 4, 410);
    addMesh(overworld, new THREE.SphereGeometry(0.8, 8, 6), toon('#c8ab6d'), -148, 5.4, 410);
  })();

  // ---------- villages ----------
  VILLAGES.forEach((v, vi) => {
    const g = new THREE.Group(); g.position.set(v.x, 0, v.z); overworld.add(g);
    const count = 4 + (vi % 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + vi;
      const r = 24 + (i % 2) * 16;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      // local house (not using city building to avoid city parent)
      const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = -a + Math.PI / 2; g.add(h);
      const w = 12 + (i % 3) * 3, d = 10 + (i % 2) * 3;
      addMesh(h, new THREE.BoxGeometry(w, 8, d), toon(['#e3d2ac', '#d8c39f', '#cdb58f'][i % 3]), 0, 4, 0);
      addMesh(h, new THREE.BoxGeometry(w + 1, 0.8, d + 1), toon('#8d8270'), 0, 0.4, 0);
      gableRoof(h, w + 2, d + 1.6, 4.4, toon(['#7b4a3b', '#5a6d55', '#84603c'][i % 3]), 8);
      addMesh(h, new THREE.BoxGeometry(1.8, 3, 0.2), toon('#5c3c26'), 0, 1.6, d / 2 + 0.1);
      addMesh(h, new THREE.BoxGeometry(1.4, 1.4, 0.2), toon('#ffda8a', { emissive: '#d99a44', emissiveIntensity: 0.8 }), w * 0.25, 5, d / 2 + 0.12, false);
      addColliderCircle(v.x + x, v.z + z, Math.max(w, d) * 0.5);
    }
    // well
    const well = new THREE.Group(); well.position.set(v.x, 0, v.z); overworld.add(well);
    addMesh(well, new THREE.CylinderGeometry(2.6, 2.8, 1.8, 12), toon('#9b9588'), 0, 0.9, 0);
    addMesh(well, new THREE.CylinderGeometry(2.0, 2.0, 0.2, 12), toon('#4e92a5'), 0, 1.75, 0);
    for (const sx of [-2.4, 2.4]) addMesh(well, new THREE.BoxGeometry(0.35, 5, 0.35), toon('#6f5438'), sx, 2.5, 0);
    addMesh(well, new THREE.ConeGeometry(3.8, 2.2, 4), toon('#7d5436'), 0, 5.4, 0);
    // signpost label
    const label = labelSprite(v.name.toUpperCase(), 'Village', '#f1e4bb');
    label.position.set(v.x, 20, v.z); label.scale.set(30, 7.5, 1); g.add(label);
    // village npc
    const npcPal = [
      { robe: '#8a6a45', hair: '#6c6c6c' }, { robe: '#4f7a86', hair: '#8a5a35' },
      { robe: '#77684c', hair: '#3d2e22' }, { robe: '#6d5a72', hair: '#b0783d' }
    ][vi];
    const npcNames = [
      ['Elder Bram', 'Village Elder', 'Meadowbrook’s harvest has been thin. Goblins creep from the west woods.'],
      ['Nia the Ferrywoman', 'River Guide', 'The river runs cold and fast this season. Mind the current beyond the bridge.'],
      ['Hobb Stonehand', 'Quarry Master', 'Stoneford was carved from these hills. Something below has begun to knock back.'],
      ['Rook', 'Hunter', 'The Monster Forest starts beyond the ridge. If you hear wings, do not look up.']
    ][vi];
    const npc = buildNpcModel(npcPal);
    npc.position.set(v.x + 10, 0, v.z + 9);
    npc.rotation.y = -0.6;
    overworld.add(npc);
    const npcData = {
      id: 'village' + vi, name: npcNames[0], role: npcNames[1], x: v.x + 10, z: v.z + 9,
      lines: [npcNames[2], ringingLine(vi)], kind: 'flavor', village: v.name
    };
    npcs.push({ data: npcData, mesh: npc });
    villages.push({ ...v });
    addColliderCircle(v.x, v.z, 3);
  });
  function ringingLine(i) {
    return [
      'The capital’s banners still fly. That is something, in days like these.',
      'If you find a sigil in the wilds, bring it to the Guild. They pay honestly.',
      'Rest at the inn when you can. A full belly wins more fights than a sharp blade.',
      'The deep forests change people. Come back before it changes you.'
    ][i % 4];
  }

  // ---------- forests ----------
  const trunkGeo = new THREE.CylinderGeometry(0.34, 0.62, 7, 7);
  trunkGeo.translate(0, 3.5, 0);
  const pineGeos = [
    new THREE.ConeGeometry(3.5, 5.4, 8).translate(0, 4.6, 0),
    new THREE.ConeGeometry(2.7, 4.6, 8).translate(0, 7.7, 0),
    new THREE.ConeGeometry(1.75, 3.6, 8).translate(0, 10.5, 0)
  ];
  const canopyGeoA = new THREE.IcosahedronGeometry(2.9, 1).translate(0, 8.6, 0);
  const canopyGeoB = new THREE.IcosahedronGeometry(2.1, 1).translate(-1.9, 7.3, 0.7);
  const canopyGeoC = new THREE.IcosahedronGeometry(1.85, 1).translate(1.8, 7.8, -0.8);
  const trunkMat = toon('#6b4a31');
  const pinePalette = ['#2f5c38', '#3a6b3f', '#356345', '#2b5235', '#44734a'];
  const broadPalette = ['#4a7a3c', '#568744', '#3f6c39', '#608f4b', '#487a45'];
  const mistTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 32, 2, 64, 32, 62);
    grd.addColorStop(0, 'rgba(235,245,235,.55)');
    grd.addColorStop(0.5, 'rgba(220,238,225,.18)');
    grd.addColorStop(1, 'rgba(210,230,220,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  function buildForest(zone) {
    const { x0, x1, z0, z1, palette, name, clearings } = zone;
    const count = Math.max(60, Math.round(zone.count * density));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), toon('#ffffff'));
    floor.material.map = forestFloorTex();
    floor.material.color.set(palette.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2);
    floor.receiveShadow = true;
    overworld.add(floor);

    // paths winding through the trees
    const pathPts = zone.kind === 'monster'
      ? [[300, -540], [400, -700], [500, -940], [560, -1180], [700, -1360], [900, -1500], [1010, -1620]]
      : [[-300, -360], [-400, -470], [-540, -620], [-660, -760], [-720, -820], [-820, -960], [-930, -1110], [-1060, -1320]];
    const pathMat = toon('#ffffff');
    pathMat.map = dirtTex();
    pathMat.color.set(zone.kind === 'monster' ? '#7a6b58' : '#9b8158');
    ribbon(pathPts, 10, pathMat, 0.06, 90);

    const positions = [];
    const trees = [];
    let attempts = 0;
    while (trees.length < count && attempts < count * 10) {
      attempts++;
      const x = x0 + 20 + Math.random() * (x1 - x0 - 40);
      const z = z0 + 20 + Math.random() * (z1 - z0 - 40);
      let skip = false;
      for (const c of clearings) if ((x - c[0]) ** 2 + (z - c[1]) ** 2 < c[2] ** 2) { skip = true; break; }
      if (!skip) for (const p2 of portals) if ((x - p2.pos.x) ** 2 + (z - p2.pos.z) ** 2 < 32 * 32) { skip = true; break; }
      if (!skip) for (let i = 0; i < pathPts.length - 1; i++) {
        const [ax, az] = pathPts[i], [bx, bz] = pathPts[i + 1];
        const dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < 11) { skip = true; break; }
      }
      if (skip) continue;
      const r = Math.random();
      const type = r < (zone.kind === 'monster' ? 0.72 : 0.58) ? 'pine' : 'broad';
      const sc = 0.72 + Math.random() * 0.75;
      trees.push({ x, z, sc, type, rot: Math.random() * Math.PI * 2, color: type === 'pine' ? pick(pinePalette) : pick(broadPalette) });
      positions.push([x, z, sc]);
      if (sc > 0.95) addColliderCircle(x, z, 0.5 + sc * 0.22);
    }
    const pines = trees.filter(t => t.type === 'pine');
    const broads = trees.filter(t => t.type === 'broad');
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), p = new THREE.Vector3();
    const rotAxis = new THREE.Vector3(0, 1, 0);
    const fill = (geo, mat, list, yScale = 1, colored = false) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
      im.castShadow = true;
      im.frustumCulled = true;
      list.forEach((t, i) => {
        q.setFromAxisAngle(rotAxis, t.rot);
        p.set(t.x, 0, t.z);
        sv.set(t.sc, t.sc * yScale * (0.92 + Math.random() * 0.16), t.sc);
        m.compose(p, q, sv);
        im.setMatrixAt(i, m);
        if (colored) im.setColorAt(i, new THREE.Color(t.color));
      });
      im.count = list.length;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      overworld.add(im);
      return im;
    };
    // trunks
    fill(trunkGeo, trunkMat, pines);
    fill(trunkGeo, trunkMat, broads, 0.84);
    // pine layers
    pineGeos.forEach((geo, li) => {
      fill(geo, toon('#ffffff'), pines, 1, true);
    });
    // broadleaf canopy clumps (offset in geometry, same instance transform)
    fill(canopyGeoA, toon('#ffffff'), broads, 1, true);
    fill(canopyGeoB, toon('#ffffff'), broads, 1, true);
    fill(canopyGeoC, toon('#ffffff'), broads, 1, true);

    // bushes / grass tufts / mushrooms
    const bushCount = Math.round(150 * density) + 30;
    const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.15, 0), toon('#ffffff'), bushCount);
    const grassCount = Math.round(420 * density) + 60;
    const tuftGeo = new THREE.ConeGeometry(0.16, 1.25, 3);
    tuftGeo.translate(0, 0.6, 0);
    const tufts = new THREE.InstancedMesh(tuftGeo, toon('#ffffff'), grassCount);
    const mushCount = Math.round(40 * density) + 12;
    const mushCaps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), toon('#c8554c'), mushCount);
    const mushStems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 0.36, 5), toon('#e8ddc2'), mushCount);
    const bcol = new THREE.Color();
    for (let i = 0; i < bushCount; i++) {
      const t = pick(trees);
      const x = t.x + rand(-7, 7), z = t.z + rand(-7, 7);
      const sc = 0.6 + Math.random() * 1.1;
      q.setFromAxisAngle(rotAxis, Math.random() * 6); p.set(x, sc * 0.35, z); sv.set(sc, sc * 0.72, sc);
      m.compose(p, q, sv); bushes.setMatrixAt(i, m);
      bcol.setHSL(0.28 + Math.random() * 0.07, 0.35 + Math.random() * 0.2, 0.2 + Math.random() * 0.12);
      bushes.setColorAt(i, bcol);
    }
    for (let i = 0; i < grassCount; i++) {
      const x = x0 + Math.random() * (x1 - x0), z = z0 + Math.random() * (z1 - z0);
      const sc = 0.65 + Math.random() * 0.9;
      q.setFromAxisAngle(rotAxis, Math.random() * 6); p.set(x, 0, z); sv.set(sc, sc * (0.8 + Math.random() * 0.7), sc);
      m.compose(p, q, sv); tufts.setMatrixAt(i, m);
      bcol.setHSL(0.2 + Math.random() * 0.06, 0.42, 0.3 + Math.random() * 0.18);
      tufts.setColorAt(i, bcol);
    }
    for (let i = 0; i < mushCount; i++) {
      const t = pick(trees);
      const x = t.x + rand(-6, 6), z = t.z + rand(-6, 6);
      const sc = 0.8 + Math.random() * 1.2;
      q.identity();
      p.set(x, 0.16 * sc, z); sv.set(sc, sc, sc); m.compose(p, q, sv);
      mushStems.setMatrixAt(i, m);
      p.set(x, 0.34 * sc, z); m.compose(p, q, sv);
      mushCaps.setMatrixAt(i, m);
    }
    bushes.instanceMatrix.needsUpdate = true; if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
    tufts.instanceMatrix.needsUpdate = true; if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
    mushCaps.instanceMatrix.needsUpdate = true; mushStems.instanceMatrix.needsUpdate = true;
    overworld.add(bushes, tufts, mushCaps, mushStems);

    // mossy boulders
    const rockCount = Math.round(46 * density) + 8;
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), toon('#7f8a7a'), rockCount);
    for (let i = 0; i < rockCount; i++) {
      const t = pick(trees);
      const x = t.x + rand(-9, 9), z = t.z + rand(-9, 9);
      const sc = 0.5 + Math.random() * 1.9;
      q.setFromEuler(new THREE.Euler(Math.random() * 0.5, Math.random() * 6, Math.random() * 0.5));
      p.set(x, sc * 0.28, z); sv.set(sc, sc * 0.62, sc);
      m.compose(p, q, sv); rocks.setMatrixAt(i, m);
      bcol.setHSL(0.25 + Math.random() * 0.06, 0.12 + Math.random() * 0.1, 0.32 + Math.random() * 0.12);
      rocks.setColorAt(i, bcol);
    }
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    overworld.add(rocks);

    // fallen logs
    for (let i = 0; i < Math.round(7 * density); i++) {
      const t = pick(trees);
      const log = addMesh(overworld, new THREE.CylinderGeometry(0.55, 0.7, 5 + Math.random() * 3, 7), toon('#5d4631'), t.x + rand(-6, 6), 0.6, t.z + rand(-6, 6));
      log.rotation.z = Math.PI / 2;
      log.rotation.y = Math.random() * 6;
      addMesh(overworld, new THREE.SphereGeometry(1.1, 6, 5), toon('#4f7a3f'), t.x + 1, 0.9, t.z).scale.set(1.6, 0.35, 0.9);
    }

    // drifting ground mist
    for (let i = 0; i < Math.round(10 * density) + 3; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, opacity: 0.16, depthWrite: false }));
      spr.scale.set(90 + Math.random() * 70, 16 + Math.random() * 10, 1);
      spr.position.set(x0 + Math.random() * (x1 - x0), 3 + Math.random() * 4, z0 + Math.random() * (z1 - z0));
      overworld.add(spr);
      const dx = rand(-0.5, 0.5);
      const baseY = spr.position.y;
      animators.push((dt, t) => { spr.position.x += dt * dx; spr.position.y = baseY + Math.sin(t * 0.3 + i) * 0.35; });
    }

    // fireflies
    const fCount = Math.round(90 * density) + 20;
    const fPos = new Float32Array(fCount * 3);
    for (let i = 0; i < fCount; i++) {
      fPos[i * 3] = x0 + Math.random() * (x1 - x0);
      fPos[i * 3 + 1] = 1 + Math.random() * 7;
      fPos[i * 3 + 2] = z0 + Math.random() * (z1 - z0);
    }
    const fGeo = new THREE.BufferGeometry();
    fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    const fireflies = new THREE.Points(fGeo, new THREE.PointsMaterial({ color: '#eaffb0', size: 0.5, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    overworld.add(fireflies);
    animators.push((dt, t) => { fireflies.position.y = Math.sin(t * 0.6) * 0.4; });

    // zone marker
    const label = labelSprite(name.toUpperCase(), `${x1 - x0} × ${z1 - z0} m`, '#e8e3c0');
    label.position.set((x0 + x1) / 2, 48, z0 + 25);
    label.scale.set(70, 17.5, 1);
    overworld.add(label);

    return positions;
  }

  // ---------- dungeon portals ----------
  const portalTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 4, 128, 128, 126);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.25, 'rgba(160,230,255,0.65)');
    grd.addColorStop(0.7, 'rgba(80,120,255,0.3)');
    grd.addColorStop(1, 'rgba(30,40,90,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(230,245,255,.8)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(128, 128, 30 + i * 22, 0, 7); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  function buildPortal(d) {
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); overworld.add(g);
    const stone = toon('#7c7a70');
    for (const sx of [-4.4, 4.4]) addMesh(g, new THREE.BoxGeometry(2.4, 12, 2.4), stone, sx, 6, 0);
    addMesh(g, new THREE.BoxGeometry(11.6, 2.2, 2.6), stone, 0, 13.4, 0);
    addMesh(g, new THREE.TorusGeometry(4.2, 0.5, 6, 24), toon('#5c6e72'), 0, 7.4, 0.1).rotation.z = 0;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      addMesh(g, new THREE.ConeGeometry(0.7, 3.4, 5), stone, Math.cos(a) * 9, 0.8, Math.sin(a) * 9);
    }
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), new THREE.MeshBasicMaterial({ map: portalTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: '#b7d8ff' }));
    disc.position.set(0, 7.4, 0.4);
    g.add(disc);
    const glow = new THREE.PointLight('#85b6ff', 8, 30);
    glow.position.set(0, 7, 2); g.add(glow);
    const label = labelSprite(d.name.toUpperCase(), `RANK ${d.rank} DUNGEON`, '#e9d9ff');
    label.position.set(0, 19, 0); label.scale.set(28, 7, 1); g.add(label);
    const mesh = { group: g, disc, glow };
    animators.push((dt, t) => {
      disc.rotation.z += dt * 0.5;
      const s = 1 + Math.sin(t * 2 + d.x) * 0.04;
      disc.scale.set(s, s, 1);
      glow.intensity = 6 + Math.sin(t * 3) * 2.2;
    });
    const portal = { id: d.id, dungeon: d, pos: new THREE.Vector3(d.x, 0, d.z), mesh, discovered: false };
    portals.push(portal);
    addColliderBox(d.x - 5, d.z, 2.4, 2.4);
    addColliderBox(d.x + 5, d.z, 2.4, 2.4);
    return portal;
  }
  Object.values(DUNGEONS).forEach(buildPortal);

  // player-facing forest entrances signs
  const signForest = (x, z, text, sub) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); overworld.add(g);
    for (const sx of [-6, 6]) addMesh(g, new THREE.CylinderGeometry(0.4, 0.5, 8, 6), toon('#6c4a2f'), sx, 4, 0);
    addMesh(g, new THREE.BoxGeometry(18, 4.4, 0.8), toon('#6d4a2f'), 0, 8, 0);
    const l = labelSprite(text, sub, '#f3e5ba');
    l.position.set(0, 10.8, 0.6); l.scale.set(26, 6.5, 1); g.add(l);
  };
  signForest(-250, -310, 'BEGINNER’S FOREST', 'Rank F–S · 1000 × 1300 m');
  signForest(250, -520, 'MONSTER FOREST', 'Rank B–SS · 1000 × 1300 m');

  const beginnerTrees = buildForest({
    x0: -1250, x1: -250, z0: -1550, z1: -250, count: 1500,
    palette: { floor: '#7aa06a' }, name: 'Beginner’s Forest',
    clearings: [[-470, -420, 40], [-720, -820, 34], [-1060, -1320, 30], [-900, -1050, 60], [-460, -900, 50]]
  });
  const monsterTrees = buildForest({
    x0: 250, x1: 1250, z0: -1850, z1: -550, count: 1450,
    palette: { floor: '#5c745c' }, name: 'Monster Forest',
    clearings: [[560, -1180, 34], [1010, -1620, 30], [760, -900, 55], [1050, -1350, 50]]
  });

  // dark forest atmosphere props (dead trees / runestones)
  for (let i = 0; i < 16; i++) {
    const x = 300 + Math.random() * 900, z = -1800 + Math.random() * 1200;
    const h = 8 + Math.random() * 10;
    const t = addMesh(overworld, new THREE.CylinderGeometry(0.4, 1, h, 5), toon('#4f4a44'), x, h / 2, z);
    t.rotation.z = (Math.random() - 0.5) * 0.3;
    addMesh(overworld, new THREE.ConeGeometry(1, 3, 4), toon('#4f4a44'), x + 1, h - 2, z).rotation.z = 1.1;
  }
  // runestone circle in monster forest
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const x = 820 + Math.cos(a) * 22, z = -1420 + Math.sin(a) * 22;
    const stone = addMesh(overworld, new THREE.BoxGeometry(2.6, 8 + (i % 3) * 2, 1.6), toon('#5d5a62', { emissive: '#6d4fd0', emissiveIntensity: 0.12 }), x, 4, z);
    stone.rotation.y = -a;
    addMesh(overworld, new THREE.PlaneGeometry(0.8, 3), basic('#b48bff', { transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), x - Math.sin(a) * 0.9, 5, z - Math.cos(a) * 0.9).rotation.y = -a;
  }

  // ---------- mountains ----------
  (() => {
    const craggy = (r, h, seg = 9, jag = 0.22) => {
      const geo = new THREE.ConeGeometry(r, h, seg, 4, false);
      const pos = geo.attributes.position;
      const seeded = [];
      for (let i = 0; i < seg; i++) seeded.push(0.72 + Math.random() * 0.56);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (y > h / 2 - 0.01) continue;
        const a = Math.atan2(z, x);
        const band = Math.round(((a + Math.PI) / (Math.PI * 2)) * seg) % seg;
        const k = 1 + (seeded[band] - 1) * jag * (0.4 + 0.6 * (1 - (y + h / 2) / h));
        pos.setX(i, x * k);
        pos.setZ(i, z * k);
        pos.setY(i, y + (Math.random() - 0.5) * h * 0.03);
      }
      geo.computeVertexNormals();
      return geo;
    };
    const mk = (x, z, r, h, snow = true, tone = 0) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); overworld.add(g);
      const rock = ['#5b6e83', '#65788c', '#52657a'][tone % 3];
      const lit = ['#7b8ea2', '#8698ac', '#72859a'][tone % 3];
      const baseGeo = craggy(r, h, 9, 0.3);
      const base = new THREE.Mesh(baseGeo, toon(rock));
      base.position.y = h / 2 - 3; g.add(base);
      const midGeo = craggy(r * 0.6, h * 0.52, 8, 0.26);
      const mid = new THREE.Mesh(midGeo, toon(lit));
      mid.position.y = h * 0.66 - 3; g.add(mid);
      if (snow) {
        const capGeo = craggy(r * 0.42, h * 0.36, 7, 0.3);
        const cap = new THREE.Mesh(capGeo, toon('#f4f8fa'));
        cap.position.y = h * 0.84 - 3; g.add(cap);
        const cap2Geo = craggy(r * 0.24, h * 0.2, 6, 0.4);
        const cap2 = new THREE.Mesh(cap2Geo, toon('#ffffff'));
        cap2.position.y = h * 0.96 - 3; g.add(cap2);
      }
      // green foothills
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.random();
        const f = new THREE.Mesh(new THREE.ConeGeometry(r * (0.4 + Math.random() * 0.3), h * (0.2 + Math.random() * 0.16), 6), toon(tone % 2 ? '#5f8157' : '#6d8f60'));
        f.position.set(Math.cos(a) * r * 0.85, h * 0.1, Math.sin(a) * r * 0.85);
        g.add(f);
      }
    };
    for (let i = 0; i < 9; i++) mk(-1150 + i * 290, -1980 - (i % 3) * 90, 300 + (i % 4) * 50, 300 + (i % 5) * 60, true, i);
    for (let i = 0; i < 7; i++) mk(-1980 + i * 140, -600 + i * 320, 280 + (i % 3) * 40, 260 + (i % 4) * 60, true, i + 1);
    for (let i = 0; i < 7; i++) mk(1980 - i * 70, -800 + i * 320, 290 + (i % 3) * 40, 250 + (i % 5) * 50, true, i + 2);
    for (let i = 0; i < 5; i++) mk(-900 + i * 430, 1980 + (i % 2) * 80, 300, 240, i % 2 === 0, i);
    // hero skyline peaks visible from the capital
    mk(-230, -1760, 430, 310, true, 0);
    mk(30, -1980, 610, 430, true, 1);
    mk(330, -1780, 400, 280, true, 2);
    mk(-1480, -2150, 520, 390, true, 0);
    // distant blue ridges on the horizon
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      const r = 2450;
      const m = new THREE.Mesh(craggy(520 + Math.random() * 220, 360 + Math.random() * 150, 8, 0.3), toon(i % 2 ? '#8fa2b6' : '#9aacbe'));
      m.position.set(Math.cos(a) * r, 100, Math.sin(a) * r - 300);
      overworld.add(m);
    }
  })();

  // ---------- clouds & birds ----------
  const clouds = [];
  const cloudTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    const puffs = [[70, 78, 42], [110, 60, 52], [150, 72, 46], [190, 82, 34], [126, 92, 56]];
    for (const [px, py, r] of puffs) {
      const grd = g.createRadialGradient(px, py, r * 0.15, px, py, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.55, 'rgba(246,251,255,0.72)');
      grd.addColorStop(1, 'rgba(240,248,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  for (let i = 0; i < 14; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.62 + Math.random() * 0.22, depthWrite: false }));
    const sc = 260 + Math.random() * 220;
    spr.scale.set(sc, sc * 0.5, 1);
    spr.position.set(-1500 + Math.random() * 3000, 200 + Math.random() * 130, -1700 + Math.random() * 3000);
    overworld.add(spr);
    clouds.push({ g: spr, s: 2 + Math.random() * 4 });
  }
  animators.push((dt) => {
    for (const c of clouds) { c.g.position.x += dt * c.s; if (c.g.position.x > 1700) c.g.position.x = -1700; }
  });

  // avenue banners and lamps
  for (let i = 0; i < 8; i++) {
    const z = -255 + i * 74;
    for (const sx of [-21, 21]) {
      const g = new THREE.Group(); g.position.set(sx, 0, z); city.add(g);
      addMesh(g, new THREE.CylinderGeometry(0.18, 0.24, 10, 6), toon('#4c4034'), 0, 5, 0);
      addMesh(g, new THREE.SphereGeometry(0.32, 8, 6), toon('#ffedb4', { emissive: '#ffcf72', emissiveIntensity: 1.3 }), 0, 10.1, 0, false);
      const banner = addMesh(g, new THREE.PlaneGeometry(1.7, 4.6), toon(i % 2 ? '#3f5f96' : '#87413c', { side: THREE.DoubleSide }), sx < 0 ? 1.1 : -1.1, 6.6, 0);
      addMesh(g, new THREE.CircleGeometry(0.55, 10), toon('#e7cd86'), sx < 0 ? 1.15 : -1.15, 6.9, 0.04, false);
      animators.push((dt, t) => { banner.rotation.y = Math.sin(t * 1.2 + z * 0.1) * 0.12; });
    }
  }
  // planters, benches, street trees
  for (const [x, z] of [[-42, -38], [42, -38], [-42, 18], [42, 18], [-88, 84], [88, 84]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); city.add(g);
    addMesh(g, new THREE.BoxGeometry(3.2, 1.1, 3.2), toon('#8a7a62'), 0, 0.55, 0);
    addMesh(g, new THREE.BoxGeometry(2.6, 0.2, 2.6), toon('#4b3b2c'), 0, 1.15, 0);
    for (let k = 0; k < 5; k++) addMesh(g, new THREE.SphereGeometry(0.32, 6, 5), toon(['#d96b5f', '#e6b84f', '#b47fc4'][k % 3]), (Math.random() - 0.5) * 1.8, 1.35, (Math.random() - 0.5) * 1.8, false);
  }
  for (const [x, z, s] of [[-66, -98, 1.1], [66, -98, 1], [-66, 26, 0.9], [66, 26, 1.05], [-74, 172, 1], [74, 172, 0.9], [-118, 8, 0.85], [118, 8, 0.9]]) {
    makeSimpleTree(city, x, z, s, '#4f7f45');
  }

  // ---------- NPCs ----------
  const capitalNpcs = [
    { id: 'roderick', name: 'Captain Roderick', role: 'Royal Guard', x: 26, z: -54, palette: { robe: '#7a8b9b', trim: '#c8b06a', hair: '#4a3a2b' }, lines: ['The north gates stay open, but the roads do not stay safe. You look like you can change that.', 'Goblins are massing in the Beginner’s Forest. Prove yourself, and the Crown will notice.', 'The Guild is west of the fountain. Selene keeps the best contracts.'] },
    { id: 'selene', name: 'Guildmaster Selene', role: 'Guildmaster', x: -148, z: -62, palette: { robe: '#3f6b5f', trim: '#d8c68a', hair: '#d9d2c4' }, lines: ['New blood. Good. The board is full of work and thin on adventurers.', 'Whispering Hollow lies deep in the western woods. A goblin king squats on something older.', 'Clear it, and bring me the sigil. I will make sure the bards exaggerate properly.'] },
    { id: 'mira', name: 'Mira', role: 'Innkeeper', x: 148, z: -66, palette: { robe: '#8a4f50', trim: '#e0c287', hair: '#8a5a35' }, lines: ['A warm bed, a hot stew, and no questions. Five silver, and I will even pretend not to hear you sneak out at dawn.', 'They say the river has been running uphill on moonless nights. I say the river has better sense than most folk.'] },
    { id: 'torvald', name: 'Torvald', role: 'Blacksmith', x: 114, z: 136, palette: { robe: '#5f4a3a', trim: '#b9a37c', hair: '#4b3524' }, lines: ['Steel is honest. It breaks where you tell it to break.', 'Bring me monster bone and I will forge you something the guild will pretend not to envy.'] },
    { id: 'lysa', name: 'Lysa', role: 'Merchant', x: 8, z: 108, palette: { robe: '#8a6a8f', trim: '#e2c77f', hair: '#3d2b28' }, kind: 'shop', lines: ['Potions, tonics, and one very suspicious compass. No refunds on destiny.', 'A healer’s draught for the road? You look like a person who finds trouble on purpose.'] },
    { id: 'kael', name: 'Arena Master Kael', role: 'Warden of the Arena', x: -138, z: 182, palette: { robe: '#8d5a3a', trim: '#ccb277', hair: '#2f2620' }, lines: ['The arena is for those who think pain is a teacher. She is a patient teacher.', 'Come back when your blade sings instead of shouting. Then we will talk about the S-rank board.'] },
    { id: 'elara', name: 'High Priestess Elara', role: 'Keeper of the Palace', x: 0, z: -136, palette: { robe: '#566a9c', trim: '#e5d7a8', hair: '#efe8d6', hood: true }, lines: ['The palace remembers every oath sworn on its steps. Try to make yours worth remembering.', 'A darkness moves beneath the Monster Forest. It is not hungry. That is what frightens me.'] }
  ];
  capitalNpcs.forEach((n, i) => {
    const mesh = buildNpcModel(n.palette);
    mesh.position.set(n.x, 0, n.z);
    mesh.rotation.y = -0.4 + (i % 3) * 0.5;
    overworld.add(mesh);
    npcs.push({ data: n, mesh });
    // ambient halo prompt
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 24), basic('#e8d28a', { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(n.x, 0.16, n.z);
    overworld.add(ring);
    animators.push((dt, t) => { ring.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.08); });
  });

  // quest markers
  const questMarkTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.translate(64, 64); g.rotate(Math.PI / 4);
    g.fillStyle = 'rgba(12,20,19,.92)'; g.fillRect(-31, -31, 62, 62);
    g.strokeStyle = '#e8cf8e'; g.lineWidth = 5; g.strokeRect(-31, -31, 62, 62);
    g.rotate(-Math.PI / 4); g.fillStyle = '#f3dfa6'; g.font = '700 52px Cinzel, Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, 4);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  for (const [mx, mz] of [[26, -54], [-148, -62]]) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: questMarkTex, transparent: true, depthWrite: false }));
    spr.scale.set(2.6, 2.6, 1); spr.position.set(mx, 7.4, mz);
    overworld.add(spr);
    animators.push((dt, t) => { spr.position.y = 7.4 + Math.sin(t * 2.2 + mx) * 0.22; });
  }

  // wandering citizens
  for (let i = 0; i < 6; i++) {
    const mesh = buildNpcModel({ robe: ['#6b7d8a', '#7c6a4f', '#5f7a61'][i % 3], hair: ['#4a3528', '#8a6a40', '#2f2b26'][i % 3] });
    const a = i * 1.1;
    mesh.position.set(Math.cos(a) * 60, 0, Math.sin(a) * 55 + 10);
    overworld.add(mesh);
    const npc = { data: { id: 'citizen' + i, name: ['Aria', 'Benn', 'Cora', 'Dax', 'Elsie', 'Finn'][i], role: 'Citizen', x: mesh.position.x, z: mesh.position.z, lines: ['The palace bells rang three times last night. No one will say why.', 'If you are heading north, take the east road. The river bridge is still standing—mostly.', 'I heard a mage in the market say the sky felt thin. He was very drunk.'], kind: 'flavor' }, mesh, wander: { a, r: 24 + i * 4, speed: 0.06 + i * 0.01 } };
    npcs.push(npc);
  }

  // ---------- dungeon interiors ----------
  const dungeonInteriors = {};
  const torchGeo = new THREE.ConeGeometry(0.4, 1.3, 6);
  Object.values(DUNGEONS).forEach((d, di) => {
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const theme = new THREE.Color(d.palette);
    const stone = toon(d.palette);
    const darkStone = toon(theme.clone().multiplyScalar(0.55));
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(28, 29, 1.4, 32), stone);
    floor.position.y = -0.7; floor.receiveShadow = true; g.add(floor);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 0.12, 32), toon('#141218'));
    inner.position.y = 0.03; g.add(inner);
    // walls
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 18, 24, 1, true), new THREE.MeshToonMaterial({ color: theme, side: THREE.BackSide }));
    wall.position.y = 8; g.add(wall);
    // pillars
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const x = Math.cos(a) * 22, z = Math.sin(a) * 22;
      addMesh(g, new THREE.CylinderGeometry(1.4, 1.8, 16, 8), darkStone, x, 8, z);
      addMesh(g, new THREE.BoxGeometry(4.2, 0.7, 4.2), stone, x, 16.2, z);
    }
    // dais
    addMesh(g, new THREE.CylinderGeometry(9, 10, 1.2, 16), stone, 0, 0.5, -15);
    addMesh(g, new THREE.TorusGeometry(7.2, 0.18, 6, 40), basic('#c9a8ff', { transparent: true, opacity: 0.35, side: THREE.DoubleSide }), 0, 1.18, -15).rotation.x = -Math.PI / 2;
    // gloom-piercing shaft of light above the boss dais
    const godRay = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 7.5, 22, 20, 1, true), basic(di % 2 ? '#7fd8ff' : '#b79bff', { transparent: true, opacity: 0.07, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    godRay.position.set(0, 11, -15); g.add(godRay);
    const daisLight = new THREE.PointLight(di % 2 ? '#9fe6ff' : '#c3a3ff', 3.2, 30, 1.7);
    daisLight.position.set(0, 12, -15); g.add(daisLight);
    animators.push((dt, t) => { godRay.material.opacity = 0.05 + Math.sin(t * 1.1) * 0.02; });
    // braziers
    const flames = [];
    for (const [x, z] of [[-15, 2], [15, 2], [-10, -24], [10, -24]]) {
      addMesh(g, new THREE.CylinderGeometry(0.8, 1.1, 1.4, 8), darkStone, x, 1.7, z);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 6), basic(di % 2 ? '#ff9a4a' : '#8ce0ff', { transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      fl.position.set(x, 3.4, z); g.add(fl);
      const pl = new THREE.PointLight(di % 2 ? '#ff9a4a' : '#7bd8ff', 3.4, 22, 1.6); pl.position.set(x, 4, z); g.add(pl);
      flames.push(fl);
    }
    animators.push((dt, t) => { flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 6 + i) * 0.2; f.scale.x = 1 + Math.cos(t * 5 + i) * 0.1; }); });
    // bones
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * 36, z = (Math.random() - 0.5) * 36;
      addMesh(g, new THREE.BoxGeometry(0.3, 0.25, 1.6), toon('#cfc6ae'), x, 0.2, z).rotation.y = Math.random() * 3;
    }
    // exit portal
    const exit = new THREE.Group(); exit.position.set(0, 0, 24); g.add(exit);
    addMesh(exit, new THREE.TorusGeometry(3.6, 0.38, 6, 24), toon('#7f8ba0'), 0, 4.2, 0);
    const exitDisc = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 6.2), new THREE.MeshBasicMaterial({ map: portalTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: '#7fa6d6', opacity: 0.75 }));
    exitDisc.position.set(0, 4.2, 0.2); exit.add(exitDisc);
    const exitLight = new THREE.PointLight('#89b7ff', 2.2, 18, 1.8); exitLight.position.set(0, 4, 2); exit.add(exitLight);
    addMesh(g, new THREE.BoxGeometry(5.5, 1.4, 5.5), stone, 0, 0.7, 24);
    // ambient wall torches give the chamber readable silhouettes
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const x = Math.cos(a) * 27.5, z = Math.sin(a) * 27.5;
      const sconce = addMesh(g, new THREE.BoxGeometry(0.8, 0.8, 0.8), darkStone, x, 6.2, z, false);
      sconce.lookAt(0, 6.2, 0);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 5), basic(di % 2 ? '#ffb066' : '#9fe6ff', { transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      fl.position.set(x, 7.2, z); g.add(fl);
      flames.push(fl);
    }
    // ambiance particles
    const pGeo = new THREE.BufferGeometry();
    const pts = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) { pts[i * 3] = (Math.random() - 0.5) * 44; pts[i * 3 + 1] = Math.random() * 12; pts[i * 3 + 2] = (Math.random() - 0.5) * 44; }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const dust = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: d.id === 'sanctum' ? '#b49aff' : '#9fd8c9', size: 0.22, transparent: true, opacity: 0.6, depthWrite: false }));
    g.add(dust);
    animators.push((dt, t) => { dust.position.y = Math.sin(t * 0.4) * 0.8; });
    dungeonInteriors[d.id] = {
      group: g, bossPos: new THREE.Vector3(0, 0, -14), exitPos: new THREE.Vector3(0, 0, 24),
      spawnPos: new THREE.Vector3(0, 0, 7), data: d,
      minionSpawns: [[-15, -6], [15, -6], [-20, 8], [20, 8], [0, -22]]
    };
  });

  // ---------- public helpers / data ----------
  const spawnZones = {
    beginner: { x0: -1230, x1: -270, z0: -1530, z1: -270, trees: beginnerTrees, name: 'Beginner’s Forest', rank: 'F–S', kind: 'beginner' },
    monster: { x0: 270, x1: 1230, z0: -1830, z1: -570, trees: monsterTrees, name: 'Monster Forest', rank: 'B–SS', kind: 'monster' }
  };

  const pois = [
    { name: 'Royal Capital', x: 0, z: 0, kind: 'city' },
    ...VILLAGES.map(v => ({ name: v.name, x: v.x, z: v.z, kind: 'village' })),
    ...Object.values(DUNGEONS).map(d => ({ name: d.name, x: d.x, z: d.z, kind: 'dungeon', rank: d.rank, id: d.id }))
  ];

  return {
    root, overworld, colliders, npcs, portals, dungeonInteriors, spawnZones, villages, pois, labels,
    update(dt, t) {
      waterUniforms.time.value = t;
      for (const fn of animators) fn(dt, t);
      for (const n of npcs) {
        if (n.wander) {
          n.wander.a += dt * n.wander.speed;
          const x = Math.cos(n.wander.a) * n.wander.r, z = Math.sin(n.wander.a) * n.wander.r + 10;
          n.mesh.position.set(x, 0, z);
          n.mesh.rotation.y = -n.wander.a + Math.PI / 2;
          n.data.x = x; n.data.z = z;
        } else if (n.mesh.userData.anim) {
          const a = n.mesh.userData.anim;
          n.mesh.position.y = Math.sin(t * 1.4 + a.phase) * 0.03;
          a.head.rotation.y = Math.sin(t * 0.7 + a.phase) * 0.25;
        }
      }
    }
  };
}
