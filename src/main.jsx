import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { CLASSES, VILLAGES, DUNGEONS } from './game/data.js';
import { buildPlayerModel } from './game/models.js';
import { Game } from './game/engine.js';
import './style.css';

/* ---------------- shared bits ---------------- */

const GLYPHS = {
  sun: <><circle cx="24" cy="24" r="8" /><path d="M24 4v7M24 37v7M4 24h7M37 24h7M10 10l5 5M33 33l5 5M38 10l-5 5M15 33l-5 5" /></>,
  shield: <><path d="M24 5l14 5v11c0 11-7 17-14 21C17 38 10 32 10 21V10z" /><path d="M24 13v17M16 22h16" /></>,
  lion: <><path d="M24 7c6 0 11 5 11 11 0 8-5 14-11 21C18 32 13 26 13 18 13 12 18 7 24 7z" /><path d="M18 20c2-2 4-2 6 0 2-2 4-2 6 0M24 25v7M20 28h8" /></>,
  arrows: <><path d="M6 38L32 12M24 12h8v8M10 26l12 12M38 22l-8 8M12 12l8 8" /></>,
  pierce: <><path d="M4 24h36M30 14l10 10-10 10M10 18l6 6-6 6" /></>,
  wind: <><path d="M5 20h22c4 0 6-4 3-7-2-2-5-1-6 1M5 28h30c5 0 6 7 1 8-4 1-6-1-6-3M5 36h12" /></>,
  bolt: <><path d="M27 4L11 27h11l-5 17 18-25H24z" /></>,
  frost: <><path d="M24 4v40M6 14l36 20M42 14L6 34M24 12l-6-6M24 12l6-6M24 36l-6 6M24 36l6 6" /></>,
  time: <><circle cx="24" cy="26" r="14" /><path d="M24 18v8l6 4M18 6h12M24 6v4" /><path d="M38 10l4 4M10 10L6 14" /></>,
  sword: <><path d="M12 36L34 14M30 10l4-4 8 8-4 4-8-8M12 36l-6 6 4 4 6-6M8 30l10 10" /></>,
  bow: <><path d="M14 6c12 8 12 28 0 36M14 6l-6 2M14 42l-6-2M14 24h26M32 18l8 6-8 6" /></>,
  staff: <><path d="M16 44L32 12M26 6l7 4-4 7-7-4zM8 44h12" /></>,
  potion: <><path d="M20 6h8v8l6 12v10a6 6 0 01-6 6h-8a6 6 0 01-6-6V26l6-12z" /><path d="M15 32h18" /></>,
  flask: <><path d="M20 6h8M22 6v10L12 38a5 5 0 005 6h14a5 5 0 005-6L26 16V6" /><path d="M16 30h16" /></>,
  boot: <><path d="M16 4v22l-6 8v10h28v-8c0-6-4-8-10-9l-4-3V4z" /><path d="M16 34h22" /></>,
  map: <><path d="M6 10l12-4 12 4 12-4v32l-12 4-12-4-12 4z" /><path d="M18 6v32M30 10v32" /></>
};

function Glyph({ name, size = 26 }) {
  return <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{GLYPHS[name] ?? GLYPHS.sun}</svg>;
}

