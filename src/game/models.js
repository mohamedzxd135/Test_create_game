import * as THREE from 'three';

const gradient = (() => {
  const data = new Uint8Array([80, 122, 164, 201, 228, 251]);
  const tex = new THREE.DataTexture(data, 6, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

export function blobShadow(radius = 0.9, opacity = 0.6) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: 0x000000, opacity })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.035;
  m.renderOrder = 1;
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

export function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color, gradientMap: gradient,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true
  });
}

export function basic(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide, blending: opts.blending ?? THREE.NormalBlending, depthWrite: opts.depthWrite ?? true });
}

export function addMesh(parent, geo, mat, x, y, z, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

export function labelSprite(text, sub = '', color = '#f3e6bd') {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 160;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 640, 160);
  g.textAlign = 'center';
  g.font = '600 48px Cinzel, Georgia, serif';
  g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 14;
  g.fillStyle = color;
  g.fillText(text, 320, sub ? 66 : 96);
  if (sub) {
    g.font = '500 25px Cinzel, Georgia, serif';
    g.fillStyle = 'rgba(235,225,198,.78)';
    g.fillText(sub, 320, 108);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.set(19, 4.75, 1);
  return spr;
}

function limb(parent, w, h, d, mat, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  const mesh = addMesh(pivot, new THREE.BoxGeometry(w, h, d), mat, 0, -h / 2, 0);
  mesh.geometry.translate(0, 0, 0);
  return pivot;
}

function capeMesh(color, w = 0.95, h = 1.55) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w * 0.7, -h); shape.lineTo(-w * 0.7, -h); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const m = new THREE.Mesh(geo, toon(color, { side: THREE.DoubleSide }));
  m.position.set(0, 1.76, -0.33);
  m.rotation.x = 0.1;
  m.rotation.y = Math.PI;
  return m;
}