function Stage({ selected }) {
  const ref = useRef(null);
  const state = useRef({ selected });
  state.current.selected = selected;
  useEffect(() => {
    const canvas = ref.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 2.55, 8.3);
    camera.lookAt(0, 1.92, 0);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    scene.add(new THREE.HemisphereLight('#cde4f5', '#23262b', 2.0));
    const key = new THREE.DirectionalLight('#ffe8bf', 3.2);
    key.position.set(-3, 7, 7); scene.add(key);
    const rim = new THREE.DirectionalLight('#86b8ff', 2.4);
    rim.position.set(5, 4, -6); scene.add(rim);
    const accent = new THREE.PointLight('#eab45f', 7, 16);
    accent.position.set(0, 2.4, 4); scene.add(accent);

    const ring = new THREE.Mesh(new THREE.CircleGeometry(9.6, 64), new THREE.MeshBasicMaterial({ color: '#0c141a', transparent: true, opacity: 0.92 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.02; scene.add(ring);
    for (const [r, o] of [[9.6, 0.45], [7.4, 0.2], [5.2, 0.14]]) {
      const line = new THREE.Mesh(new THREE.RingGeometry(r - 0.035, r, 96), new THREE.MeshBasicMaterial({ color: '#d8c184', transparent: true, opacity: o, side: THREE.DoubleSide }));
      line.rotation.x = -Math.PI / 2; line.position.y = 0.01; scene.add(line);
    }
    // pedestals
    const models = [];
    Object.keys(CLASSES).forEach((id, i) => {
      const x = (i - 1) * 3.15;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.34, 32), new THREE.MeshBasicMaterial({ color: '#141f26' }));
      ped.position.set(x, 0.17, 0); scene.add(ped);
      const glow = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.72, 40), new THREE.MeshBasicMaterial({ color: '#cbb371', transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(x, 0.36, 0); scene.add(glow);
      const model = buildPlayerModel(id);
      model.position.set(x, 0.34, 0);
      model.rotation.y = 0;
      scene.add(model);
      models.push({ id, model, glow, x, phase: i * 2.1 });
    });
    // embers
    const count = 90;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - 0.5) * 26; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = -3 + Math.random() * 8; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#e8cf92', size: 0.07, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(dust);

    const resize = () => {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    let raf, t0 = performance.now();
    const targetColor = new THREE.Color();
    const animate = (now) => {
      raf = requestAnimationFrame(animate);
      const t = (now - t0) / 1000;
      const sel = state.current.selected;
      const selColor = new THREE.Color(CLASSES[sel]?.color ?? '#eab45f');
      accent.color.lerp(selColor, 0.06);
      accent.position.x = models.find(m => m.id === sel)?.x ?? 0;
      for (const m of models) {
        const isSel = m.id === sel;
        const targetZ = isSel ? 0.85 : 0;
        const targetScale = isSel ? 1.1 : 0.92;
        m.model.position.z += (targetZ - m.model.position.z) * 0.08;
        const s = m.model.scale.x + (targetScale - m.model.scale.x) * 0.08;
        m.model.scale.setScalar(s);
        m.model.rotation.y = Math.sin(t * 0.5 + m.phase) * 0.16;
        m.model.position.y = 0.34 + Math.sin(t * 1.3 + m.phase) * 0.035;
        m.glow.material.opacity = isSel ? 0.55 + Math.sin(t * 2.4) * 0.15 : 0.16;
        m.glow.scale.setScalar(isSel ? 1.03 : 0.9);
      }
      dust.position.y = Math.sin(t * 0.4) * 0.4;
      dust.rotation.y = t * 0.02;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.()); } }); };
  }, []);
  return <canvas ref={ref} className="stage-canvas" />;
}

function SelectScreen({ selected, setSelected, onBegin }) {
  const c = CLASSES[selected];
  return (
    <div className="select-screen">
      <Stage selected={selected} />
      <div className="select-top">
        <div className="eyebrow">ROYAL REALM OF</div>
        <h1>ELYNDOR</h1>
        <div className="subtitle">A realm of magic, monsters, and old oaths</div>
      </div>
      <div className="select-choice">CHOOSE YOUR CHAMPION</div>
      <div className="class-deck">
        {Object.values(CLASSES).map(v => (
          <button key={v.id} className={`class-card ${selected === v.id ? 'active' : ''}`} onClick={() => setSelected(v.id)} style={{ '--c': v.color }}>
            <div className="cc-head"><span className="cc-order">{v.order}</span><span className="cc-diff">{v.difficulty}</span></div>
            <h2>{v.name}</h2>
            <div className="cc-role">{v.title}</div>
            <div className="cc-specs"><span>{v.hp} HP</span><i /> <span>{v.mp} MP</span><i /> <span>{v.speed.toFixed(1)} SPD</span></div>
            <div className="cc-abilities">{v.abilities.map(a => <span key={a.key} title={a.desc}>{a.name}</span>)}</div>
          </button>
        ))}
      </div>
      <div className="select-bottom">
        <div className="chosen-desc">
          <span className="chosen-role">{c.role}</span>
          <p>{c.description}</p>
        </div>
        <button className="begin" onClick={onBegin}><span>BEGIN ADVENTURE</span><i>›</i></button>
        <div className="select-hint">WASD to move · Mouse to look · LMB to strike</div>
      </div>
    </div>
  );
}

function MiniMap({ hud, onOpen }) {
  const x = hud?.playerX ?? 0, z = hud?.playerZ ?? 148;
  const f = hud?.facing ?? Math.PI;
  return (
    <button className="minimap" onClick={onOpen} title="Open world map (M)">
      <svg viewBox="-1400 -2000 2800 3100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mm-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#223436" />
            <stop offset="1" stopColor="#172627" />
          </linearGradient>
          <radialGradient id="mm-glow">
            <stop offset="0" stopColor="#ffe4a0" stopOpacity=".6" />
            <stop offset="1" stopColor="#ffe4a0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="-1400" y="-2000" width="2800" height="3100" fill="url(#mm-ground)" />
        <g stroke="#2f4a4a" strokeWidth="5" opacity=".5">
          {[-1200, -900, -600, -300, 0, 300, 600, 900, 1200].map(gx => <line key={'v' + gx} x1={gx} y1="-2000" x2={gx} y2="1100" />)}
          {[-1800, -1500, -1200, -900, -600, -300, 0, 300, 600, 900].map(gz => <line key={'h' + gz} x1="-1400" y1={gz} x2="1400" y2={gz} />)}
        </g>
        <path d="M-1250 -1550h1000v1300h-1000z" fill="#356642" stroke="#8ab873" strokeWidth="14" />
        <path d="M250 -1850h1000v1300h-1000z" fill="#36463c" stroke="#86976f" strokeWidth="14" />
        <path d="M-700 -1500C-300 -1100 100 -900 300 -500S380 330 330 800 500 1300 600 1550" fill="none" stroke="#57b0c9" strokeWidth="56" strokeLinecap="round" />
        <path d="M-300 -300h600v600h-600z" fill="#6e6b52" stroke="#e8d197" strokeWidth="14" />
        <rect x="-74" y="-264" width="148" height="528" fill="#a09a72" />
        <rect x="-264" y="-44" width="528" height="88" fill="#a09a72" />
        <rect x="-66" y="-306" width="132" height="74" fill="#d3bb7c" />
        <text x="-750" y="-1470" fill="#d6ecc4" fontSize="86" textAnchor="middle" fontFamily="Cinzel, serif" letterSpacing="8">BEGINNER</text>
        <text x="750" y="-1770" fill="#cfdcc4" fontSize="86" textAnchor="middle" fontFamily="Cinzel, serif" letterSpacing="8">MONSTER</text>
        <text x="0" y="96" fill="#f6e4b6" fontSize="70" textAnchor="middle" fontFamily="Cinzel, serif" letterSpacing="6">ELYNDOR</text>
        {VILLAGES.map(v => <g key={v.id}><circle cx={v.x} cy={v.z} r="34" fill="#f0dba6" stroke="#141d1c" strokeWidth="10" /><circle cx={v.x} cy={v.z} r="58" fill="none" stroke="#f0dba6" strokeOpacity=".35" strokeWidth="7" /></g>)}
        {Object.values(DUNGEONS).map(d => <g key={d.id}><rect x={d.x - 30} y={d.z - 30} width="60" height="60" transform={`rotate(45 ${d.x} ${d.z})`} fill={hud?.cleared?.includes(d.id) ? '#83d9a0' : '#c488e8'} stroke="#fdf2cf" strokeWidth="9" /></g>)}
        <g transform={`translate(${x} ${z})`}>
          <circle r="190" fill="url(#mm-glow)" />
          <circle r="50" fill="#ffe4a0" opacity=".2" />
          <line x1="0" y1="0" x2={Math.sin(f) * 100} y2={Math.cos(f) * 100} stroke="#ffe4a0" strokeWidth="16" strokeLinecap="round" />
          <circle r="26" fill="#fff8de" stroke="#161f1e" strokeWidth="9" />
        </g>
        <text x="0" y="-1912" fill="#e2d3a3" fontSize="96" textAnchor="middle" fontFamily="Cinzel, serif">N</text>
      </svg>
      <span className="mm-label">ELYNDOR</span>
    </button>
  );
}

function AbilityBar({ hud, cls, onPotion, onMana, onDash, onAbility }) {
  return (
    <div className="action-wrap">
      <div className="prompt-slot">{hud?.prompt && <div className="interact-prompt"><kbd>F</kbd><span>{hud.prompt.label}</span><em>{hud.prompt.role}</em></div>}</div>
      <div className="actionbar">
        <button className="slot basic" onClick={() => onAbility('basic')} title="Basic attack (Left click)">
          <Glyph name={cls.basic.kind === 'melee' ? 'sword' : cls.basic.kind === 'arrow' ? 'bow' : 'staff'} />
          <span className="key">LMB</span>
          <em>{cls.basic.name}</em>
        </button>
        {cls.abilities.map(ab => {
          const cd = hud?.cooldowns?.[ab.key] ?? { left: 0, ratio: 0 };
          const locked = (hud?.mp ?? 0) < ab.cost;
          return (
            <button key={ab.key} className={`slot ability ${locked ? 'locked' : ''}`} onClick={() => onAbility(ab.key)} title={`${ab.name} — ${ab.desc}`}>
              <span className="slot-glyph"><Glyph name={ab.icon} size={30} /></span>
              {cd.left > 0 && <span className="cooldown" style={{ background: `conic-gradient(rgba(4,8,12,.86) ${cd.ratio * 360}deg, transparent 0deg)` }}><b>{cd.left.toFixed(1)}</b></span>}
              <span className="key">{ab.key.toUpperCase()}</span>
              <em>{ab.name}</em>
              <span className="cost">{ab.cost}</span>
            </button>
          );
        })}
        <div className="divider" />
        <button className="slot small" onClick={onDash} title="Dodge (Space)">
          <Glyph name="boot" size={24} />
          <span className="key">SPC</span>
          <em>Dodge</em>
        </button>
        <button className="slot small potion" onClick={onPotion} title="Healing draught (1)">
          <Glyph name="potion" size={24} />
          <span className="key">1</span>
          <b className="count">{hud?.potions ?? 0}</b>
          <em>Health</em>
        </button>
        <button className="slot small potion" onClick={onMana} title="Mana tonic (2)">
          <Glyph name="flask" size={24} />
          <span className="key">2</span>
          <b className="count">{hud?.manaPotions ?? 0}</b>
          <em>Mana</em>
        </button>
      </div>
    </div>
  );
}

const ZONE_RECTS = [
  { name: 'Beginner’s Forest', x: -1250, z: -1550, w: 1000, h: 1300, rank: 'F–S' },
  { name: 'Monster Forest', x: 250, z: -1850, w: 1000, h: 1300, rank: 'B–SS' }
];

function WorldMap({ hud, onClose, onTravel }) {
  const pois = useMemo(() => [
    { name: 'Royal Capital', x: 0, z: 0, kind: 'city' },
    ...VILLAGES.map(v => ({ ...v, kind: 'village' })),
    ...Object.values(DUNGEONS).map(d => ({ name: d.name, x: d.x, z: d.z, kind: 'dungeon', rank: d.rank, id: d.id }))
  ], []);
  return (
    <div className="modal map-modal">
      <div className="map-frame">
        <header><div><span>CARTOGRAPHY OF</span><h3>THE ELYNDOR REACH</h3></div><button className="x" onClick={onClose}>✕</button></header>
        <div className="map-body">
          <svg className="world-map" viewBox="-1400 -2000 2800 3150">
            <defs>
              <pattern id="mapgrain" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M0 80L80 0" stroke="rgba(240,225,180,.05)" strokeWidth="2" /></pattern>
            </defs>
            <rect x="-1400" y="-2000" width="2800" height="3150" fill="#182420" />
            <rect x="-1400" y="-2000" width="2800" height="3150" fill="url(#mapgrain)" />
            <path d="M-1250 -1550h1000v1300h-1000z" fill="#223b28" stroke="#7b9a6d" strokeWidth="7" />
            <path d="M250 -1850h1000v1300h-1000z" fill="#202b26" stroke="#7b786a" strokeWidth="7" />
            <text x="-750" y="-1470" fill="#9fbe8f" fontSize="86" textAnchor="middle" fontFamily="Cinzel, serif">BEGINNER’S FOREST</text>
            <text x="-750" y="-1370" fill="#7d9870" fontSize="56" textAnchor="middle" fontFamily="Cinzel, serif">RANK F–S · 1000 × 1300 m</text>
            <text x="750" y="-1770" fill="#a5a892" fontSize="86" textAnchor="middle" fontFamily="Cinzel, serif">MONSTER FOREST</text>
            <text x="750" y="-1670" fill="#828773" fontSize="56" textAnchor="middle" fontFamily="Cinzel, serif">RANK B–SS · 1000 × 1300 m</text>
            {ZONE_RECTS.map((z, i) => <rect key={i} x={z.x} y={z.z} width={z.w} height={z.h} fill="none" stroke="rgba(210,190,130,.25)" strokeWidth="4" strokeDasharray="18 14" />)}
            <path d="M-700 -1500C-300 -1100 100 -900 300 -500S380 330 330 800 500 1300 600 1550" fill="none" stroke="#3b7e93" strokeWidth="42" />
            <text x="460" y="420" fill="#6fb2c4" fontSize="48" fontFamily="Cinzel, serif" transform="rotate(78 460 420)">SILVERRUN</text>
            <rect x="-300" y="-300" width="600" height="600" fill="#3d4034" stroke="#d3bd80" strokeWidth="7" />
            <rect x="-75" y="-265" width="150" height="530" fill="#6a6852" />
            <rect x="-265" y="-42" width="530" height="84" fill="#6a6852" />
            <rect x="-58" y="-250" width="116" height="120" fill="#8b7c55" stroke="#c8b078" strokeWidth="3" />
            <text x="0" y="30" fill="#f0dfad" fontSize="64" textAnchor="middle" fontFamily="Cinzel, serif">ELYNDOR</text>
            <text x="0" y="96" fill="#baa878" fontSize="42" textAnchor="middle" fontFamily="Cinzel, serif">ROYAL CAPITAL · 600 × 600 m</text>
            <path d="M0 300L30 470 240 720" fill="none" stroke="#9b8e6a" strokeWidth="14" />
            <path d="M0 -300L60 -560 260 -860" fill="none" stroke="#9b8e6a" strokeWidth="12" />
            {VILLAGES.map(v => <g key={v.id}><circle cx={v.x} cy={v.z} r="26" fill="#e3cb8c" stroke="#141c19" strokeWidth="6" /><text x={v.x} y={v.z + 80} fill="#e9dfbf" fontSize="54" textAnchor="middle" fontFamily="Cinzel, serif">{v.name}</text><text x={v.x} y={v.z + 128} fill="#9e987d" fontSize="32" textAnchor="middle" fontFamily="Cinzel, serif">VILLAGE</text></g>)}
            {Object.values(DUNGEONS).map(d => <g key={d.id}><rect x={d.x - 22} y={d.z - 22} width="44" height="44" transform={`rotate(45 ${d.x} ${d.z})`} fill={hud?.cleared?.includes(d.id) ? '#7fcf98' : '#a87ac9'} stroke="#f2e6c1" strokeWidth="5" /><text x={d.x + 44} y={d.z + 12} fill="#cfc09c" fontSize="42" fontFamily="Cinzel, serif">{d.name} · {d.rank}</text></g>)}
            <g transform={`translate(${hud?.playerX ?? 0} ${hud?.playerZ ?? 148})`}>
              <circle r="34" fill="#ffe6a6" opacity=".2" />
              <line x1="0" y1="0" x2={Math.sin(hud?.facing ?? Math.PI) * 66} y2={Math.cos(hud?.facing ?? Math.PI) * 66} stroke="#ffe6a6" strokeWidth="9" />
              <circle r="18" fill="#fff4ce" stroke="#17201d" strokeWidth="6" />
            </g>
            <text x="0" y="-1920" fill="#c8b787" fontSize="80" textAnchor="middle" fontFamily="Cinzel, serif">N</text>
          </svg>
          <div className="map-list">
            <h4>WAYPOINTS</h4>
            <p className="map-note">Fast travel to any known settlement or dungeon gate.</p>
            {pois.map(p => (
              <button key={p.name} className="waypoint" onClick={() => onTravel(p)}>
                <span className={`wp-dot ${p.kind}`} />
                <span><b>{p.name}</b><small>{p.kind === 'city' ? 'Capital' : p.kind === 'village' ? 'Village' : `Rank ${p.rank} Dungeon`}{p.kind === 'dungeon' && hud?.cleared?.includes(p.id) ? ' · Cleared' : ''}</small></span>
                <i>›</i>
              </button>
            ))}
          </div>
        </div>
        <footer><span>◆ Click a waypoint to travel</span><span>Press M or ESC to close</span></footer>
      </div>
    </div>
  );
}

/* ---------------- game view ---------------- */

function GameView({ classId, onExit }) {
  const cls = CLASSES[classId];
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [hud, setHud] = useState(null);
  const [intro, setIntro] = useState(true);
  const [dead, setDead] = useState(false);
  const [clear, setClear] = useState(null);
  const [modal, setModal] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [damages, setDamages] = useState([]);
  const [abilityFx, setAbilityFx] = useState(null);
  const [hurt, setHurt] = useState(false);
  const timers = useRef([]);
  const after = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms); timers.current.push(id); return id;
  }, []);

  const closeOverlays = useCallback(() => {
    setModal(null); setMapOpen(false); setClear(null);
    if (engineRef.current && !dead) engineRef.current.setBlocked(false);
  }, [dead]);

  const handleEvent = useCallback((ev) => {
    switch (ev.type) {
      case 'damage':
        setDamages(d => [...d.slice(-14), ev]);
        after(() => setDamages(d => d.filter(x => x.id !== ev.id)), 950);
        break;
      case 'toast': {
        const id = Math.random().toString(36).slice(2);
        setToasts(t => [...t.slice(-3), { ...ev, id }]);
        after(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
        break;
      }
      case 'dialogue': setModal({ type: 'dialogue', npc: ev.npc }); break;
      case 'shop': setModal({ type: 'shop', npc: ev.npc }); break;
      case 'portal': setModal({ type: 'portal', portal: ev.portal }); break;
      case 'death': setDead(true); setModal(null); break;
      case 'respawn': setDead(false); break;
      case 'clear': setClear(ev); engineRef.current?.setBlocked(true); break;
      case 'hurt': setHurt(true); after(() => setHurt(false), 220); break;
      case 'ability': setAbilityFx({ ...ev, id: Math.random() }); after(() => setAbilityFx(null), 1200); break;
      default: break;
    }
  }, [after]);

  useEffect(() => {
    const engine = new Game(canvasRef.current, classId, setHud, handleEvent);
    engineRef.current = engine;
    window.__elyndor = engine;
    return () => { engine.dispose(); engineRef.current = null; window.__elyndor = null; timers.current.forEach(clearTimeout); };
  }, [classId, handleEvent]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === 'm') {
        if (intro || dead || clear || modal) return;
        setMapOpen(o => {
          const next = !o;
          engineRef.current?.setBlocked(next);
          return next;
        });
      }
      if (e.key === 'Escape') {
        if (clear) { setClear(null); engineRef.current?.setBlocked(false); }
        else if (dead) return;
        else if (mapOpen || modal) closeOverlays();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [intro, dead, clear, modal, mapOpen, closeOverlays]);

  const begin = () => { setIntro(false); engineRef.current?.setBlocked(false); };
  const openMap = () => { if (!mapOpen) { setMapOpen(true); engineRef.current?.setBlocked(true); } };
  const travel = (poi) => { engineRef.current?.travelTo(poi); setMapOpen(false); engineRef.current?.setBlocked(false); };
  const enterDungeon = (id) => { setModal(null); engineRef.current?.enterDungeon(id); engineRef.current?.setBlocked(false); };
  const abilityClick = (k) => {
    if (!engineRef.current) return;
    if (k === 'basic') engineRef.current.basicAttack(); else engineRef.current.useAbility(k);
  };
  const activeQuests = (hud?.quests ?? []).filter(q => !q.done);
  const shownQuests = activeQuests.slice(0, 2);
  const power = hud?.buffs?.power ?? 0;
  const timewarp = hud?.buffs?.timewarp ?? 0;
  const invis = hud?.buffs?.invis ?? 0;

  return (
    <div className={`game-screen ${hurt ? 'hurt' : ''}`} style={{ '--accent': cls.color, '--accent-soft': cls.glow }}>
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="vignette" />
      <div className="hud">
        <header className="topbar">
          <div className="brand-mini">
            <span>ROYAL REALM OF</span>
            <h1>ELYNDOR</h1>
          </div>
          <div className="zone-banner">
            <div className="zone-rule" />
            <div className="zone-name">{hud?.zone?.name ?? 'ELYNDOR'}</div>
            <div className="zone-sub">{hud?.zone?.sub ?? ''}</div>
            {hud?.zone?.rank && <div className="zone-rank">RANK {hud.zone.rank}</div>}
            <div className="zone-rule" />
          </div>
          <div className="top-actions">
            <button onClick={openMap} title="World map (M)"><Glyph name="map" size={22} /><span>MAP</span></button>
          </div>
        </header>

        <aside className="char-panel">
          <div className="portrait-wrap">
            <div className="portrait-ring"><div className="portrait-inner"><Glyph name={classId === 'swordsman' ? 'sword' : classId === 'archer' ? 'bow' : 'staff'} size={38} /></div></div>
            <div className="level-badge">LV {hud?.level ?? 1}</div>
          </div>
          <div className="char-meta">
            <div className="char-name">{cls.name}<span>{cls.title}</span></div>
            <div className="bar hp"><i style={{ width: `${((hud?.hp ?? 1) / (hud?.maxHp ?? 1)) * 100}%` }} /><span>{(hud?.hp ?? 0)} / {hud?.maxHp ?? 0}</span></div>
            <div className="bar mp"><i style={{ width: `${((hud?.mp ?? 0) / (hud?.maxMp ?? 1)) * 100}%` }} /><span>{(hud?.mp ?? 0)} / {hud?.maxMp ?? 0}</span></div>
            <div className="bar st"><i style={{ width: `${((hud?.stamina ?? 0) / (hud?.maxStamina ?? 1)) * 100}%` }} /></div>
            <div className="xp-line"><div className="bar xp"><i style={{ width: `${((hud?.xp ?? 0) / (hud?.xpNext ?? 1)) * 100}%` }} /></div><span>{(hud?.xp ?? 0)} / {hud?.xpNext ?? 120} XP</span></div>
          </div>
          <div className="char-buffs">
            {power > 0 && <span className="buff gold">LIONHEART {Math.ceil(power)}s</span>}
            {invis > 0 && <span className="buff green">VEILED {Math.ceil(invis)}s</span>}
            {timewarp > 0 && <span className="buff violet">TIME WARP {Math.ceil(timewarp)}s</span>}
          </div>
        </aside>

        <div className="right-rail">
          <MiniMap hud={hud} onOpen={openMap} />
          <div className="quest-card">
            <div className="quest-head"><small>ACTIVE CONTRACTS</small><span>{activeQuests.length}</span></div>
            {shownQuests.length === 0 && <div className="quest-done">All contracts fulfilled. The realm is safer — for now.</div>}
            {shownQuests.map(q => (
              <div key={q.id} className="quest">
                <div className="quest-title">{q.title}</div>
                <div className="quest-desc">{q.desc}</div>
                <div className="quest-progress"><div><i style={{ width: `${(q.progress / q.count) * 100}%` }} /></div><b>{q.progress}/{q.count}</b></div>
                <div className="quest-reward">{q.gold}g · {q.xp} XP {q.item ? `· ${q.item}` : ''}</div>
              </div>
            ))}
            {activeQuests.length > 2 && <div className="more-quests">+{activeQuests.length - 2} more contracts</div>}
          </div>
          <div className="wallet">
            <span className="coin">◆</span><b>{hud?.gold ?? 0}</b><em>gold</em>
            <span className="wallet-sep" />
            <Glyph name="potion" size={15} /><b>{hud?.potions ?? 0}</b>
            <Glyph name="flask" size={15} /><b>{hud?.manaPotions ?? 0}</b>
          </div>
        </div>

        {hud?.boss && (
          <div className="boss-bar">
            <div className="boss-head"><span>◆ {hud.boss.name}</span><b>RANK {hud.boss.rank}</b></div>
            <div className="boss-track"><i style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }} /></div>
            <div className="boss-hp">{hud.boss.hp} / {hud.boss.maxHp}</div>
          </div>
        )}
        {hud?.target && !hud?.boss && (
          <div className="target-card">
            <span className="t-name">{hud.target.elite ? '✦ ' : ''}{hud.target.name}</span>
            <div className="t-track"><i style={{ width: `${(hud.target.hp / hud.target.maxHp) * 100}%` }} /></div>
            <span className="t-rank">{hud.target.rank}</span>
          </div>
        )}

        <AbilityBar hud={hud} cls={cls} onAbility={abilityClick}
          onPotion={() => engineRef.current?.useHealthPotion()}
          onMana={() => engineRef.current?.useManaPotion()}
          onDash={() => engineRef.current?.dash()} />

        <div className="control-hint">
          <span><kbd>WASD</kbd> Move</span>
          <span><kbd>SHIFT</kbd> Sprint</span>
          <span><kbd>SPACE</kbd> Dodge</span>
          <span><kbd>DRAG</kbd> Look</span>
          <span><kbd>M</kbd> Map</span>
        </div>

        <div className="damage-layer">
          {damages.map(d => (
            <div key={d.id} className={`dmg ${d.crit ? 'crit' : ''}`} style={{ left: `${d.x}%`, top: `${d.y}%`, color: d.color }}>
              {d.text}
            </div>
          ))}
        </div>
        <div className="toast-layer">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.tone ?? ''}`}>
              <div className="toast-mark">◆</div>
              <div><b>{t.title}</b><span>{t.sub}</span></div>
            </div>
          ))}
        </div>
        {abilityFx && <div className="ability-fx" style={{ color: abilityFx.color }}>{abilityFx.name}</div>}
        {hud?.insideDungeon && <div className="dungeon-tag">DUNGEON · {hud.zone.name}</div>}
      </div>

      {intro && (
        <div className="overlay intro">
          <div className="intro-card">
            <div className="eyebrow">THE AWAKENING</div>
            <h2>Elyndor Needs a Champion</h2>
            <p>You arrive at the royal capital as rumors spread: goblin tribes are swarming the Beginner’s Forest, and something older stirs beneath the Monster Forest. Captain Roderick waits at the edge of the plaza, watching the palace road.</p>
            <div className="intro-grid">
              <div><h4>YOUR PATH</h4><b>{cls.name} · {cls.title}</b><span>{cls.role}</span></div>
              <div><h4>MOVEMENT</h4><b>WASD · Shift · Space</b><span>Sprint and dodge to survive</span></div>
              <div><h4>COMBAT</h4><b>LMB · Q · E · R</b><span>Basic attacks and three abilities</span></div>
              <div><h4>WORLD</h4><b>M · F · 1 · 2</b><span>Map, interact, potions</span></div>
            </div>
            <button className="begin" onClick={begin}><span>ENTER THE CAPITAL</span><i>›</i></button>
          </div>
        </div>
      )}

      {mapOpen && <WorldMap hud={hud} onClose={closeOverlays} onTravel={travel} />}

      {modal?.type === 'dialogue' && (
        <div className="modal dialogue-modal">
          <div className="dialog-card">
            <div className="dialog-portrait"><Glyph name={modal.npc.id === 'selene' ? 'map' : modal.npc.id === 'roderick' ? 'shield' : modal.npc.id === 'elara' ? 'sun' : 'staff'} size={44} /></div>
            <div className="dialog-body">
              <small>{modal.npc.role}</small>
              <h3>{modal.npc.name}</h3>
              {modal.npc.lines.map((l, i) => <p key={i}>{l}</p>)}
              {modal.npc.village && <span className="dialog-note">{modal.npc.village} · Elyndor</span>}
            </div>
            <button className="x" onClick={closeOverlays}>✕</button>
            <button className="dialog-close" onClick={closeOverlays}>CLOSE</button>
          </div>
        </div>
      )}

      {modal?.type === 'shop' && (
        <div className="modal shop-modal">
          <div className="shop-card">
            <header>
              <div className="shop-portrait"><Glyph name="potion" size={30} /></div>
              <div><small>{modal.npc.role}</small><h3>{modal.npc.name}’s Satchel</h3></div>
              <div className="shop-gold"><span className="coin">◆</span> {hud?.gold ?? 0}</div>
              <button className="x" onClick={closeOverlays}>✕</button>
            </header>
            <p className="shop-line">“{modal.npc.lines[1] ?? modal.npc.lines[0]}”</p>
            <div className="shop-grid">
              <div className="shop-item">
                <div className="item-icon health"><Glyph name="potion" size={30} /></div>
                <div><b>Healing Draught</b><span>Restores 45% of your health.</span></div>
                <button onClick={() => engineRef.current?.buy('health')}>45 ◆</button>
              </div>
              <div className="shop-item">
                <div className="item-icon mana"><Glyph name="flask" size={30} /></div>
                <div><b>Azure Tonic</b><span>Restores 50% of your mana.</span></div>
                <button onClick={() => engineRef.current?.buy('mana')}>40 ◆</button>
              </div>
            </div>
            <footer><span>You carry {hud?.potions ?? 0} health and {hud?.manaPotions ?? 0} mana potions.</span><button onClick={closeOverlays}>LEAVE</button></footer>
          </div>
        </div>
      )}

      {modal?.type === 'portal' && (
        <div className="modal portal-modal">
          <div className="portal-card">
            <div className="portal-rank">RANK {modal.portal.rank}</div>
            <div className="portal-sigil"><div className="sigil-ring" /><Glyph name="shield" size={50} /></div>
            <small>DUNGEON GATE</small>
            <h3>{modal.portal.name}</h3>
            <p>{modal.portal.desc}</p>
            {modal.portal.cleared && <div className="cleared-tag">◆ CLEARED · The guardian is no more</div>}
            <div className="portal-actions">
              <button className="begin" onClick={() => enterDungeon(modal.portal.id)}><span>ENTER THE DEPTHS</span><i>›</i></button>
              <button className="ghost" onClick={closeOverlays}>NOT YET</button>
            </div>
            <div className="portal-warning">Recommended: level {modal.portal.rank === 'SS' ? 18 : modal.portal.rank === 'A' ? 14 : modal.portal.rank === 'B' ? 9 : 5}+</div>
          </div>
        </div>
      )}

      {dead && (
        <div className="overlay death">
          <div className="death-card">
            <div className="death-mark">†</div>
            <div className="eyebrow">THE THREAD SLIPS</div>
            <h2>You Have Fallen</h2>
            <p>The wilds are patient. The Crown is less so. Return to the capital, tend your wounds, and try again.</p>
            <button className="begin" onClick={() => { engineRef.current?.respawn(); setDead(false); }}><span>RISE AT THE CAPITAL</span><i>›</i></button>
          </div>
        </div>
      )}

      {clear && (
        <div className="overlay clear">
          <div className="clear-card">
            <div className="eyebrow">THE DEPTHS ARE SILENT</div>
            <h2>Dungeon Cleared</h2>
            <div className="clear-rank">RANK {clear.rank}</div>
            <h3>{clear.name}</h3>
            <div className="clear-loot">
              <div><span>◆</span><b>{clear.reward.gold} gold</b></div>
              <div><span>✦</span><b>{clear.reward.xp} experience</b></div>
              <div><span>◈</span><b>{clear.reward.item}</b></div>
            </div>
            <p className="clear-boss">Guardian vanquished: <b>{clear.boss}</b></p>
            <button className="begin" onClick={() => { setClear(null); engineRef.current?.setBlocked(false); }}><span>CLAIM YOUR REWARD</span><i>›</i></button>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState('select');
  const [selected, setSelected] = useState('swordsman');
  return (
    <>
      <div className="grain" />
      {screen === 'select'
        ? <SelectScreen selected={selected} setSelected={setSelected} onBegin={() => setScreen('game')} />
        : <GameView classId={selected} onExit={() => setScreen('select')} />}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