export function buildPlayerModel(classId) {
  const c = classId;
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const isMage = c === 'mage', isArcher = c === 'archer';
  const skin = toon('#f2c49b');
  const main = isMage ? toon('#4e5bb5') : isArcher ? toon('#3f8a5e') : toon('#c9ced8');
  const dark = isMage ? toon('#2b3278') : isArcher ? toon('#285b3f') : toon('#747d8b');
  const accent = isMage ? toon('#d9c68c') : isArcher ? toon('#b58a4f') : toon('#dcae57');
  const cloth = isMage ? toon('#6a74c9') : isArcher ? toon('#5fae78') : toon('#9f3c3c');

  const legs = new THREE.Group();
  rig.add(legs);
  const legL = limb(legs, 0.19, 0.95, 0.21, dark, -0.16, 1.02, 0);
  legL.rotation.x = 0;
  const legR = limb(legs, 0.19, 0.95, 0.21, dark, 0.16, 1.02, 0);
  // boots
  addMesh(legL, new THREE.BoxGeometry(0.22, 0.25, 0.34), toon('#3a302a'), 0, -0.9, 0.06);
  addMesh(legR, new THREE.BoxGeometry(0.22, 0.25, 0.34), toon('#3a302a'), 0, -0.9, 0.06);

  const torso = new THREE.Group();
  rig.add(torso);
  const chest = addMesh(torso, new THREE.CapsuleGeometry(0.31, 0.5, 4, 8), main, 0, 1.42, 0);
  chest.scale.set(1, 1, 0.75);
  if (!isMage) {
    const skirt = addMesh(torso, new THREE.ConeGeometry(0.46, 0.6, 8, 1, true), cloth, 0, 1.03, 0);
    skirt.scale.z = 0.8;
  } else {
    const robe = addMesh(torso, new THREE.ConeGeometry(0.5, 1.15, 10, 1, true), main, 0, 0.85, 0);
    robe.scale.z = 0.85;
  }
  addMesh(torso, new THREE.BoxGeometry(0.62, 0.12, 0.44), accent, 0, 1.24, 0);
  // shoulder pads
  if (!isMage) {
    const padG = new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    addMesh(torso, padG, accent, -0.36, 1.66, 0);
    addMesh(torso, padG, accent, 0.36, 1.66, 0);
  }

  const arms = new THREE.Group();
  rig.add(arms);
  const armL = limb(arms, 0.16, 0.7, 0.17, main, -0.38, 1.66, 0);
  const armR = limb(arms, 0.16, 0.7, 0.17, main, 0.38, 1.66, 0);
  addMesh(armL, new THREE.SphereGeometry(0.11, 8, 6), skin, 0, -0.7, 0);
  const handR = addMesh(armR, new THREE.SphereGeometry(0.11, 8, 6), skin, 0, -0.7, 0);

  const head = new THREE.Group();
  head.position.y = 2.02;
  rig.add(head);
  const skull = addMesh(head, new THREE.SphereGeometry(0.34, 14, 12), skin, 0, 0, 0);
  skull.scale.set(1, 1.06, 0.95);
  if (isMage) {
    const hatBrim = addMesh(head, new THREE.CylinderGeometry(0.58, 0.58, 0.07, 14), toon('#39407e'), 0, 0.26, 0);
    const hat = addMesh(head, new THREE.ConeGeometry(0.34, 0.95, 10), toon('#4d59ac'), 0, 0.74, 0);
    hat.rotation.z = 0.08;
    addMesh(head, new THREE.TorusGeometry(0.3, 0.045, 6, 14), accent, 0, 0.4, 0).rotation.x = Math.PI / 2;
  } else if (isArcher) {
    const hood = addMesh(head, new THREE.SphereGeometry(0.42, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), toon('#2c6349'), 0, 0.08, -0.03);
    hood.rotation.x = 0.04;
    const hoodTip = addMesh(head, new THREE.ConeGeometry(0.17, 0.5, 5), toon('#2c6349'), 0, 0.26, -0.26);
    hoodTip.rotation.x = -0.85;
    const hair = addMesh(head, new THREE.SphereGeometry(0.35, 10, 8), toon('#b8763f'), 0, 0.09, -0.03);
    hair.scale.set(1, 0.75, 0.95);
    addMesh(head, new THREE.BoxGeometry(0.13, 0.5, 0.13), toon('#b8763f'), -0.28, -0.1, 0.16).rotation.z = 0.2;
  } else {
    const hair = addMesh(head, new THREE.SphereGeometry(0.37, 12, 10), toon('#6a3a22'), 0, 0.1, -0.06);
    hair.scale.set(1.04, 0.82, 0.94);
    addMesh(head, new THREE.BoxGeometry(0.1, 0.46, 0.12), toon('#6a3a22'), 0.3, -0.08, 0.12).rotation.z = -0.16;
    // circlet
    addMesh(head, new THREE.TorusGeometry(0.33, 0.035, 6, 16), accent, 0, 0.15, 0).rotation.x = Math.PI / 2;
  }
  // eyes
  const eyeMat = basic('#24303a');
  addMesh(head, new THREE.SphereGeometry(0.052, 6, 4), eyeMat, -0.115, 0.02, 0.31, false);
  addMesh(head, new THREE.SphereGeometry(0.052, 6, 4), eyeMat, 0.115, 0.02, 0.31, false);
  addMesh(head, new THREE.BoxGeometry(0.1, 0.018, 0.02), toon('#8b5c4b'), 0, -0.13, 0.315, false);

  const cape = isMage ? null : isArcher ? null : capeMesh('#8f3232', 0.62, 1.08);
  if (cape) rig.add(cape);

  let weapon = null;
  const hollow = new THREE.Group();
  handR.add(hollow);
  hollow.position.set(0, -0.68, 0.05);

  if (c === 'swordsman') {
    const sword = new THREE.Group();
    hollow.add(sword);
    sword.rotation.z = -0.28;
    sword.rotation.x = 0.15;
    addMesh(sword, new THREE.CylinderGeometry(0.055, 0.055, 0.42, 8), toon('#5a3a23'), 0, 0.1, 0);
    addMesh(sword, new THREE.SphereGeometry(0.08, 8, 6), accent, 0, -0.12, 0);
    addMesh(sword, new THREE.BoxGeometry(0.52, 0.09, 0.12), accent, 0, 0.34, 0);
    const blade = addMesh(sword, new THREE.BoxGeometry(0.16, 1.28, 0.05), toon('#b9c7d6', { emissive: '#3e4f63', emissiveIntensity: 0.18 }), 0, 1.02, 0);
    addMesh(sword, new THREE.BoxGeometry(0.045, 1.22, 0.056), toon('#7f90a2'), 0, 1.02, 0.012, false);
    addMesh(sword, new THREE.ConeGeometry(0.115, 0.26, 4), toon('#cddae6', { emissive: '#6f8296', emissiveIntensity: .22 }), 0, 1.78, 0);
    addMesh(sword, new THREE.SphereGeometry(0.075, 8, 6), toon('#e8c878', { emissive: '#9c7a35', emissiveIntensity: .5 }), 0, 0.73, 0.06, false);
    weapon = sword;
  } else if (c === 'archer') {
    const bow = new THREE.Group();
    hollow.add(bow);
    bow.rotation.y = 1.0;
    bow.position.y = 0.24;
    bow.scale.setScalar(1.12);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.055, 6, 20, Math.PI * 1.15), toon('#9a6436'));
    arc.rotation.z = -Math.PI * 0.575;
    arc.castShadow = true;
    bow.add(arc);
    const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.82, 0), new THREE.Vector3(0, -0.82, 0)]);
    bow.add(new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: '#efe4c5' })));
    const quiver = new THREE.Group();
    quiver.position.set(-0.2, 1.5, -0.36);
    quiver.rotation.z = 0.32;
    quiver.rotation.x = -0.18;
    rig.add(quiver);
    addMesh(quiver, new THREE.CylinderGeometry(0.16, 0.13, 0.8, 8), toon('#5b3a24'), 0, 0, 0);
    for (let i = 0; i < 3; i++) addMesh(quiver, new THREE.CylinderGeometry(0.018, 0.018, 0.75, 4), toon('#e6dcc0'), (i - 1) * 0.06, 0.45, 0);
    weapon = bow;
  } else {
    const staff = new THREE.Group();
    hollow.add(staff);
    staff.position.y = 0.15;
    addMesh(staff, new THREE.CylinderGeometry(0.045, 0.055, 2.05, 8), toon('#7a5a39'), 0, 0, 0);
    const orb = addMesh(staff, new THREE.SphereGeometry(0.17, 14, 12), toon('#aab6ff', { emissive: '#6a7bff', emissiveIntensity: 2.4 }), 0, 1.1, 0, false);
    addMesh(staff, new THREE.TorusGeometry(0.27, 0.028, 6, 18), accent, 0, 1.1, 0).rotation.x = Math.PI / 2.4;
    addMesh(staff, new THREE.TorusGeometry(0.34, 0.02, 6, 18), accent, 0, 1.1, 0).rotation.y = Math.PI / 3;
    staff.userData.orb = orb;
    weapon = staff;
  }

  // back details so each class reads from behind
  if (c === 'swordsman') {
    const shield = new THREE.Group(); shield.position.set(0, 1.42, -0.38); shield.rotation.y = Math.PI; rig.add(shield);
    addMesh(shield, new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18), toon('#9ba4af'), 0, 0, 0).rotation.x = Math.PI / 2;
    addMesh(shield, new THREE.TorusGeometry(0.42, 0.055, 6, 20), toon('#d8b463'), 0, 0, 0.03);
    addMesh(shield, new THREE.CircleGeometry(0.14, 12), toon('#d8b463'), 0, 0, 0.055, false);
    addMesh(shield, new THREE.BoxGeometry(0.03, 0.72, 0.03), toon('#6a5a3c'), 0, 0, 0.06, false);
  } else if (c === 'archer') {
    addMesh(rig, new THREE.BoxGeometry(0.06, 0.9, 0.04), toon('#7a5232'), -0.14, 1.36, -0.33).rotation.z = 0.55;
    addMesh(rig, new THREE.BoxGeometry(0.06, 0.9, 0.04), toon('#7a5232'), 0.14, 1.36, -0.34).rotation.z = -0.55;
    addMesh(rig, new THREE.BoxGeometry(0.28, 0.16, 0.06), toon('#c9a55e'), 0, 1.12, -0.36);
  } else {
    addMesh(rig, new THREE.TorusGeometry(0.24, 0.035, 6, 18), toon('#e5cc84', { emissive: '#9b7c35', emissiveIntensity: .4 }), 0, 1.4, -0.36).rotation.y = Math.PI;
    addMesh(rig, new THREE.CircleGeometry(0.13, 10), toon('#8a7bd8', { emissive: '#5e52b0', emissiveIntensity: .6 }), 0, 1.4, -0.365, false).rotation.y = Math.PI;
  }

  root.scale.setScalar(1.12);
  root.add(blobShadow(0.78));
  root.userData.anim = { rig, legs, legL, legR, armL, armR, torso, head, cape, weapon, phase: Math.random() * 6, attack: 0 };
  root.traverse(o => { if (o.isMesh && o.material.map !== shadowTex) { o.castShadow = true; } });
  return root;
}

export function buildEnemyModel(type, scale = 1) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const anim = { rig, legs: [], arms: [], phase: Math.random() * 9, kind: 'biped', hover: false };
  const add = (parent, geo, mat, x, y, z) => addMesh(parent, geo, mat, x, y, z);

  if (type === 'goblin' || type === 'goblinking') {
    const king = type === 'goblinking';
    const skinC = king ? '#6f8d45' : '#7fa356';
    const skin = toon(skinC);
    const cloth = toon(king ? '#8a3d63' : '#7d5236');
    const legs = new THREE.Group(); rig.add(legs);
    const l = limb(legs, 0.13, 0.55, 0.14, cloth, -0.15, 0.7, 0);
    const r = limb(legs, 0.13, 0.55, 0.14, cloth, 0.15, 0.7, 0);
    anim.legs.push(l, r);
    const body = add(rig, new THREE.CapsuleGeometry(0.28, 0.42, 4, 8), cloth, 0, 1.0, 0);
    body.scale.z = 0.85;
    const head = new THREE.Group(); head.position.y = 1.62; rig.add(head);
    const skull = add(head, new THREE.SphereGeometry(0.3, 10, 8), skin, 0, 0, 0);
    skull.scale.set(1, 0.95, 0.9);
    // ears
    const earG = new THREE.ConeGeometry(0.09, 0.42, 4);
    const eL = add(head, earG, skin, -0.32, 0.04, 0); eL.rotation.z = Math.PI / 2.2;
    const eR = add(head, earG, skin, 0.32, 0.04, 0); eR.rotation.z = -Math.PI / 2.2;
    add(head, new THREE.SphereGeometry(0.055, 6, 4), basic('#ffd84a'), -0.11, 0.03, 0.27, false);
    add(head, new THREE.SphereGeometry(0.055, 6, 4), basic('#ffd84a'), 0.11, 0.03, 0.27, false);
    add(head, new THREE.ConeGeometry(0.05, 0.12, 4), toon('#e8d5a8'), 0, -0.12, 0.29).rotation.x = 0.4;
    if (king) {
      add(head, new THREE.CylinderGeometry(0.24, 0.28, 0.14, 8), toon('#e0b74e'), 0, 0.29, 0);
      for (let i = 0; i < 5; i++) {
        const spike = add(head, new THREE.ConeGeometry(0.05, 0.18, 4), toon('#f2d476'), 0, 0.41, 0);
        spike.position.x = -0.19 + i * 0.095;
      }
      const cape = capeMesh('#6a2b49', 1.15, 1.5);
      cape.position.set(0, 1.72, -0.34);
      rig.add(cape);
      // fur mantle + belt to break up the silhouette
      add(rig, new THREE.TorusGeometry(0.3, 0.1, 6, 14), toon('#4b4a44'), 0, 1.35, 0).rotation.x = Math.PI / 2;
      add(rig, new THREE.BoxGeometry(0.6, 0.12, 0.5), toon('#d8b45c'), 0, 0.82, 0);
    }
    const armL = limb(rig, 0.14, 0.62, 0.15, skin, -0.36, 1.32, 0);
    const armR = limb(rig, 0.14, 0.62, 0.15, skin, 0.36, 1.32, 0);
    anim.arms.push(armL, armR);
    // club / axe
    const club = new THREE.Group(); armR.add(club); club.position.y = -0.62;
    add(club, new THREE.CylinderGeometry(0.05, 0.07, 0.7, 6), toon('#6d4a2c'), 0, 0, 0);
    add(club, new THREE.SphereGeometry(0.16, 8, 6), toon(king ? '#9a6a3b' : '#7d5330'), 0, 0.38, 0);
    if (king) {
      add(club, new THREE.ConeGeometry(0.09, 0.22, 5), toon('#c9d1d6'), 0.12, 0.5, 0);
      add(club, new THREE.ConeGeometry(0.07, 0.2, 5), toon('#c9d1d6'), -0.12, 0.46, 0);
    }
    root.scale.setScalar(scale * (king ? 2.3 : 1.05));
    anim.kind = 'biped';
  } else if (type === 'wolf' || type === 'direwolf') {
    const dire = type === 'direwolf';
    const fur = toon(dire ? '#3d4351' : '#6f6d63');
    const dark = toon(dire ? '#262a34' : '#56544b');
    const body = add(rig, new THREE.CapsuleGeometry(0.36, 0.85, 4, 8), fur, 0, 0.86, 0);
    body.rotation.x = Math.PI / 2;
    const head = new THREE.Group(); head.position.set(0, 1.0, 0.82); rig.add(head);
    const skull = add(head, new THREE.BoxGeometry(0.42, 0.38, 0.5), fur, 0, 0, 0);
    add(head, new THREE.BoxGeometry(0.26, 0.2, 0.34), dark, 0, -0.08, 0.36);
    const earG = new THREE.ConeGeometry(0.1, 0.28, 4);
    add(head, earG, dark, -0.16, 0.26, -0.05);
    add(head, earG, dark, 0.16, 0.26, -0.05);
    add(head, new THREE.SphereGeometry(0.045, 6, 4), basic(dire ? '#ff5f5f' : '#ffd45c'), -0.11, 0.06, 0.25, false);
    add(head, new THREE.SphereGeometry(0.045, 6, 4), basic(dire ? '#ff5f5f' : '#ffd45c'), 0.11, 0.06, 0.25, false);
    const legPos = [[-0.24, 0.26], [0.24, 0.26], [-0.24, -0.34], [0.24, -0.34]];
    legPos.forEach(([x, z]) => {
      const p = limb(rig, 0.12, 0.68, 0.13, dark, x, 0.76, z);
      anim.legs.push(p);
    });
    const tail = add(rig, new THREE.ConeGeometry(0.11, 0.7, 6), fur, 0, 0.98, -0.7);
    tail.rotation.x = -1.0;
    anim.tail = tail;
    if (dire) {
      for (let i = 0; i < 4; i++) {
        const spike = add(rig, new THREE.ConeGeometry(0.07, 0.32, 4), toon('#d8d2bd'), 0, 1.22, 0.25 - i * 0.25);
      }
      root.scale.setScalar(scale * 1.5);
    } else root.scale.setScalar(scale * 1.08);
    anim.kind = 'quad';
  } else if (type === 'orc' || type === 'ogre') {
    const ogre = type === 'ogre';
    const skinC = ogre ? '#6d787e' : '#7a8d4f';
    const skin = toon(skinC);
    const cloth = toon(ogre ? '#4b3d58' : '#6b4634');
    const legs = new THREE.Group(); rig.add(legs);
    const l = limb(legs, 0.25, 0.8, 0.27, cloth, -0.25, 1.0, 0);
    const r = limb(legs, 0.25, 0.8, 0.27, cloth, 0.25, 1.0, 0);
    anim.legs.push(l, r);
    const torso = add(rig, new THREE.CapsuleGeometry(0.48, 0.7, 4, 8), skin, 0, 1.62, 0);
    torso.scale.z = 0.8;
    add(rig, new THREE.SphereGeometry(0.34, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(ogre ? '#8d99a0' : '#9a6a45'), -0.5, 2.0, 0);
    add(rig, new THREE.SphereGeometry(0.34, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(ogre ? '#8d99a0' : '#9a6a45'), 0.5, 2.0, 0);
    const head = new THREE.Group(); head.position.y = 2.4; rig.add(head);
    add(head, new THREE.BoxGeometry(0.5, 0.5, 0.48), skin, 0, 0, 0);
    add(head, new THREE.ConeGeometry(0.06, 0.16, 4), toon('#e8dcc0'), -0.16, -0.2, 0.24);
    add(head, new THREE.ConeGeometry(0.06, 0.16, 4), toon('#e8dcc0'), 0.16, -0.2, 0.24);
    add(head, new THREE.SphereGeometry(0.05, 6, 4), basic('#ffb347'), -0.13, 0.08, 0.25, false);
    add(head, new THREE.SphereGeometry(0.05, 6, 4), basic('#ffb347'), 0.13, 0.08, 0.25, false);
    if (ogre) {
      add(head, new THREE.CylinderGeometry(0.2, 0.25, 0.2, 6), toon('#3a2f46'), 0, 0.32, 0);
      const horn = new THREE.ConeGeometry(0.08, 0.4, 5);
      add(head, horn, toon('#d8d4c4'), -0.18, 0.4, 0).rotation.z = 0.4;
      add(head, horn, toon('#d8d4c4'), 0.18, 0.4, 0).rotation.z = -0.4;
    }
    const armL = limb(rig, 0.2, 0.9, 0.22, skin, -0.6, 2.0, 0);
    const armR = limb(rig, 0.2, 0.9, 0.22, skin, 0.6, 2.0, 0);
    anim.arms.push(armL, armR);
    const weapon = new THREE.Group(); armR.add(weapon); weapon.position.y = -0.86;
    add(weapon, new THREE.CylinderGeometry(0.06, 0.08, 1.0, 6), toon('#5f4329'), 0, 0, 0);
    const headAxe = add(weapon, new THREE.BoxGeometry(0.5, 0.42, 0.1), toon('#a7b1b8'), 0.26, 0.36, 0);
    headAxe.rotation.z = -0.2;
    if (ogre) {
      add(weapon, new THREE.ConeGeometry(0.06, 0.24, 4), toon('#d6d0bc'), -0.16, 0.56, 0);
      add(weapon, new THREE.ConeGeometry(0.06, 0.24, 4), toon('#d6d0bc'), 0.22, 0.62, 0);
    }
    root.scale.setScalar(scale * (ogre ? 1.5 : 1.15));
    anim.kind = 'biped';
  } else if (type === 'wraith' || type === 'lich') {
    const lich = type === 'lich';
    const robe = toon(lich ? '#3c2f63' : '#4e5478');
    const trim = toon(lich ? '#c4a7ff' : '#9aa4d8');
    const body = add(rig, new THREE.ConeGeometry(0.55, 1.75, 8, 1, true), robe, 0, 1.05, 0);
    const hood = add(rig, new THREE.SphereGeometry(0.42, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.7), robe, 0, 2.0, 0);
    const face = add(rig, new THREE.SphereGeometry(0.24, 8, 6), toon('#1a1b2a'), 0, 1.94, 0.12, false);
    const eyeMat = basic(lich ? '#c58bff' : '#7ff0ff');
    add(rig, new THREE.SphereGeometry(0.05, 6, 4), eyeMat, -0.09, 1.98, 0.32, false);
    add(rig, new THREE.SphereGeometry(0.05, 6, 4), eyeMat, 0.09, 1.98, 0.32, false);
    add(rig, new THREE.TorusGeometry(0.55, 0.05, 6, 18), trim, 0, 1.7, 0).rotation.x = Math.PI / 2;
    const armL = limb(rig, 0.13, 0.55, 0.14, robe, -0.5, 1.65, 0);
    const armR = limb(rig, 0.13, 0.55, 0.14, robe, 0.5, 1.65, 0);
    anim.arms.push(armL, armR);
    const staff = new THREE.Group(); armR.add(staff); staff.position.y = -0.55;
    add(staff, new THREE.CylinderGeometry(0.035, 0.045, 1.7, 6), toon('#4a3c56'), 0, 0.2, 0);
    add(staff, new THREE.OctahedronGeometry(0.17), toon(lich ? '#c48bff' : '#76e5ff', { emissive: lich ? '#7d4bd6' : '#3a9ec9', emissiveIntensity: 2 }), 0, 1.15, 0, false);
    if (lich) {
      const crown = add(rig, new THREE.CylinderGeometry(0.3, 0.34, 0.16, 6, 1, true), toon('#d8bc6a'), 0, 2.38, 0);
      for (let i = 0; i < 4; i++) {
        const s = add(rig, new THREE.ConeGeometry(0.05, 0.25, 4), toon('#e6d28c'), 0, 2.56, 0);
        s.position.x = -0.18 + i * 0.12;
      }
    }
    root.scale.setScalar(scale * (lich ? 1.9 : 1.15));
    anim.kind = 'float';
    anim.hover = true;
  } else {
    // fallback shade
    add(rig, new THREE.ConeGeometry(0.5, 2.2, 8), toon('#444'), 0, 1.1, 0);
    root.scale.setScalar(scale);
  }
  root.add(blobShadow(0.92));
  root.traverse(o => { if (o.isMesh && o.material?.map !== shadowTex) o.castShadow = true; });
  root.userData.anim = anim;
  return root;
}

export function buildNpcModel(palette = {}) {
  const root = new THREE.Group();
  const robe = toon(palette.robe ?? '#7a6a4e');
  const skin = toon('#efc39a');
  const trim = toon(palette.trim ?? '#c8b06a');
  const body = addMesh(root, new THREE.ConeGeometry(0.44, 1.6, 8, 1, true), robe, 0, 0.85, 0);
  const head = addMesh(root, new THREE.SphereGeometry(0.3, 10, 8), skin, 0, 1.85, 0);
  const hair = addMesh(root, new THREE.SphereGeometry(0.32, 10, 8), toon(palette.hair ?? '#5b3d2b'), 0, 1.95, 0.03);
  hair.scale.set(1, 0.7, 0.95);
  addMesh(root, new THREE.CylinderGeometry(0.46, 0.46, 0.07, 12), trim, 0, 1.35, 0);
  addMesh(root, new THREE.SphereGeometry(0.05, 6, 4), basic('#2a3036'), -0.1, 1.85, 0.27, false);
  addMesh(root, new THREE.SphereGeometry(0.05, 6, 4), basic('#2a3036'), 0.1, 1.85, 0.27, false);
  if (palette.hood) {
    const hood = addMesh(root, new THREE.SphereGeometry(0.38, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.7), robe, 0, 1.9, 0);
  }
  root.add(blobShadow(0.72, 0.5));
  root.userData.anim = { kind: 'npc', phase: Math.random() * 8, head, body };
  root.traverse(o => { if (o.isMesh && o.material?.map !== shadowTex) o.castShadow = true; });
  return root;
}
