// Peta 3D SidoarjoVerse (Three.js): kota low-poly + karakter bulat. Semua model dibuat di kode ini, tanpa aset luar.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { lookFor } from './avatar.js';

// ---------------------------------------------------------------- material & builder
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const MATS = new Map();
const winMat = new THREE.MeshStandardMaterial({ color: '#c9e2ea', roughness: 0.35 });
const lampMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', roughness: 0.5 });
const waterMat = new THREE.MeshStandardMaterial({ color: '#7fb6c6', roughness: 0.18, transparent: true, opacity: 0.9 });
const tambakMat = new THREE.MeshStandardMaterial({ color: '#86ada3', roughness: 0.25, transparent: true, opacity: 0.92 });

function mat(k) {
  if (k === 'win') return winMat;
  if (k === 'lamp') return lampMat;
  if (k === 'water') return waterMat;
  if (k === 'tambak') return tambakMat;
  let m = MATS.get(k);
  if (!m) { const datar = k[0] === '~'; m = new THREE.MeshStandardMaterial({ color: datar ? k.slice(1) : k, roughness: 0.92, metalness: 0, flatShading: datar }); MATS.set(k, m); }
  return m;
}

// Voxel Builder: kumpulkan kotak per warna lalu gabung jadi sedikit mesh (ringan di HP).
const MAT_AWAN = new THREE.MeshStandardMaterial({ color: '#fbf8f2', emissive: '#f2ede4', emissiveIntensity: 0.45, roughness: 1, flatShading: true });
const BOLA_LP = new THREE.IcosahedronGeometry(0.5, 1); // bola low-poly bersegi (pohon, semak, awan)
class VB {
  constructor() { this.parts = new Map(); }
  _add(c, m, geo) { let l = this.parts.get(c); if (!l) { l = []; this.parts.set(c, l); } l.push([m, geo]); return this; }
  // x,z = pusat, y = dasar kotak
  box(x, y, z, w, h, d, c) {
    return this._add(c, new THREE.Matrix4().makeScale(w, h, d).setPosition(x, y + h / 2, z), UNIT);
  }
  // bola low-poly: x,z = pusat, y = dasar
  bola(x, y, z, w, h, d, c) {
    return this._add(c, new THREE.Matrix4().makeScale(w, h, d).setPosition(x, y + h / 2, z), BOLA_LP);
  }
  build({ shadow = true } = {}) {
    const g = new THREE.Group();
    for (const [c, list] of this.parts) {
      const campur = list.some(([, geo]) => geo !== UNIT);
      const geos = list.map(([m, geo]) => { const x = geo.clone().applyMatrix4(m); return campur && x.index ? x.toNonIndexed() : x; });
      const geo = mergeGeometries(geos, false);
      geos.forEach(x => x.dispose());
      const mesh = new THREE.Mesh(geo, mat(c));
      mesh.castShadow = shadow && c !== 'water' && c !== 'tambak';
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }
}

export function rng(seed) {
  let a = typeof seed === 'number' ? seed : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function canvasTex(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Label teks melayang (nama warga, status bangunan)
function textSprite(text, { bg = 'rgba(255,255,255,.94)', fg = '#123', size = 0.62, border = null } = {}) {
  const dpr = 3, fs = 26;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  const tw = Math.ceil(ctx.measureText(text).width);
  const W = tw + 28, H = fs + 18;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(1, 1, W - 2, H - 2, 10); ctx.fill();
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2.5; ctx.stroke(); }
  ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, H / 2 + 1);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(cv), depthWrite: false }));
  sp.center.set(0.5, 0);
  sp.scale.set(size * W / H, size, 1);
  sp.renderOrder = 10;
  return sp;
}

// Papan nama datar (gapura, pasar, dll)
function signMesh(text, w, h, bg = '#0f4c5c', fg = '#ffd166') {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * h / w);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = fg; ctx.lineWidth = 8; ctx.strokeRect(10, 10, cv.width - 20, cv.height - 20);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = cv.height * 0.55;
  ctx.font = `900 ${fs}px system-ui, sans-serif`;
  while (ctx.measureText(text).width > cv.width - 50 && fs > 10) { fs -= 2; ctx.font = `900 ${fs}px system-ui, sans-serif`; }
  ctx.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: canvasTex(cv) }));
  return m;
}

// ---------------------------------------------------------------- tata kota
const LINES = [-16, 0, 16];   // posisi jalan (x untuk jalan vertikal, z untuk horizontal)
const EDGE = 28;              // ujung jalan
const RIVER = [21, 25];       // sungai (z dari..sampai)
const ROAD_W = 3;

// Graf jalan untuk karakter berjalan
function buildGraph() {
  const nodes = new Map();
  const key = (x, z) => x + ',' + z;
  const add = (x, z) => { const k = key(x, z); if (!nodes.has(k)) nodes.set(k, { k, x, z, n: new Set() }); return nodes.get(k); };
  const link = (a, b) => { a.n.add(b.k); b.n.add(a.k); };
  const xs = [-26, -16, 0, 16, 26];
  for (const z of LINES) { let prev = null; for (const x of xs) { const n = add(x, z); if (prev) link(prev, n); prev = n; } }
  for (const x of LINES) {
    const zs = x === 0 ? [-26, -16, 0, 16, 28] : [-26, -16, 0, 16];
    let prev = null; for (const z of zs) { const n = add(x, z); if (prev) link(prev, n); prev = n; }
  }
  return nodes;
}

function bfs(nodes, from, to) {
  if (from === to) return [];
  const prev = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const c = q.shift();
    if (c === to) break;
    for (const nb of nodes.get(c).n) if (!prev.has(nb)) { prev.set(nb, c); q.push(nb); }
  }
  if (!prev.has(to)) return [];
  const path = [];
  for (let c = to; c !== from; c = prev.get(c)) path.unshift(c);
  return path;
}

// ---------------------------------------------------------------- model bangunan
const PALET_RUMAH = ['#f6e7c1', '#cde7d8', '#f9d5c5', '#d7e3fc', '#fbe0a6', '#e8d6f0', '#ffffff'];

function pohon(vb, x, z, r, tipe) {
  if (tipe === 'kelapa') {
    const h = 3.2 + r() * 1.5;
    for (let i = 0; i < h; i += 0.6) vb.box(x + Math.sin(i) * 0.12, i, z, 0.28, 0.6, 0.28, '#8a6e4f');
    vb.box(x, h, z, 2.6, 0.18, 0.5, '~#6f9447').box(x, h, z, 0.5, 0.18, 2.6, '~#6f9447').bola(x, h + 0.05, z, 0.8, 0.45, 0.8, '~#7da152');
    vb.box(x + 0.25, h - 0.3, z, 0.25, 0.3, 0.25, '#6b4a2a');
    return;
  }
  const h = 1 + r() * 0.8, s = 1.6 + r() * 0.9;
  const hijau = ['~#7a9a4a', '~#86a552', '~#6f8f45', '~#90ab5a'][Math.floor(r() * 4)];
  vb.box(x, 0, z, 0.3, h + 0.3, 0.3, '#7d5a3c');
  vb.bola(x, h - 0.1, z, s, s * 0.95, s, hijau);
  vb.bola(x + s * 0.18, h + s * 0.45, z - s * 0.1, s * 0.7, s * 0.65, s * 0.7, hijau);
}

function rumah(vb, x, z, c, r, rot = 0) {
  const w = 2.6, d = 2.4, h = 1.9;
  vb.box(x, 0, z, w + 0.3, 0.2, d + 0.3, '#bdb5a6');
  vb.box(x, 0.2, z, w, h, d, c);
  // atap genteng bertingkat
  const atap = r() < 0.5 ? '#b5523b' : '#8e3b2e';
  vb.box(x, 0.2 + h, z, w + 0.5, 0.35, d + 0.5, atap);
  vb.box(x, 0.55 + h, z, w - 0.2, 0.35, d - 0.4, atap);
  vb.box(x, 0.9 + h, z, w - 0.9, 0.35, d - 1.2, atap);
  // pintu & jendela (depan = +z)
  vb.box(x - 0.5, 0.2, z + d / 2 + 0.01, 0.6, 1.15, 0.06, '#6d4527');
  vb.box(x + 0.55, 0.9, z + d / 2 + 0.01, 0.7, 0.55, 0.06, 'win');
  vb.box(x + w / 2 + 0.01, 0.9, z, 0.06, 0.55, 0.7, 'win');
  vb.box(x - w / 2 - 0.01, 0.9, z, 0.06, 0.55, 0.7, 'win');
}

function pagarKeliling(vb, w, d, warna = '#e9e2d0') {
  const step = 1;
  for (let x = -w / 2; x <= w / 2 + 0.01; x += step) { vb.box(x, 0, -d / 2, 0.15, 0.7, 0.15, warna); vb.box(x, 0, d / 2, 0.15, 0.7, 0.15, warna); }
  for (let z = -d / 2; z <= d / 2 + 0.01; z += step) { vb.box(-w / 2, 0, z, 0.15, 0.7, 0.15, warna); vb.box(w / 2, 0, z, 0.15, 0.7, 0.15, warna); }
  vb.box(0, 0.45, -d / 2, w, 0.1, 0.08, warna).box(0, 0.45, d / 2, w, 0.1, 0.08, warna);
  vb.box(-w / 2, 0.45, 0, 0.08, 0.1, d, warna).box(w / 2, 0.45, 0, 0.08, 0.1, d, warna);
}

export const TIPE = {
  gapura: { label: 'Gapura', w: 8, d: 2, build(vb, b, ex) {
    for (const s of [-3.3, 3.3]) {
      vb.box(s, 0, 0, 1.4, 0.5, 1.4, '#e8dcc6');
      vb.box(s, 0.5, 0, 1.1, 4.6, 1.1, '#b5523b');
      for (let y = 1; y < 5; y += 1) vb.box(s, y, 0, 1.16, 0.12, 1.16, '#8e3b2e');
      vb.box(s, 5.1, 0, 1.4, 0.4, 1.4, '#e8dcc6');
      vb.box(s, 5.5, 0, 0.8, 0.6, 0.8, '#b5523b').box(s, 6.1, 0, 0.4, 0.4, 0.4, '#e6b422');
    }
    vb.box(0, 4.3, 0, 7.6, 0.8, 0.9, '#8e3b2e');
    const sg = signMesh('SIDOARJOVERSE', 5.4, 1.0); sg.position.set(0, 3.75, 0.47); ex.push(sg);
    const sg2 = sg.clone(); sg2.rotation.y = Math.PI; sg2.position.z = -0.47; ex.push(sg2);
  } },
  alunalun: { label: 'Alun-alun', w: 12, d: 12, build(vb, b, ex, r) {
    vb.box(0, 0, 0, 12, 0.12, 12, '#d9cbb0');
    vb.box(0, 0.12, 0, 10, 0.08, 10, '#7cc46a');
    vb.box(0, 0.12, 0, 10, 0.09, 1.2, '#d9cbb0').box(0, 0.12, 0, 1.2, 0.09, 10, '#d9cbb0');
    // beringin kembar
    for (const sx of [-2.8, 2.8]) {
      vb.box(sx, 0.2, -2.8, 0.9, 2.6, 0.9, '#6b4a2a');
      vb.box(sx, 2.6, -2.8, 4.2, 1.8, 4.2, '#2f7d32').box(sx, 4.4, -2.8, 3.2, 1.2, 3.2, '#3a8f3d').box(sx, 5.6, -2.8, 1.8, 0.8, 1.8, '#46a049');
      for (const a of [-1.2, 1.2]) vb.box(sx + a, 1.2, -2.8 + a * 0.4, 0.15, 1.5, 0.15, '#6b4a2a');
    }
    // kolam air mancur tengah
    vb.box(0, 0.2, 0, 2.6, 0.45, 2.6, '#e8dcc6').box(0, 0.25, 0, 2.1, 0.42, 2.1, 'water').box(0, 0.6, 0, 0.5, 1.2, 0.5, '#e8dcc6').box(0, 1.8, 0, 1.0, 0.2, 1.0, '#e8dcc6');
    // bangku & lampu
    for (const [x, z] of [[-3, 3], [3, 3], [-3, 4.4], [3, 4.4]]) { vb.box(x, 0.2, z, 1.6, 0.35, 0.5, '#8a5a32'); vb.box(x, 0.55, z - 0.2, 1.6, 0.35, 0.1, '#8a5a32'); }
    for (const [x, z] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5], [-0.8, 4.8], [0.8, 4.8]]) { vb.box(x, 0, z, 0.18, 2.6, 0.18, '#333'); vb.box(x, 2.6, z, 0.45, 0.4, 0.45, 'lamp'); }
    for (let i = 0; i < 10; i++) { const x = (r() - 0.5) * 9, z = 1.5 + r() * 3.2; if (Math.abs(x) > 1.2) vb.box(x, 0.2, z, 0.5, 0.35, 0.5, ['#ff7aa2', '#ffd166', '#f4f1de'][i % 3]); }
  } },
  pendopo: { label: 'Pendopo', w: 10, d: 8, build(vb) {
    vb.box(0, 0, 0, 9.6, 0.6, 7.6, '#c9b79c');
    vb.box(0, 0, 4.1, 3, 0.3, 0.8, '#c9b79c');
    vb.box(0, 0.6, 0, 9, 0.06, 7, '#a7825a');
    for (const x of [-4, -1.4, 1.4, 4]) for (const z of [-3, 3]) vb.box(x, 0.6, z, 0.4, 3, 0.4, '#7a4a2a');
    for (const x of [-1.4, 1.4]) for (const z of [-1, 1]) vb.box(x, 0.6, z, 0.5, 3.6, 0.5, '#6a3d22');
    vb.box(0, 3.6, 0, 10.4, 0.45, 8.4, '#8e3b2e');
    vb.box(0, 4.05, 0, 8, 0.6, 6, '#a0452e');
    vb.box(0, 4.65, 0, 5.4, 0.7, 3.8, '#8e3b2e');
    vb.box(0, 5.35, 0, 3.0, 0.9, 1.8, '#a0452e');
    vb.box(0, 6.25, 0, 1.6, 0.35, 0.6, '#e6b422');
    vb.box(0, 0.66, 0, 4, 0.05, 3, '#b23a48');
    for (const x of [-4.6, 4.6]) { vb.box(x, 0, 4.4, 0.6, 0.9, 0.6, '#e8dcc6'); vb.box(x, 0.9, 4.4, 0.4, 0.6, 0.4, '#3f8f3a'); }
  } },
  masjid: { label: 'Masjid', w: 9, d: 9, build(vb) {
    vb.box(0, 0, 0, 8.4, 0.4, 8.4, '#d8d2c4');
    vb.box(0, 0.4, 0, 7, 3.4, 7, '#f6f2e8');
    vb.box(0, 3.8, 0, 7.4, 0.3, 7.4, '#1f7a4d');
    for (const s of [-1, 1]) for (const p of [-2.2, 0, 2.2]) {
      vb.box(p, 1.4, s * 3.51, 0.9, 1.5, 0.06, 'win'); vb.box(s * 3.51, 1.4, p, 0.06, 1.5, 0.9, 'win');
    }
    vb.box(0, 0.4, 3.52, 1.4, 2.2, 0.08, '#1f7a4d');
    // kubah bertingkat
    vb.box(0, 4.1, 0, 5, 0.9, 5, '#2e8b57').box(0, 5.0, 0, 4.2, 0.8, 4.2, '#2e8b57').box(0, 5.8, 0, 3.2, 0.7, 3.2, '#2e8b57').box(0, 6.5, 0, 2, 0.6, 2, '#2e8b57').box(0, 7.1, 0, 0.9, 0.4, 0.9, '#2e8b57');
    vb.box(0, 7.5, 0, 0.25, 1, 0.25, '#e6b422').box(0, 8.3, 0, 0.6, 0.15, 0.15, '#e6b422');
    // menara
    vb.box(3.6, 0, 3.6, 1.3, 9, 1.3, '#f6f2e8');
    for (const y of [3, 6]) vb.box(3.6, y, 3.6, 1.5, 0.3, 1.5, '#1f7a4d');
    vb.box(3.6, 9, 3.6, 1.6, 0.3, 1.6, '#1f7a4d').box(3.6, 9.3, 3.6, 1, 0.7, 1, '#2e8b57').box(3.6, 10, 3.6, 0.2, 0.7, 0.2, '#e6b422');
    vb.box(3.6, 7.2, 3.6, 1.36, 0.6, 1.36, 'win');
  } },
  posronda: { label: 'Pos Ronda', w: 3, d: 3, build(vb) {
    vb.box(0, 0, 0, 2.6, 0.6, 2.2, '#9c6b3c');
    for (const x of [-1.2, 1.2]) for (const z of [-1, 1]) vb.box(x, 0, z, 0.2, 2.3, 0.2, '#6b4a2a');
    vb.box(0, 2.3, 0, 3.1, 0.3, 2.7, '#8a6d3b').box(0, 2.6, 0, 2.2, 0.3, 1.8, '#9b7b45').box(0, 2.9, 0, 1.2, 0.3, 0.9, '#8a6d3b');
    vb.box(1.2, 1.2, 1.15, 0.22, 0.8, 0.22, '#c47a2c');
    vb.box(-0.6, 0.6, 0.3, 0.6, 0.1, 0.6, '#3d7ea6');
    vb.box(0, 2.0, 0, 0.3, 0.3, 0.3, 'lamp');
  } },
  warung: { label: 'Warung', w: 3, d: 3, build(vb, b, ex) {
    vb.box(0, 0, -0.3, 2.6, 2.1, 1.8, '#c9935b');
    vb.box(0, 0, 0.75, 2.6, 0.9, 0.5, '#8a5a32');
    for (let i = 0; i < 6; i++) vb.box(-1.1 + i * 0.44, 2.1, 0.5, 0.44, 0.12, 1.6, i % 2 ? '#ffffff' : '#e63946');
    vb.box(0, 2.1, -0.3, 2.9, 0.3, 2, '#8e3b2e');
    vb.box(0, 0, 1.6, 2.2, 0.45, 0.45, '#6b4a2a');
    for (let i = 0; i < 4; i++) vb.box(-0.9 + i * 0.6, 0.9, 0.75, 0.25, 0.3, 0.25, ['#ffd166', '#06d6a0', '#ef476f', '#118ab2'][i]);
    vb.box(0, 1.6, 0.62, 0.3, 0.3, 0.3, 'lamp');
    const sg = signMesh('KOPI', 1.4, 0.45, '#3d2a1e', '#ffd166'); sg.position.set(0, 2.55, 0.61); ex.push(sg);
  } },
  perumahan: { label: 'Perumahan', w: 10, d: 12, build(vb, b, ex, r) {
    const pos = [[-2.6, -4], [2.6, -4], [-2.6, 0], [2.6, 0], [-2.6, 4], [2.6, 4]];
    const n = Math.max(1, Math.min(6, b.jumlah || 6));
    for (let i = 0; i < n; i++) rumah(vb, pos[i][0], pos[i][1], PALET_RUMAH[Math.floor(r() * PALET_RUMAH.length)], r);
    vb.box(0, 0, 0, 0.9, 0.05, 11.5, '#cfc6b4');
    for (const [x, z] of [[-4.6, 5.6], [4.6, -5.6]]) pohon(vb, x, z, r);
  } },
  pasar: { label: 'Pasar', w: 12, d: 10, build(vb, b, ex, r) {
    vb.box(0, 0, 0, 12, 0.15, 10, '#cfc6b4');
    vb.box(0, 0.15, -2.5, 11, 3.2, 4, '#f2e6cf');
    vb.box(0, 3.35, -2.5, 11.6, 0.4, 4.6, '#2f6f91').box(0, 3.75, -2.5, 10, 0.5, 3, '#3a86b0').box(0, 4.25, -2.5, 7, 0.5, 1.2, '#2f6f91');
    for (const x of [-4, -2, 0, 2, 4]) vb.box(x, 0.15, -0.49, 1.3, 2.2, 0.06, '#4a3426');
    const sg = signMesh('PASAR KOTA', 4.2, 0.8, '#ffffff', '#2f6f91'); sg.position.set(0, 2.75, -0.45); ex.push(sg);
    const atap = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8d5a97'];
    for (let i = 0; i < 4; i++) {
      const x = -4.2 + i * 2.8, z = 2.6;
      for (const sx of [-1, 1]) for (const sz of [-0.8, 0.8]) vb.box(x + sx * 1.05, 0.15, z + sz, 0.12, 1.9, 0.12, '#6b4a2a');
      vb.box(x, 0.15, z + 0.3, 2.2, 0.8, 1, '#a0703f');
      for (let k = 0; k < 6; k++) vb.box(x - 0.9 + (k % 3) * 0.9, 1.0 + Math.floor(k / 3) * 0.05, z + 0.05 + Math.floor(k / 3) * 0.4, 0.6, 0.22, 0.35, ['#d62828', '#f77f00', '#90be6d', '#ffd166', '#c0c0c0'][Math.floor(r() * 5)]);
      for (let k = 0; k < 4; k++) vb.box(x - 0.825 + k * 0.55, 2.05, z, 0.55, 0.18, 2, k % 2 ? '#ffffff' : atap[i]);
    }
  } },
  tambak: { label: 'Tambak', w: 14, d: 6, build(vb, b, ex, r) {
    vb.box(0, 0, 0, 14, 0.35, 6, '#8b6b4a');
    for (const x of [-4.6, 0, 4.6]) vb.box(x, 0.05, 0, 4.1, 0.25, 5.2, 'tambak');
    // kincir air
    for (const x of [-4.6, 4.6]) { vb.box(x, 0.3, 0.8, 0.3, 0.3, 0.9, '#e9c46a'); vb.box(x, 0.2, 0.8, 1.0, 0.3, 0.12, '#ffd166'); }
    // gubuk jaga
    vb.box(2, 0.35, -1.6, 0.15, 1.4, 0.15, '#6b4a2a').box(3, 0.35, -1.6, 0.15, 1.4, 0.15, '#6b4a2a');
    vb.box(2.5, 1.2, -1.6, 1.4, 0.15, 1.1, '#a0703f').box(2.5, 1.9, -1.6, 1.7, 0.25, 1.4, '#8a6d3b').box(2.5, 2.15, -1.6, 0.9, 0.25, 0.8, '#9b7b45');
    // ikan bandeng muncul
    for (let i = 0; i < 6; i++) vb.box(-6 + r() * 12, 0.31, -2 + r() * 4, 0.35, 0.06, 0.12, '#cfd8dc');
  } },
  sawah: { label: 'Sawah', w: 10, d: 12, build(vb, b, ex, r) {
    vb.box(0, 0, 0, 10, 0.18, 12, '#7a5a34');
    for (let x = -4.4; x <= 4.4; x += 0.8) for (let z = -5.4; z <= 5.4; z += 0.8) {
      if (Math.abs(z) < 0.5) continue;
      vb.box(x, 0.18, z, 0.32, 0.35 + r() * 0.3, 0.32, r() < 0.5 ? '#9acd32' : '#7cb342');
    }
    vb.box(0, 0.18, 0, 10, 0.06, 0.7, '#a1855c');
    // orang-orangan sawah
    vb.box(-3, 0.2, 3, 0.15, 1.6, 0.15, '#6b4a2a').box(-3, 1.2, 3, 1.2, 0.12, 0.12, '#6b4a2a').box(-3, 1.0, 3, 0.5, 0.6, 0.3, '#e63946').box(-3, 1.6, 3, 0.4, 0.4, 0.4, '#f1c27d').box(-3, 2.0, 3, 0.9, 0.12, 0.9, '#d4a64a');
    // saung
    for (const x of [2.6, 4]) for (const z of [-4.2, -3]) vb.box(x, 0.18, z, 0.15, 1.3, 0.15, '#6b4a2a');
    vb.box(3.3, 0.7, -3.6, 1.6, 0.12, 1.4, '#a0703f').box(3.3, 1.45, -3.6, 1.9, 0.25, 1.7, '#8a6d3b').box(3.3, 1.7, -3.6, 1.0, 0.25, 0.9, '#9b7b45');
  } },
  candi: { label: 'Candi', w: 8, d: 8, build(vb) {
    const bata = '#a4462f', gelap = '#7f3424';
    vb.box(0, 0, 0, 7.4, 0.8, 7.4, bata).box(0, 0.8, 0, 6.2, 1.0, 6.2, gelap).box(0, 1.8, 0, 4.6, 2.6, 4.6, bata);
    vb.box(0, 0, 3.9, 1.6, 0.8, 1.2, gelap).box(0, 0.8, 3.4, 1.4, 1.0, 1.0, bata).box(0, 1.8, 2.31, 1.1, 1.6, 0.08, '#3b1a12');
    vb.box(0, 4.4, 0, 5.0, 0.5, 5.0, gelap).box(0, 4.9, 0, 4.0, 0.8, 4.0, bata).box(0, 5.7, 0, 3.0, 0.8, 3.0, gelap).box(0, 6.5, 0, 2.0, 0.8, 2.0, bata).box(0, 7.3, 0, 1.0, 0.7, 1.0, gelap).box(0, 8.0, 0, 0.45, 0.8, 0.45, bata);
    for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) vb.box(x, 4.9, z, 0.6, 1, 0.6, bata);
    for (const [x, z] of [[-3.4, -3.4], [3.4, 3.4], [-3.4, 3.4], [3.4, -3.4]]) vb.box(x, 0, z, 0.6, 0.9, 0.6, '#5c6b52');
  } },
  sekolah: { label: 'Sekolah', w: 10, d: 7, build(vb, b, ex) {
    vb.box(0, 0, 0, 10, 0.12, 7, '#cfc6b4');
    vb.box(0, 0.12, -1.6, 9.4, 3, 3.4, '#f4ecd8');
    vb.box(0, 0.12, -1.6, 9.6, 0.5, 3.6, '#c44536');
    vb.box(0, 3.12, -1.6, 10, 0.4, 4.2, '#c44536').box(0, 3.52, -1.6, 8.6, 0.45, 2.8, '#a63a2e').box(0, 3.97, -1.6, 6.8, 0.4, 1.4, '#c44536');
    for (const x of [-3.6, -1.8, 0, 1.8, 3.6]) vb.box(x, 1.3, 0.11, 1.1, 1.0, 0.06, 'win');
    vb.box(0, 0.12, 0.12, 1, 1.9, 0.08, '#6d4527');
    vb.box(0, 0.12, 2.4, 0.12, 4.2, 0.12, '#dddddd').box(0.55, 3.7, 2.4, 0.9, 0.3, 0.04, '#e63946').box(0.55, 3.4, 2.4, 0.9, 0.3, 0.04, '#ffffff');
    const sg = signMesh('SD SIDOARJOVERSE', 4, 0.5, '#ffffff', '#c44536'); sg.position.set(0, 2.6, 0.13); ex.push(sg);
  } },
  puskesmas: { label: 'Puskesmas', w: 8, d: 6, build(vb) {
    vb.box(0, 0, 0, 8, 0.12, 6, '#cfc6b4');
    vb.box(0, 0.12, -0.8, 7.2, 2.8, 3.6, '#fbfbfb');
    vb.box(0, 2.92, -0.8, 7.6, 0.35, 4, '#2a9d8f').box(0, 3.27, -0.8, 6, 0.35, 2.6, '#268c80');
    for (const x of [-2.6, -1.3, 1.3, 2.6]) vb.box(x, 1.2, 1.01, 0.9, 0.9, 0.06, 'win');
    vb.box(0, 0.12, 1.02, 1.2, 1.9, 0.06, '#9fd3c7');
    vb.box(0, 2.15, 1.04, 0.9, 0.6, 0.06, '#ffffff').box(0, 2.3, 1.08, 0.6, 0.18, 0.04, '#e63946').box(0, 2.15, 1.08, 0.18, 0.5, 0.04, '#e63946');
    vb.box(0, 0.12, 1.9, 2.8, 0.06, 1.6, '#e0dbd0');
    vb.box(-2.6, 0.12, 2.1, 2.2, 1.0, 1.1, '#ffffff').box(-2.0, 1.12, 2.1, 1.0, 0.5, 1.0, '#ffffff').box(-3.0, 0.7, 2.66, 0.5, 0.2, 0.02, '#e63946');
  } },
  tugu: { label: 'Tugu', w: 6, d: 6, build(vb) {
    vb.box(0, 0, 0, 6, 0.15, 6, '#d9cbb0').box(0, 0.15, 0, 4, 0.5, 4, '#e8e2d4').box(0, 0.65, 0, 2.8, 0.6, 2.8, '#d6cfbf').box(0, 1.25, 0, 1.6, 1.4, 1.6, '#e8e2d4');
    vb.box(0, 2.65, 0, 1.0, 6.5, 1.0, '#f5f1e6').box(0, 5.0, 0, 1.16, 0.4, 1.16, '#2a9d8f').box(0, 9.15, 0, 1.3, 0.3, 1.3, '#e6b422').box(0, 9.45, 0, 0.6, 1, 0.6, '#e6b422');
    for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) vb.box(x, 0.15, z, 0.6, 0.5, 0.6, '#5aa65a');
  } },
  lapangan: { label: 'Lapangan', w: 12, d: 8, build(vb) {
    vb.box(0, 0, 0, 12, 0.1, 8, '#5fae4f');
    vb.box(0, 0.1, 0, 11, 0.02, 0.08, '#fff').box(0, 0.1, 3.5, 11, 0.02, 0.08, '#fff').box(0, 0.1, -3.5, 11, 0.02, 0.08, '#fff');
    vb.box(-5.5, 0.1, 0, 0.08, 0.02, 7, '#fff').box(5.5, 0.1, 0, 0.08, 0.02, 7, '#fff').box(0, 0.1, 0, 0.08, 0.02, 7, '#fff');
    for (const s of [-1, 1]) { vb.box(s * 5.5, 0.1, -1, 0.12, 1.2, 0.12, '#fff').box(s * 5.5, 0.1, 1, 0.12, 1.2, 0.12, '#fff').box(s * 5.5, 1.3, 0, 0.12, 0.12, 2.12, '#fff'); }
  } },
  rumah: { label: 'Rumah', w: 4, d: 4, build(vb, b, ex, r) { rumah(vb, 0, 0, PALET_RUMAH[Math.floor(r() * PALET_RUMAH.length)], r); } },
  kantor: { label: 'Gedung', w: 8, d: 6, build(vb) {
    vb.box(0, 0, 0, 8, 0.12, 6, '#cfc6b4');
    vb.box(0, 0.12, -0.5, 6.4, 6, 4, '#e9edf2');
    for (let y = 1; y < 6; y += 1.2) for (const x of [-2.2, -0.75, 0.75, 2.2]) vb.box(x, y, 1.51, 1, 0.7, 0.06, 'win');
    vb.box(0, 6.12, -0.5, 6.8, 0.4, 4.4, '#0f4c5c');
    vb.box(0, 0.12, 1.55, 1.4, 1.6, 0.06, '#0f4c5c');
  } },
};

// ---------------------------------------------------------------- papan pengumuman
export const PAPAN_BAWAAN = {
  tampil: true, judul: 'PENGUMUMAN', x: 2.9, z: -2.9, rot: 45,
  isi: 'Selamat datang di SidoarjoVerse!\nFollow = jadi warga\nKomen like terbanyak = besok dibangun\nBikin KTP-mu di tab KTP',
};
function bungkus(ctx, teks, maks) {   // pecah teks jadi baris yang muat
  const hasil = [];
  for (const par of String(teks || '').split('\n')) {
    let baris = '';
    for (const k of par.split(' ')) { const coba = baris ? baris + ' ' + k : k; if (ctx.measureText(coba).width > maks && baris) { hasil.push(baris); baris = k; } else baris = coba; }
    hasil.push(baris);
  }
  return hasil;
}
function buatPapan(pp) {
  const g = new THREE.Group();
  const kayu = mat('#8a6440'), kayuGelap = mat('#6e4e31');
  for (const x of [-1.15, 1.15]) { const t = new THREE.Mesh(UNIT, kayuGelap); t.scale.set(0.16, 2.7, 0.16); t.position.set(x, 1.35, 0); t.castShadow = true; g.add(t); }
  const bingkai = new THREE.Mesh(UNIT, kayu); bingkai.scale.set(2.5, 1.7, 0.14); bingkai.position.set(0, 1.75, 0); bingkai.castShadow = true; g.add(bingkai);
  const atap = new THREE.Mesh(UNIT, kayuGelap); atap.scale.set(2.8, 0.14, 0.42); atap.position.set(0, 2.68, 0.04); atap.castShadow = true; g.add(atap);
  // kertas pengumuman (tekstur dari teks admin)
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 680;
  const c = cv.getContext('2d');
  c.fillStyle = '#fbf6ea'; c.fillRect(0, 0, 1024, 680);
  c.fillStyle = '#0f4c5c'; c.fillRect(0, 0, 1024, 150);
  c.fillStyle = '#ffd166'; c.font = '900 76px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  let j = String(pp.judul || 'PENGUMUMAN').toUpperCase(), fs = 76;
  while (c.measureText(j).width > 940 && fs > 30) { fs -= 4; c.font = `900 ${fs}px system-ui, sans-serif`; }
  c.fillText(j, 512, 80);
  c.fillStyle = '#16324f'; c.textAlign = 'left';
  let isi = 48; c.font = `700 ${isi}px system-ui, sans-serif`;
  let baris = bungkus(c, pp.isi, 920);
  while (baris.length * isi * 1.3 > 480 && isi > 22) { isi -= 2; c.font = `700 ${isi}px system-ui, sans-serif`; baris = bungkus(c, pp.isi, 920); }
  baris.forEach((t, i) => c.fillText(t, 52, 210 + i * isi * 1.3));
  for (const [x, y] of [[40, 175], [984, 175]]) { c.fillStyle = '#e63946'; c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill(); }
  const kertas = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.53), new THREE.MeshStandardMaterial({ map: canvasTex(cv), roughness: 0.9 }));
  kertas.position.set(0, 1.75, 0.075); g.add(kertas);
  const belakang = kertas.clone(); belakang.rotation.y = Math.PI; belakang.position.z = -0.075; g.add(belakang);
  return g;
}

// ---------------------------------------------------------------- karakter
// ---- gaya "figur premium": kepala bulat, badan tegap bersudut bulat, kaki jenjang, wajah minimalis ekspresif, material matte
const GEO = {
  bola: new THREE.SphereGeometry(0.5, 32, 24),
  bolaKecil: new THREE.SphereGeometry(0.5, 16, 12),
  kapsul: new THREE.CapsuleGeometry(0.5, 1, 8, 16),
  tabung: new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
  badan: new RoundedBoxGeometry(1, 1, 1, 5, 0.18),
};
const MATS_HALUS = new Map();
function matHalus(c) { // material matte (doff) untuk karakter
  let m = MATS_HALUS.get(c);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0 }); MATS_HALUS.set(c, m); }
  return m;
}
// Ekspresi: mata, alis, mulut (+ keringat). Nama yang hanya mengubah mulut: diam, buka, senyum, o.
export const EKSPRESI = {
  normal:  { mata: 'normal', alis: [0, 0], mulut: 'senyum' },
  senang:  { mata: 'tutup',  alis: [0.045, 0.045], mulut: 'tawa', merona: true },
  nyengir: { mata: 'normal', alis: [0.03, 0.03], mulut: 'nyengir' },
  skeptis: { mata: 'lirik',  alis: [0.08, -0.03], mulut: 'datar', miring: 0.35 },
  marah:   { mata: 'normal', alis: [-0.045, -0.045], mulut: 'cemberut', alisSudut: -0.6 },
  sedih:   { mata: 'normal', alis: [0.03, 0.03], mulut: 'cemberut', alisSudut: 0.5 },
  kaget:   { mata: 'besar',  alis: [0.085, 0.085], mulut: 'o' },
  bosan:   { mata: 'garis',  alis: [-0.01, -0.01], mulut: 'datar' },
  panik:   { mata: 'besar',  alis: [0.05, 0.05], mulut: 'buka', alisSudut: 0.45, keringat: true },
  tidur:   { mata: 'garis',  alis: [-0.015, -0.015], mulut: 'o' },
};
const HANYA_MULUT = new Set(['diam', 'buka', 'senyum', 'o']);   // untuk gerak bibir saat bicara
// ---- bentuk mulut ekspresif (bidang datar ditempel ke wajah)
const _matMulut = {};
const mm = c => _matMulut[c] || (_matMulut[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
function mulutTawa(r) {          // tertawa: rongga mulut + gigi atas + lidah
  const g = new THREE.Group();
  const rongga = new THREE.Mesh(new THREE.CircleGeometry(r, 28, Math.PI, Math.PI), mm('#3a1212')); g.add(rongga);
  const gigi = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.62, r * 0.36), mm('#fbfaf6')); gigi.position.set(0, -r * 0.2, 0.002); g.add(gigi);
  const lidah = new THREE.Mesh(new THREE.CircleGeometry(r * 0.48, 20, 0, Math.PI), mm('#e36f78')); lidah.position.set(0, -r * 0.98, 0.003); g.add(lidah);
  const atas = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.04, r * 0.08), mm('#3a1212')); atas.position.set(0, 0, 0.004); g.add(atas);
  return g;
}
function mulutNyengir() {        // nyengir: senyum lebar memperlihatkan gigi
  const g = new THREE.Group(), w = 0.21, h = 0.085;
  const luar = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mm('#3a1212')); luar.scale.set(w / 2, h / 2, 1); g.add(luar);
  const gigi = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mm('#fbfaf6')); gigi.scale.set(w / 2 - 0.008, h / 2 - 0.009, 1); gigi.position.z = 0.002; g.add(gigi);
  const garis = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, 0.005), mm('#c9c4ba')); garis.position.z = 0.004; g.add(garis);
  return g;
}
function mulutBuka() {           // bicara: mulut terbuka + gigi atas + lidah
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.CircleGeometry(1, 24), mm('#3a1212')); r.scale.set(0.05, 0.04, 1); g.add(r);
  const gigi = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.014), mm('#fbfaf6')); gigi.position.set(0, 0.024, 0.002); g.add(gigi);
  const lidah = new THREE.Mesh(new THREE.CircleGeometry(0.024, 16, 0, Math.PI), mm('#e36f78')); lidah.position.set(0, -0.036, 0.003); g.add(lidah);
  return g;
}
function makeChar(look, opt = {}) {
  const g = new THREE.Group();
  const M = matHalus;
  const mesh = (geo, c, sx, sy, sz, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, typeof c === 'string' ? M(c) : c); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const baju = opt.baju || look.baju, celana = opt.celana || look.celana;
  const kain = opt.batik ? matBatik(opt.batik) : baju;
  const legs = [], arms = [];
  // kaki jenjang + sepatu sneakers
  for (const s of [-0.14, 0.14]) {
    const p = new THREE.Group(); p.position.set(s, 0.92, 0); g.add(p);
    mesh(GEO.kapsul, celana, 0.23, 0.35, 0.24, 0, -0.42, 0, p);
    mesh(GEO.bolaKecil, '#f3f1ec', 0.21, 0.13, 0.32, 0, -0.86, 0.05, p);
    mesh(GEO.bolaKecil, '#cfcac0', 0.215, 0.04, 0.325, 0, -0.91, 0.05, p);
    legs.push(p);
  }
  // badan tegap bersudut bulat
  mesh(GEO.badan, kain, 0.62, 0.82, 0.38, 0, 1.3, 0);
  if (opt.kaos) {   // kemeja terbuka: kaos di dalam terlihat, kerah + kancing di tepi kemeja
    const kaos = mesh(GEO.badan, opt.kaos, 0.24, 0.8, 0.06, 0, 1.3, 0.172);
    mesh(GEO.tabung, opt.kaos, 0.2, 0.02, 0.1, 0, 1.69, 0.13).rotation.x = Math.PI / 2 - 0.3;      // leher kaos
    const tepi = kain.userData.manset || gelap(baju);
    for (const sx of [-1, 1]) {
      mesh(GEO.badan, kain, 0.05, 0.8, 0.05, sx * 0.135, 1.3, 0.19);                              // tepi kemeja (plaket)
      const kr = mesh(GEO.badan, kain, 0.17, 0.13, 0.04, sx * 0.13, 1.64, 0.2); kr.rotation.set(-0.25, 0, sx * 0.55);  // kerah
      mesh(GEO.badan, tepi, 0.012, 0.8, 0.052, sx * 0.112, 1.3, 0.192);                             // garis jahitan
    }
    for (const y of [1.5, 1.32, 1.14, 0.97]) mesh(GEO.bolaKecil, '#f4ecd8', 0.028, 0.028, 0.015, -0.135, y, 0.217);   // kancing
  }
  if (opt.selempang) { // selempang diagonal menempel di badan
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 48), M(opt.selempang));
    t.rotation.order = 'ZYX'; t.rotation.set(0, Math.PI / 2, 0.9); t.scale.set(0.5, 1.0, 0.93); t.position.set(0, 1.32, 0); g.add(t);
  }
  if (!opt.akuarium && !opt.batik) for (const y of [1.45, 1.25, 1.05]) mesh(GEO.bolaKecil, '#ffffff', 0.04, 0.04, 0.02, 0, y, 0.225);
  mesh(GEO.tabung, look.kulit, 0.17, 0.12, 0.17, 0, 1.73, 0);                          // leher
  // lengan + tangan
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * 0.38, 1.6, 0); g.add(p);
    mesh(GEO.kapsul, kain, 0.16, 0.3, 0.16, 0, -0.32, 0, p);
    mesh(GEO.bola, look.kulit, 0.15, 0.17, 0.15, 0, -0.7, 0, p);
    if (opt.batik) mesh(GEO.tabung, kain.userData.manset, 0.165, 0.04, 0.165, 0, -0.6, 0, p);   // manset lengan panjang
    if (opt.tongkat && s < 0) {   // tongkat komando di tangan kiri
      const tk = new THREE.Group(); tk.position.set(0, -0.72, 0.03); tk.rotation.set(1.15, 0, 0.12); p.add(tk);
      mesh(GEO.tabung, '#2a2320', 0.045, 0.62, 0.045, 0, 0.12, 0, tk);
      mesh(GEO.bola, '#d9a81e', 0.07, 0.07, 0.07, 0, 0.44, 0, tk);
      mesh(GEO.tabung, '#d9a81e', 0.05, 0.06, 0.05, 0, -0.2, 0, tk);
      mesh(GEO.tabung, '#d9a81e', 0.052, 0.02, 0.052, 0, 0.3, 0, tk);
    }
    if (opt.jam && s < 0) {
      mesh(GEO.tabung, '#5a3a22', 0.17, 0.05, 0.17, 0, -0.56, 0, p);
      const mk = mesh(GEO.tabung, '#d9a81e', 0.07, 0.03, 0.07, 0, -0.56, 0.085, p); mk.rotation.x = Math.PI / 2;
      mesh(GEO.tabung, '#fffaf0', 0.05, 0.032, 0.05, 0, -0.56, 0.088, p).rotation.x = Math.PI / 2;
    }
    arms.push(p);
  }
  // kepala bulat (sedikit lonjong)
  const RX = 0.44, RY = 0.46, RZ = 0.43;
  const head = new THREE.Group(); head.position.set(0, 2.16, 0); g.add(head);
  mesh(GEO.bola, look.kulit, RX * 2, RY * 2, RZ * 2, 0, 0, 0, head);
  for (const s of [-1, 1]) mesh(GEO.bolaKecil, look.kulit, 0.1, 0.16, 0.08, s * RX, -0.02, -0.01, head);   // telinga
  if (look.kerudung) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.84), M(look.kerudung));
    k.scale.set(RX * 2.1, RY * 2.08, RZ * 2.1); k.castShadow = true; head.add(k);
    mesh(GEO.bola, look.kerudung, 0.82, 0.5, 0.7, 0, -0.42, -0.04, head);
  } else {
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24, 0, Math.PI * 2, 0, opt.peci ? 1.2 : 1.12), M(look.rambut));
    r.rotation.x = -0.36; r.scale.set(RX * 2.06, RY * 2.04, RZ * 2.08); r.castShadow = true; head.add(r);
    if (opt.gaya === 'genz') {
      // potongan "textured crop": rambut menutup dahi atas, poni berlapis rapi, sisi tipis
      r.geometry = new THREE.SphereGeometry(0.5, 32, 24, 0, Math.PI * 2, 0, 1.32);
      r.rotation.x = -0.12; r.scale.set(RX * 2.1, RY * 2.12, RZ * 2.12); r.position.y = 0.02;
      const helai = [[-0.25, 0.27, 0.3, 0.5], [-0.12, 0.3, 0.36, 0.25], [0.02, 0.31, 0.38, 0.0], [0.15, 0.3, 0.36, -0.25], [0.27, 0.27, 0.3, -0.45]];
      for (const [x, y, z, rz] of helai) {
        const h = mesh(GEO.bola, look.rambut, 0.17, 0.2, 0.13, x, y, z, head); h.rotation.set(0.85, 0, rz);
      }
      mesh(GEO.bola, look.rambut, 0.62, 0.26, 0.56, 0.02, 0.36, 0.0, head);                   // volume atas
      for (const s of [-1, 1]) mesh(GEO.bolaKecil, look.rambut, 0.05, 0.13, 0.07, s * (RX - 0.02), 0.06, 0.13, head); // cambang tipis
    }
    if (look.rambutPanjang) mesh(GEO.bola, look.rambut, 0.84, 0.92, 0.55, 0, -0.14, -0.18, head);
  }
  if (opt.helm) {   // helm proyek (tukang)
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), M(opt.helm));
    hm.scale.set(RX * 2.15, RY * 1.9, RZ * 2.15); hm.position.y = 0.06; hm.castShadow = true; head.add(hm);
    mesh(GEO.tabung, opt.helm, RX * 2.35, 0.03, RZ * 2.5, 0, 0.07, 0.04, head);
  }
  if (opt.peci) {
    const pc = mesh(GEO.tabung, '#151515', 0.6, 0.2, 0.52, 0, 0.42, -0.03, head); pc.rotation.x = -0.12;
    const pb = mesh(GEO.tabung, '#3a3a3a', 0.605, 0.025, 0.525, 0, 0.335, -0.02, head); pb.rotation.x = -0.12;
  }
  // wajah minimalis: setiap fitur ditempel di permukaan kepala
  const muka = new THREE.Group(); head.add(muka);
  const zs = (x, y, off = 0) => RZ * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2 - (y / RY) ** 2)) + off;
  const HIT = '#1b1b1b';
  const Z = new THREE.Vector3(0, 0, 1);
  const tempel = (m, x, y, off) => { m.position.set(x, y, zs(x, y, off)); const n = new THREE.Vector3(x / RX ** 2, y / RY ** 2, zs(x, y) / RZ ** 2).normalize(); m.quaternion.setFromUnitVectors(Z, n); return m; };
  const mataSet = { normal: [], besar: [], tutup: [], garis: [], lirik: [] };
  const alis = [];
  for (const s of [-1, 1]) {
    const x = s * 0.14, y = 0.02;
    const n = tempel(mesh(GEO.bolaKecil, HIT, 0.085, 0.11, 0.04, 0, 0, 0, muka), x, y, -0.006);
    const kn = tempel(mesh(GEO.bolaKecil, '#ffffff', 0.028, 0.03, 0.015, 0, 0, 0, muka), x + 0.018, y + 0.025, 0.012);
    mataSet.normal.push(n, kn);
    mataSet.besar.push(tempel(mesh(GEO.bolaKecil, HIT, 0.12, 0.14, 0.045, 0, 0, 0, muka), x, y + 0.01, -0.006),
      tempel(mesh(GEO.bolaKecil, '#ffffff', 0.035, 0.038, 0.015, 0, 0, 0, muka), x + 0.025, y + 0.045, 0.014));
    const tt = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 14, Math.PI), M(HIT)); muka.add(tempel(tt, x, y - 0.015, 0.004)); tt.rotateZ(0);
    mataSet.tutup.push(tt);
    const gr = tempel(mesh(GEO.kapsul, HIT, 0.022, 0.035, 0.02, 0, 0, 0, muka), x, y, 0.002); gr.rotateZ(Math.PI / 2); mataSet.garis.push(gr);
    mataSet.lirik.push(tempel(mesh(GEO.bolaKecil, HIT, 0.08, 0.075, 0.04, 0, 0, 0, muka), x + 0.035, y - 0.005, -0.006));
    const al = tempel(mesh(GEO.kapsul, opt.peci || !look.rambut ? '#1a1a1a' : look.rambut, 0.03, 0.055, 0.024, 0, 0, 0, muka), x, 0.16, 0.0);
    al.rotateZ(Math.PI / 2); al.userData.dasar = { x, y: 0.16, s }; alis.push(al);
  }
  tempel(mesh(GEO.bolaKecil, gelap(look.kulit), 0.06, 0.05, 0.05, 0, 0, 0, muka), 0, -0.07, -0.012);     // hidung
  const yM = (look.kumis || opt.kumis) ? -0.2 : -0.16;
  if (look.kumis || opt.kumis) for (const s of [-1, 1]) { const k = tempel(mesh(GEO.kapsul, '#2a1a10', 0.04, 0.05, 0.035, 0, 0, 0, muka), s * 0.065, -0.135, -0.004); k.rotateZ(Math.PI / 2 + s * 0.3); }
  if (look.kacamata) {
    const bingkai = M('#2b2622'), lensa = new THREE.MeshStandardMaterial({ color: '#dff1f7', roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false });
    for (const s of [-1, 1]) {
      muka.add(tempel(new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.012, 8, 28), bingkai), s * 0.145, 0.025, 0.03));
      muka.add(tempel(new THREE.Mesh(new THREE.CircleGeometry(0.094, 28), lensa), s * 0.145, 0.025, 0.026));
      const tg = mesh(GEO.kapsul, '#2b2622', 0.016, 0.16, 0.016, s * (RX - 0.02), 0.03, 0.12, head); tg.rotation.x = Math.PI / 2;   // gagang
    }
    const jb = tempel(mesh(GEO.kapsul, '#2b2622', 0.014, 0.022, 0.014, 0, 0, 0, muka), 0, 0.045, 0.034); jb.rotateZ(Math.PI / 2); // jembatan
  }
  const MR = '#5a1f1f';
  const mulut = {
    diam: tempel(mesh(GEO.kapsul, MR, 0.018, 0.03, 0.015, 0, 0, 0, muka), 0, yM, -0.002),
    datar: tempel(mesh(GEO.kapsul, MR, 0.016, 0.05, 0.014, 0, 0, 0, muka), 0.02, yM, -0.002),
    buka: tempel(mesh(GEO.bolaKecil, '#3d1212', 0.1, 0.08, 0.04, 0, 0, 0, muka), 0, yM - 0.01, -0.01),
    o: tempel(mesh(GEO.bolaKecil, '#3d1212', 0.05, 0.06, 0.03, 0, 0, 0, muka), 0, yM - 0.005, -0.008),
    senyum: tempel(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 18, Math.PI), M(MR)), 0, yM + 0.025, -0.006),
    cemberut: tempel(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.013, 6, 18, Math.PI), M(MR)), 0, yM - 0.03, -0.006),
    tawa: tempel(mulutTawa(0.1), 0, yM + 0.015, 0.004),
    nyengir: tempel(mulutNyengir(), 0, yM + 0.005, 0.004),
  };
  // mulut bicara: diganti versi dengan gigi atas agar lebih hidup
  muka.remove(mulut.buka); mulut.buka = tempel(mulutBuka(), 0, yM - 0.005, 0.004);
  mulut.diam.rotateZ(Math.PI / 2); mulut.datar.rotateZ(Math.PI / 2 + 0.12);
  mulut.senyum.rotateZ(Math.PI); muka.add(mulut.senyum, mulut.cemberut, mulut.tawa, mulut.nyengir, mulut.buka);
  const merona = []; for (const s of [-1, 1]) merona.push(tempel(mesh(GEO.bolaKecil, '#f1958f', 0.1, 0.05, 0.02, 0, 0, 0, muka), s * 0.25, -0.1, -0.008));
  // keringat (panik)
  const keringat = new THREE.Group();
  const tetes = new THREE.Mesh(GEO.bolaKecil, new THREE.MeshStandardMaterial({ color: '#7fd0ff', roughness: 0.2, transparent: true, opacity: 0.9 }));
  tetes.scale.set(0.07, 0.09, 0.05); keringat.add(tetes);
  const ujung = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 10), tetes.material); ujung.position.y = 0.06; keringat.add(ujung);
  keringat.position.set(RX * 0.82, 0.22, RZ * 0.45); keringat.visible = false; head.add(keringat);
  let kini = opt.ekspresiAwal || 'normal';
  const setMulut = m => { for (const [k, x] of Object.entries(mulut)) x.visible = k === m; };
  function terapkan(nama) {
    const e = EKSPRESI[nama] || EKSPRESI.normal; kini = nama in EKSPRESI ? nama : 'normal';
    for (const [k, l] of Object.entries(mataSet)) for (const m of l) m.visible = k === e.mata;
    alis.forEach((al, i) => {
      const d = al.userData.dasar, naik = e.alis[i] || 0;
      tempel(al, d.x, d.y + naik, 0.0); al.rotateZ(Math.PI / 2 + (e.alisSudut || 0) * d.s * -1 + (e.miring && i === 0 ? e.miring : 0));
    });
    setMulut(e.mulut); keringat.visible = !!e.keringat; merona.forEach(m => { m.visible = !!e.merona; });
  }
  terapkan(kini);
  head.castShadow = true;
  g.userData.anim = { legs, arms, head };
  // ekspresi(nama): nama ekspresi penuh (EKSPRESI) atau hanya mulut (diam/buka/senyum/o) untuk gerak bibir
  g.userData.ekspresi = m => { if (HANYA_MULUT.has(m)) setMulut(m); else terapkan(m); };
  g.userData.ekspresiKini = () => kini;
  if (opt.akuarium) {
    arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.set(-0.78, 0, -s * 0.42); });
    g.userData.anim.arms = [new THREE.Object3D(), new THREE.Object3D()];
    const ak = buatAkuarium();
    ak.group.scale.setScalar(0.92);
    ak.group.position.set(0, 1.08, 0.6);
    g.add(ak.group);
    g.userData.tick = ak.tick;
  }
  return g;
}
// Batik khas SidoarjoVerse: motif udang & bandeng di atas teal (dibuat dari kode, tanpa gambar luar)
// Palet batik: dasar, garis, motif bandeng, motif udang, titik
export const PALET_BATIK = {
  sage:   ['#b7cdbf', 'rgba(70,100,85,.22)', '#fffaf0', '#d9825b', 'rgba(255,250,240,.8)'],
  lilac:  ['#c9bddb', 'rgba(90,70,120,.2)', '#fffaf0', '#d97b8f', 'rgba(255,250,240,.8)'],
  biru:   ['#a9c3d8', 'rgba(50,80,110,.2)', '#fffaf0', '#e08a5f', 'rgba(255,250,240,.8)'],
  navy:   ['#2f3f5c', 'rgba(255,255,255,.08)', '#f4ecd8', '#f2a65a', 'rgba(244,236,216,.6)'],
  teal:   ['#0f7c8c', 'rgba(8,70,80,.3)', '#f4ecd8', '#f28c28', 'rgba(244,236,216,.75)'],
};
const _batik = {};
function matBatik(nama = 'teal') {
  if (nama === true) nama = 'teal';
  if (_batik[nama]) return _batik[nama];
  const [DASAR, GARIS, BANDENG, UDANG, TITIK] = PALET_BATIK[nama] || PALET_BATIK.teal;
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const c = cv.getContext('2d');
  c.fillStyle = DASAR; c.fillRect(0, 0, N, N);
  // garis lereng tipis (latar)
  c.strokeStyle = GARIS; c.lineWidth = 2;
  for (let i = -N; i < N * 2; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i - N, N); c.stroke(); }
  const bandeng = (x, y, s, rot) => {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.fillStyle = BANDENG; c.beginPath(); c.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-18, 0); c.lineTo(-32, -10); c.lineTo(-28, 0); c.lineTo(-32, 10); c.closePath(); c.fill();
    c.fillStyle = DASAR; c.beginPath(); c.arc(13, -2, 2.2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = DASAR; c.lineWidth = 1.6; for (const k of [-6, 0, 6]) { c.beginPath(); c.arc(k, 0, 5, -1.1, 1.1); c.stroke(); }
    c.restore();
  };
  const udang = (x, y, s, rot) => {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.strokeStyle = UDANG; c.lineCap = 'round';
    c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 13, Math.PI * 0.15, Math.PI * 1.25); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(12, 6); c.quadraticCurveTo(26, 8, 30, -6); c.stroke();
    c.beginPath(); c.moveTo(12, 6); c.quadraticCurveTo(24, 14, 32, 4); c.stroke();
    c.fillStyle = UDANG; c.beginPath(); c.moveTo(-10, -9); c.lineTo(-20, -16); c.lineTo(-16, -4); c.closePath(); c.fill();
    c.restore();
  };
  const sel = N / 3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const x = sel * (i + 0.5) + (j % 2 ? sel / 2 : 0), y = sel * (j + 0.5);
    for (const dx of [0, -N]) { if ((i + j) % 2) udang(x + dx, y, 1.15, 0.4); else bandeng(x + dx, y, 1.15, -0.3); }
  }
  // isen-isen titik
  c.fillStyle = TITIK;
  for (let i = 0; i < 40; i++) { const x = (i * 71) % N, y = (i * 137 + 20) % N; c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
  const tx = canvasTex(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 1.5);
  _batik[nama] = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.85 });
  _batik[nama].userData.manset = gelap(DASAR);
  return _batik[nama];
}
function gelap(hex) { const c = new THREE.Color(hex); c.multiplyScalar(0.86); return '#' + c.getHexString(); }

// Ikon Cak Darjo: akuarium bundar berisi bandeng & udang (khas Kota Delta)
export function buatAkuarium() {
  const grp = new THREE.Group();
  const R = 0.4;
  const kaca = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 2),
    new THREE.MeshPhongMaterial({ color: '#dff6ff', transparent: true, opacity: 0.28, shininess: 120, specular: '#ffffff', depthWrite: false }));
  kaca.renderOrder = 3;
  const air = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.92, 2), new THREE.MeshLambertMaterial({ color: '#46b4e6', transparent: true, opacity: 0.42, depthWrite: false }));
  air.scale.y = 0.78; air.position.y = -0.05; air.renderOrder = 2;
  const bibir = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.035, 6, 16), new THREE.MeshLambertMaterial({ color: '#bfe9f7' }));
  bibir.rotation.x = Math.PI / 2; bibir.position.y = R * 0.83;
  const pasir = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.5, 0.08, 10), new THREE.MeshLambertMaterial({ color: '#ead7a4' }));
  pasir.position.y = -R * 0.8;
  grp.add(pasir, air, bibir, kaca);
  // rumput air
  const hijau = mat('#3fa34d');
  for (const [x, z, h] of [[-0.14, -0.08, 0.22], [-0.09, -0.12, 0.16], [0.15, -0.1, 0.18]]) {
    const r = new THREE.Mesh(UNIT, hijau); r.scale.set(0.03, h, 0.03); r.position.set(x, -R * 0.75 + h / 2, z); grp.add(r);
  }
  // bandeng: badan perak memanjang, punggung kebiruan, ekor bercabang
  const bandeng = new THREE.Group();
  const kotak = (w, h, d, c, x, y, z, p = bandeng) => { const m = new THREE.Mesh(UNIT, mat(c)); m.scale.set(w, h, d); m.position.set(x, y, z); p.add(m); return m; };
  kotak(0.3, 0.085, 0.07, '#d9e2e8', 0, 0, 0);
  kotak(0.26, 0.03, 0.072, '#7f97a8', 0, 0.035, 0);
  kotak(0.06, 0.06, 0.074, '#c7d2da', 0.16, -0.005, 0);
  kotak(0.012, 0.016, 0.076, '#111', 0.175, 0.012, 0);
  const e1 = kotak(0.08, 0.025, 0.02, '#a9b8c3', -0.18, 0.025, 0); e1.rotation.z = 0.55;
  const e2 = kotak(0.08, 0.025, 0.02, '#a9b8c3', -0.18, -0.025, 0); e2.rotation.z = -0.55;
  kotak(0.06, 0.03, 0.01, '#a9b8c3', 0.0, 0.065, 0);
  bandeng.scale.setScalar(0.95);
  grp.add(bandeng);
  // udang kecil: ruas oranye melengkung + sungut
  const udang = new THREE.Group();
  const ruas = ['#ff8a5b', '#ff7a4a', '#ff8a5b', '#ff9b70'];
  ruas.forEach((c, i) => { const m = kotak(0.045, 0.04, 0.04, c, -i * 0.04, -i * i * 0.006, 0, udang); m.rotation.z = -i * 0.25; });
  kotak(0.03, 0.03, 0.05, '#ff7a4a', -0.17, -0.05, 0, udang);
  const s1 = kotak(0.1, 0.006, 0.006, '#ffb08f', 0.06, 0.03, 0.012, udang); s1.rotation.z = 0.5;
  const s2 = kotak(0.1, 0.006, 0.006, '#ffb08f', 0.06, 0.03, -0.012, udang); s2.rotation.z = 0.35;
  kotak(0.01, 0.01, 0.045, '#111', 0.02, 0.018, 0, udang);
  udang.position.set(0.06, -R * 0.62, 0.08);
  grp.add(udang);
  const tick = t => {
    const a = t * 0.9;   // bandeng berenang memutar
    bandeng.position.set(Math.cos(a) * 0.16, 0.02 + Math.sin(t * 1.7) * 0.03, Math.sin(a) * 0.16);
    bandeng.rotation.y = -a - Math.PI / 2;
    e1.rotation.y = e2.rotation.y = Math.sin(t * 9) * 0.5;
    udang.position.x = 0.06 + Math.sin(t * 0.6) * 0.1;           // udang merayap di pasir
    udang.rotation.y = Math.cos(t * 0.6) > 0 ? 0 : Math.PI;
    udang.position.y = -R * 0.62 + Math.abs(Math.sin(t * 3)) * 0.012;
  };
  tick(0);
  return { group: grp, tick };
}

// Profil tetap Cak Darjo (dipakai peta, studio video, dan gambar profil)
export const LOOK_DARJO = { kulit: '#ecc39b', baju: '#b7cdbf', celana: '#2e3440', rambut: '#2b211b', kacamata: true };
export const OPT_DARJO = { gaya: 'genz', batik: 'navy', kaos: '#f6f4ef', jam: true, tongkat: true };
export function makeCharUmum(look, opt = {}) { return makeChar(look, opt); }
export function makeCakDarjo(extra = {}) { return makeChar(LOOK_DARJO, Object.assign({}, OPT_DARJO, extra)); }

export function makeAyam(r) {
  const vb = new VB();
  const c = r() < 0.5 ? '#ffffff' : '#c8743c';
  vb.box(0, 0.2, 0, 0.42, 0.34, 0.55, c).box(0, 0.45, 0.25, 0.26, 0.28, 0.26, c).box(0, 0.73, 0.27, 0.08, 0.12, 0.18, '#e63946');
  vb.box(0, 0.5, 0.42, 0.1, 0.07, 0.1, '#f4a261').box(0, 0.35, -0.3, 0.3, 0.28, 0.12, c === '#ffffff' ? '#e0e0e0' : '#7a3e1d');
  vb.box(-0.1, 0, 0, 0.06, 0.2, 0.06, '#f4a261').box(0.1, 0, 0, 0.06, 0.2, 0.06, '#f4a261');
  return vb.build();
}

// ---------------------------------------------------------------- dunia
export function createWorld(canvas, { onPick, onDekat, manual = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // mode ringan otomatis untuk HP / perangkat lambat
  const RINGAN = manual ? false : (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, RINGAN ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;   // bayangan lembut lewat shadow.radius (lebih ringan dari VSM)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // warna lembut ala film
  renderer.toneMappingExposure = 1.12;
  renderer.localClippingEnabled = true;   // untuk bangunan yang sedang dibangun

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#dfe6e4', 60, 165);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  camera.position.set(34, 38, 40);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 12;
  controls.maxDistance = 130;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.addEventListener('change', () => {
    const t = controls.target;
    const cx = THREE.MathUtils.clamp(t.x, -30, 30), cz = THREE.MathUtils.clamp(t.z, -30, 32);
    if (cx !== t.x || cz !== t.z) { camera.position.x += cx - t.x; camera.position.z += cz - t.z; t.x = cx; t.z = cz; }
  });

  const hemi = new THREE.HemisphereLight('#e4eef2', '#8b845c', 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe3bd', 2.6);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(RINGAN ? 1024 : 2048, RINGAN ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
  sun.shadow.bias = -0.0006; sun.shadow.radius = RINGAN ? 2 : 4;
  scene.add(sun);

  const statik = new THREE.Group(); scene.add(statik);
  const bangunanG = new THREE.Group(); scene.add(bangunanG);
  const charsG = new THREE.Group(); scene.add(charsG);
  const awanG = new THREE.Group(); scene.add(awanG);

  const graph = buildGraph();
  const nodeKeys = [...graph.keys()];
  const chars = [];
  const ayam = [];
  let kota = null, maskot = null;
  const bangunanPos = new Map();
  let rintangan = [];   // tapak bangunan (untuk tabrakan & deteksi bangunan terdekat)
  let pohonPos = [];    // posisi pohon (untuk tabrakan)

  // ---------- lingkungan statis
  function buildStatic(footprints) {
    statik.clear();
    const r = rng(7);
    const tanah = new VB();
    const hijau = ['#a2b867', '#a7bc6b', '#9fb464'];
    for (let x = -32; x < 32; x += 2) for (let z = -32; z < 34; z += 2) {
      const cz = z + 1;
      if (cz > RIVER[0] && cz < RIVER[1]) continue;
      tanah.box(x + 1, -0.6, cz, 2, 0.6, 2, hijau[Math.floor(r() * 3)]);
    }
    tanah.box(0, -1.4, 23, 64, 0.8, 4, '#6f5a3c');
    tanah.box(0, -0.75, 23, 64, 0.5, 4, 'water');
    const gt = tanah.build({ shadow: false }); gt.children.forEach(m => { m.castShadow = false; }); statik.add(gt);

    const jalan = new VB();
    const aspal = !!(kota && kota.jalan); // false = masih jalan setapak tanah
    if (aspal) {
      for (const z of LINES) {
        jalan.box(0, 0, z, EDGE * 2, 0.06, ROAD_W, '#6e6b67');
        for (let x = -EDGE + 1; x < EDGE; x += 2.2) if (!LINES.some(l => Math.abs(l - x) < 2)) jalan.box(x, 0.06, z, 1.1, 0.01, 0.14, '#f1f1f1');
      }
      for (const x of LINES) {
        const z1 = -EDGE, z2 = x === 0 ? 31 : 16;
        jalan.box(x, 0, (z1 + z2) / 2, ROAD_W, 0.06, z2 - z1, '#6e6b67');
        for (let z = z1 + 1; z < z2; z += 2.2) if (!LINES.some(l => Math.abs(l - z) < 2) && !(z > RIVER[0] - 1 && z < RIVER[1] + 1)) jalan.box(x, 0.061, z, 0.14, 0.01, 1.1, '#f1f1f1');
      }
      for (const z of LINES) for (const s of [-1, 1]) jalan.box(0, 0, z + s * (ROAD_W / 2 + 0.25), EDGE * 2, 0.12, 0.5, '#d8d0bf');
      for (const z of LINES) for (let x = -24; x <= 24; x += 8) { if (LINES.includes(x)) continue; jalan.box(x, 0, z - 2.1, 0.15, 2.8, 0.15, '#3a3a3a'); jalan.box(x, 2.8, z - 1.8, 0.2, 0.12, 0.8, '#3a3a3a'); jalan.box(x, 2.65, z - 1.45, 0.4, 0.18, 0.4, 'lamp'); }
    } else {
      // jalan setapak tanah
      for (const z of LINES) jalan.box(0, 0, z, EDGE * 2, 0.04, 1.8, '#d7c49c');
      for (const x of LINES) { const z1 = -EDGE, z2 = x === 0 ? 31 : 16; jalan.box(x, 0, (z1 + z2) / 2, 1.8, 0.04, z2 - z1, '#d7c49c'); }
      for (let i = 0; i < 120; i++) { const l = LINES[i % 3], t = (r() - 0.5) * 2 * EDGE; if (i % 2) jalan.box(t, 0.04, l + (r() - 0.5) * 1.4, 0.3, 0.03, 0.3, '#a88a60'); else jalan.box(l + (r() - 0.5) * 1.4, 0.04, Math.min(t, 16), 0.3, 0.03, 0.3, '#a88a60'); }
    }
    // jembatan bambu (selalu ada supaya bisa menyeberang)
    jalan.box(0, 0, 23, aspal ? 3.6 : 2.2, 0.3, 6, '#9c6b3c');
    for (const s of aspal ? [-1.75, 1.75] : [-1.05, 1.05]) { jalan.box(s, 0.3, 23, 0.18, 0.7, 6, '#7a4f2b'); for (let z = 20.2; z <= 25.8; z += 1.4) jalan.box(s, 0.3, z, 0.25, 0.9, 0.25, '#6b4527'); }
    statik.add(jalan.build());

    // pepohonan, hindari jalan, sungai, bangunan
    const pohonVB = new VB();
    const bebas = (x, z, m = 1.5) => {
      if (Math.abs(x) > 31 || z < -31 || z > 32) return false;
      if (z > RIVER[0] - 1 && z < RIVER[1] + 1) return false;
      for (const l of LINES) { if (Math.abs(z - l) < ROAD_W / 2 + m && Math.abs(x) <= EDGE + 1) return false; if (Math.abs(x - l) < ROAD_W / 2 + m && z <= (l === 0 ? 32 : 17)) return false; }
      for (const f of footprints) if (Math.abs(x - f.x) < f.w / 2 + m && Math.abs(z - f.z) < f.d / 2 + m) return false;
      return true;
    };
    let ditanam = 0;
    pohonPos = [];
    for (let i = 0; i < 900 && ditanam < 150; i++) {
      const x = (r() - 0.5) * 64, z = (r() - 0.5) * 66;
      if (!bebas(x, z)) continue;
      pohon(pohonVB, x, z, r, (z > 17 || Math.abs(x) > 27) && r() < 0.6 ? 'kelapa' : 'biasa');
      pohonPos.push([x, z]);
      ditanam++;
    }
    // pohon & semak di tepi sungai
    for (let x = -30; x <= 30; x += 3.3) { if (Math.abs(x) < 3) continue; if (r() < 0.5) pohon(pohonVB, x, RIVER[0] - 0.9, r, 'kelapa'); else pohonVB.bola(x, 0, RIVER[0] - 0.8, 1.1, 0.8, 1.1, '~#7a9a4a'); }
    statik.add(pohonVB.build());

    // ---- detail tanah: ribuan helai rumput, bunga kecil, batu bersegi, bukit di kejauhan
    const diJalan = (x, z, m) => {
      const lebar = (aspal ? ROAD_W / 2 + 0.6 : 1.1) + m;
      for (const l of LINES) { if (Math.abs(z - l) < lebar && Math.abs(x) <= EDGE + 0.5) return true; if (Math.abs(x - l) < lebar && z <= (l === 0 ? 31.5 : 16.5) && z >= -EDGE - 0.5) return true; }
      return z > RIVER[0] - 0.6 && z < RIVER[1] + 0.6;
    };
    const diBangunan = (x, z, m = 0.2) => footprints.some(f => Math.abs(x - f.x) < f.w / 2 + m && Math.abs(z - f.z) < f.d / 2 + m);
    const tabur = (geo, mat, n, cek, skala, warna) => {
      const im = new THREE.InstancedMesh(geo, mat, n); const o = new THREE.Object3D(); const cl = new THREE.Color(); let k = 0;
      for (let t = 0; t < n * 3 && k < n; t++) {
        const x = (r() - 0.5) * 63, z = (r() - 0.5) * 65;
        if (!cek(x, z)) continue;
        const sc = skala(); o.position.set(x, 0, z); o.rotation.set(0, r() * 6.28, (r() - 0.5) * 0.4); o.scale.set(sc, sc * (0.7 + r() * 0.7), sc); o.updateMatrix();
        im.setMatrixAt(k, o.matrix); if (warna) im.setColorAt(k, cl.set(warna[Math.floor(r() * warna.length)])); k++;
      }
      im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; statik.add(im); return im;
    };
    const geoRumput = new THREE.ConeGeometry(0.035, 0.28, 3); geoRumput.translate(0, 0.14, 0);
    tabur(geoRumput, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), RINGAN ? 4500 : 9000,
      (x, z) => !diJalan(x, z, 0) && !diBangunan(x, z), () => 0.7 + r() * 0.8, ['#7a9445', '#86a04c', '#6f8a3e', '#91ab58']);
    const geoBunga = new THREE.IcosahedronGeometry(0.05, 0); geoBunga.translate(0, 0.12, 0);
    tabur(geoBunga, new THREE.MeshStandardMaterial({ roughness: 0.8 }), RINGAN ? 450 : 900,
      (x, z) => !diJalan(x, z, 0.2) && !diBangunan(x, z), () => 0.8 + r() * 0.6, ['#fdfbf3', '#f6d66b', '#c9b7e8', '#f4b7c4']);
    const geoBatu = new THREE.DodecahedronGeometry(0.3, 0); geoBatu.translate(0, 0.12, 0);
    const batu = tabur(geoBatu, new THREE.MeshStandardMaterial({ color: '#bdb5a5', roughness: 0.95, flatShading: true }), 45,
      (x, z) => !diJalan(x, z, 0.8) && !diBangunan(x, z, 1) && !pohonPos.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 2), () => 0.6 + r() * 1.3);
    batu.castShadow = true;
    for (let i = 0; i < 26; i++) {   // bukit low-poly mengelilingi kota (kabut membuatnya samar)
      const a = (i / 26) * Math.PI * 2 + r() * 0.1, rr = 95 + r() * 20;
      const bk = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(['~#a3ad74', '~#98a56c', '~#b0b585'][i % 3]));
      bk.scale.set(16 + r() * 14, 3 + r() * 5, 14 + r() * 10); bk.position.set(Math.cos(a) * rr, -1.2, Math.sin(a) * rr); bk.rotation.y = r() * 3;
      statik.add(bk);
    }

    // awan
    awanG.clear();
    for (let i = 0; i < 9; i++) {
      const vb = new VB();
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) vb.bola(k * 1.8 - n, r() * 0.6, (r() - 0.5) * 2, 2.8 + r() * 1.5, 1.6 + r(), 2.4 + r() * 1.2, '~#fbf7ef');
      const c = vb.build({ shadow: false });
      c.children.forEach(m => { m.material = MAT_AWAN; });
      c.position.set((r() - 0.5) * 170, 58 + r() * 12, (r() - 0.5) * 140); c.scale.setScalar(1.1);
      c.userData.v = 0.4 + r() * 0.6;
      awanG.add(c);
    }
  }

  // ---------- bangunan
  function buildBangunan() {
    bangunanG.clear();
    bangunanPos.clear();
    const fps = [];
    for (const b of kota.bangunan || []) {
      if (b.tampil === false) continue;
      const T = TIPE[b.tipe] || TIPE.rumah;
      const rot = ((+b.rot || 0) % 360) * Math.PI / 180;
      const quarter = Math.round((+b.rot || 0) / 90) % 2 !== 0;
      const w = quarter ? T.d : T.w, d = quarter ? T.w : T.d;
      fps.push({ x: +b.x, z: +b.z, w, d, b, lewat: ['alunalun', 'lapangan'].includes(b.tipe) && b.status !== 'lahan' });
      const holder = new THREE.Group();
      holder.position.set(+b.x, 0, +b.z);
      holder.userData.pick = { jenis: 'bangunan', data: b };
      const r = rng(b.id || b.nama);
      let model;
      if (b.status === 'lahan') {
        const vb = new VB();
        vb.box(0, 0, 0, T.w - 0.4, 0.1, T.d - 0.4, '#b08a5a');
        for (let i = 0; i < 6; i++) vb.box((r() - 0.5) * (T.w - 2), 0.1, (r() - 0.5) * (T.d - 2), 0.5 + r() * 0.6, 0.25, 0.5 + r() * 0.6, '#9a7548');
        pagarKeliling(vb, T.w - 0.6, T.d - 0.6, '#d9c7a3');
        vb.box(0, 0, T.d / 2 - 0.2, 0.15, 1.5, 0.15, '#6b4a2a').box(0, 1.2, T.d / 2 - 0.2, 1.8, 0.8, 0.1, '#f4ecd8');
        model = vb.build();
        const lb = textSprite('Lahan: ' + b.nama, { bg: 'rgba(244,236,216,.95)', fg: '#5c4033', size: 0.8 });
        lb.position.set(0, 2.6, 0); holder.add(lb);
      } else {
        const vb = new VB(); const ex = [];
        T.build(vb, b, ex, r);
        model = vb.build();
        ex.forEach(e => model.add(e));
        const p = b.status === 'dibangun' ? Math.max(0.15, Math.min(1, (+b.progres || 0) / 100)) : 1;
        if (p < 1) {
          const box = new THREE.Box3().setFromObject(model);
          const H = box.max.y;
          // tampilkan bangunan setinggi progres (dipotong bidang horizontal), bukan digepengkan
          const tinggiPotong = Math.max(0.25, H * p);
          const potong = [new THREE.Plane(new THREE.Vector3(0, -1, 0), tinggiPotong)];
          model.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.clippingPlanes = potong; o.material.clipShadows = true; } });
          const sv = new VB();
          const kaki = [[box.min.x - 0.3, box.min.z - 0.3], [box.max.x + 0.3, box.min.z - 0.3], [box.min.x - 0.3, box.max.z + 0.3], [box.max.x + 0.3, box.max.z + 0.3]];
          for (const [x, z] of kaki) sv.box(x, 0, z, 0.14, H + 0.4, 0.14, '#f2a33a');
          for (let y = 1.2; y < H + 0.4; y += 1.4) {
            sv.box((box.min.x + box.max.x) / 2, y, box.min.z - 0.3, box.max.x - box.min.x + 0.6, 0.1, 0.1, '#f2a33a');
            sv.box((box.min.x + box.max.x) / 2, y, box.max.z + 0.3, box.max.x - box.min.x + 0.6, 0.1, 0.1, '#f2a33a');
            sv.box(box.min.x - 0.3, y, (box.min.z + box.max.z) / 2, 0.1, 0.1, box.max.z - box.min.z + 0.6, '#f2a33a');
            sv.box(box.max.x + 0.3, y, (box.min.z + box.max.z) / 2, 0.1, 0.1, box.max.z - box.min.z + 0.6, '#f2a33a');
          }
          for (let i = 0; i < 4; i++) sv.box(box.max.x - 0.6 - i * 0.5, 0, box.max.z + 1.0, 0.45, 0.3, 0.9, '#9e9e9e');
          holder.add(sv.build());
          const lb = textSprite(`🚧 Dibangun ${Math.round(p * 100)}%`, { bg: 'rgba(255,209,102,.96)', fg: '#3d2a00', size: 0.85 });
          lb.position.set(0, H + 0.8, 0); holder.add(lb);
        }
      }
      holder.add(model);
      holder.rotation.y = -rot;
      bangunanG.add(holder);
      if (b.id) bangunanPos.set(b.id, new THREE.Vector3(+b.x, 0, +b.z));
    }
    // papan pengumuman (isi diatur admin)
    const pp = Object.assign({}, PAPAN_BAWAAN, kota.papan || {});
    if (pp.tampil !== false) {
      const papan = buatPapan(pp);
      const px = +pp.x, pz = +pp.z;
      papan.position.set(px, 0, pz); papan.rotation.y = (+pp.rot || 45) * Math.PI / 180;
      const data = { id: 'papan', nama: pp.judul || 'Pengumuman', ket: pp.isi || '', status: 'selesai', papan: true };
      papan.userData.pick = { jenis: 'bangunan', data };
      bangunanG.add(papan);
      fps.push({ x: px, z: pz, w: 2.8, d: 1.4, b: data });
      bangunanPos.set('papan', new THREE.Vector3(px, 0, pz));
    }
    return fps;
  }

  // ---------- karakter
  function nearestNode(x, z) {
    let best = null, bd = 1e9;
    for (const n of graph.values()) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n.k; } }
    return best;
  }

  function spawn(look, opt, info, r) {
    const g = makeChar(look, opt);
    const s = opt.skala || 0.62;
    g.scale.setScalar(s);
    const lbl = textSprite(info.label, info.labelStyle);
    lbl.position.y = 2.95; lbl.scale.multiplyScalar(1 / s * 0.82);
    g.add(lbl);
    g.userData.pick = { jenis: info.jenis, data: info.data };
    const start = nodeKeys[Math.floor(r() * nodeKeys.length)];
    const n = graph.get(start);
    g.position.set(n.x, 0, n.z);
    const c = { g, from: start, to: null, t: 0, speed: 1.4 + r() * 0.9, wait: r() * 3, path: [], mode: 'jalan', tujuan: null, phase: r() * 10, r };
    charsG.add(g);
    chars.push(c);
    return c;
  }

  // jabatan: { [kode]: 'Ketua RT Blok A' }
  function setWarga(list, kodeSaya, jabatan = {}) {
    const lama = pemain ? { pos: pemain.g.position.clone(), rot: pemain.g.rotation.y } : null;
    pemain = null;
    for (const c of chars.splice(0)) charsG.remove(c.g);
    const r = rng(42);
    // maskot
    const m = (kota && kota.maskot) || { nama: 'Cak Darjo' };
    maskot = spawn(LOOK_DARJO, Object.assign({}, OPT_DARJO, { skala: 0.74 }),
      { label: '★ ' + m.nama, labelStyle: { bg: 'rgba(242,140,40,.97)', fg: '#fff', size: 0.95 }, jenis: 'maskot', data: m }, r);
    maskot.speed = 1.6;
    for (const w of list || []) {
      const saya = w.kode && w.kode === kodeSaya;
      const jab = w.kode && jabatan[w.kode];
      const label = (jab ? `🎖 ${jab} · ` : '') + (saya ? '⭐ ' : '') + w.nama;
      const style = jab ? { bg: 'rgba(230,180,34,.97)', fg: '#3b2a00', size: 0.88, border: '#8a6500' }
        : saya ? { bg: 'rgba(15,76,92,.96)', fg: '#ffd166', size: 0.9 } : { bg: 'rgba(255,255,255,.93)', fg: '#16324f', size: 0.75 };
      spawn(lookFor(w), jab ? { selempang: '#e6b422', skala: 0.68 } : {}, {
        label, labelStyle: style, jenis: 'warga', data: Object.assign({}, w, jab ? { jabatan: jab } : {}),
      }, r);
    }
    if (pemainKode) {
      const c = chars.find(x => x.g.userData.pick.data && x.g.userData.pick.data.kode === pemainKode);
      if (c) { pasangPemain(c); if (lama) { c.g.position.copy(lama.pos); c.g.rotation.y = lama.rot; } }
      else { pemainKode = null; ikuti = null; aturKontrolMain(false); }
    }
    // ayam berkeliaran
    for (const a of ayam.splice(0)) charsG.remove(a.g);
    const ra = rng(9);
    const pusat = [[16, -3], [3, 3], [-14, 19], [27, -12]];
    const nAyam = Math.max(0, Math.min(20, +(kota && kota.ayam) || 0));
    for (let i = 0; i < nAyam; i++) {
      const g = makeAyam(ra); g.scale.setScalar(0.8);
      const [cx, cz] = pusat[i % pusat.length];
      g.position.set(cx + (ra() - 0.5) * 3, 0, cz + (ra() - 0.5) * 3);
      charsG.add(g);
      ayam.push({ g, cx, cz, tx: g.position.x, tz: g.position.z, wait: ra() * 2, ra });
    }
    jadwalMaskot();
  }

  function jadwalMaskot() {
    if (!maskot || !kota || !kota.maskot) return;
    const j = kota.maskot.jadwal || [];
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const menit = now.getHours() * 60 + now.getMinutes();
    const toM = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
    const slot = j.find(s => { const a = toM(s.mulai), b = toM(s.selesai); return a <= b ? (menit >= a && menit < b) : (menit >= a || menit < b); });
    maskot.slot = slot || null;
    maskot.path = [];
    if (slot && slot.lok !== 'keliling' && bangunanPos.has(slot.lok)) {
      const p = bangunanPos.get(slot.lok);
      maskot.mode = 'tuju';
      maskot.tujuan = nearestNode(p.x, p.z);
      maskot.hadap = p;
    } else { maskot.mode = 'jalan'; maskot.tujuan = null; }
  }
  setInterval(jadwalMaskot, 30000);

  function stepChar(c, dt, t) {
    if (c.dikontrol) return;
    const a = c.g.userData.anim;
    if (!c.to) {
      if (c.wait > 0) {
        c.wait -= dt;
        a.legs.forEach(l => { l.rotation.x *= 0.8; }); a.arms.forEach(l => { l.rotation.x *= 0.8; });
        if (c.mode === 'tuju' && c.from === c.tujuan && c.hadap) {
          const ang = Math.atan2(c.hadap.x - c.g.position.x, c.hadap.z - c.g.position.z);
          let df = ang - c.g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
          c.g.rotation.y += df * 0.1;
        }
        return;
      }
      const cur = graph.get(c.from);
      if (c.mode === 'tuju' && c.tujuan) {
        if (c.from === c.tujuan) { c.wait = 4; return; }
        if (!c.path.length) c.path = bfs(graph, c.from, c.tujuan);
        c.to = c.path.shift() || null;
      } else {
        const nb = [...cur.n];
        let pilih = nb.filter(k => k !== c.prev);
        if (!pilih.length) pilih = nb;
        c.to = pilih[Math.floor(c.r() * pilih.length)];
      }
      if (!c.to) { c.wait = 2; return; }
      c.t = 0;
      const A = graph.get(c.from), B = graph.get(c.to);
      c.len = Math.hypot(B.x - A.x, B.z - A.z);
    }
    const A = graph.get(c.from), B = graph.get(c.to);
    c.t += dt * c.speed / c.len;
    const dx = (B.x - A.x) / c.len, dz = (B.z - A.z) / c.len;
    const k = Math.min(1, c.t);
    const off = 0.85; // jalan di sisi kiri jalan
    c.g.position.set(A.x + (B.x - A.x) * k - dz * off, 0, A.z + (B.z - A.z) * k + dx * off);
    const ang = Math.atan2(dx, dz);
    let diff = ang - c.g.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    c.g.rotation.y += diff * Math.min(1, dt * 10);
    const sw = Math.sin((t + c.phase) * c.speed * 5) * 0.6;
    a.legs[0].rotation.x = sw; a.legs[1].rotation.x = -sw; a.arms[0].rotation.x = -sw; a.arms[1].rotation.x = sw;
    c.g.position.y = Math.abs(Math.cos((t + c.phase) * c.speed * 5)) * 0.04;
    if (c.t >= 1) {
      c.prev = c.from; c.from = c.to; c.to = null;
      if (c.mode === 'jalan' && c.r() < 0.25) c.wait = 1 + c.r() * 3;
      if (c.mode === 'tuju' && c.from === c.tujuan) { c.wait = 6; c.path = []; }
    }
  }

  function stepAyam(a, dt, t) {
    const p = a.g.position;
    if (a.wait > 0) { a.wait -= dt; p.y = 0; return; }
    const dx = a.tx - p.x, dz = a.tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.1) { a.wait = 0.5 + a.ra() * 2.5; a.tx = a.cx + (a.ra() - 0.5) * 4; a.tz = a.cz + (a.ra() - 0.5) * 4; return; }
    const v = Math.min(d, dt * 1.2);
    p.x += dx / d * v; p.z += dz / d * v;
    p.y = Math.abs(Math.sin(t * 14)) * 0.08;
    a.g.rotation.y = Math.atan2(dx, dz);
  }

  // ---------- siang & malam (WIB)
  const LANGIT = [
    [0, '#1b2440', 0.3, 0.18], [4.5, '#263052', 0.35, 0.18], [5.5, '#f0c3a0', 0.9, 1.0], [7, '#d6e2e4', 1.4, 2.3],
    [15, '#d6e2e4', 1.5, 2.6], [17.2, '#f1bf93', 1.1, 1.6], [18.4, '#4a4a70', 0.55, 0.45], [19.5, '#1b2440', 0.32, 0.18], [24, '#1b2440', 0.3, 0.18],
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();
  let malam = false;
  const cvLangit = document.createElement('canvas'); cvLangit.width = 4; cvLangit.height = 256;
  const texLangit = new THREE.CanvasTexture(cvLangit); texLangit.colorSpace = THREE.SRGBColorSpace;
  function langitGradasi(bawah, gelapMalam) {
    const x = cvLangit.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
    const atas = bawah.clone().lerp(new THREE.Color(gelapMalam ? '#0d1330' : '#8fb9d6'), gelapMalam ? 0.6 : 0.55);
    gr.addColorStop(0, '#' + atas.getHexString()); gr.addColorStop(0.62, '#' + bawah.getHexString()); gr.addColorStop(1, '#' + bawah.getHexString());
    x.fillStyle = gr; x.fillRect(0, 0, 4, 256); texLangit.needsUpdate = true; return texLangit;
  }
  let jamTetap = null; // dipakai mode video: jam langit tetap
  function updateLangit() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const h = jamTetap ?? (now.getHours() + now.getMinutes() / 60);
    let i = 0; while (i < LANGIT.length - 2 && LANGIT[i + 1][0] <= h) i++;
    const [h0, c0, e0, s0] = LANGIT[i], [h1, c1, e1, s1] = LANGIT[i + 1];
    const k = (h - h0) / (h1 - h0 || 1);
    malam = h < 5.6 || h >= 18.2;
    cA.set(c0).lerp(cB.set(c1), k);
    scene.fog.color.copy(cA); scene.background = langitGradasi(cA, malam);
    hemi.intensity = e0 + (e1 - e0) * k;
    sun.intensity = s0 + (s1 - s0) * k;
    const ang = ((h - 6) / 12) * Math.PI;
    sun.position.set(Math.cos(ang) * 40, Math.max(12, Math.sin(ang) * 55), 22);
    sun.color.set(h < 6 || h > 18.5 ? '#9fb4ff' : h < 8 || h > 16.5 ? '#ffc98f' : '#ffe3bd');
    const glow = malam ? '#ffcf6b' : '#000000';
    winMat.emissive.set(glow); winMat.emissiveIntensity = malam ? 0.9 : 0;
    lampMat.emissive.set(malam ? '#fff1b8' : '#000'); lampMat.emissiveIntensity = malam ? 1.3 : 0;
    return { jam: h, malam };
  }
  setInterval(updateLangit, 30000);

  // ---------- interaksi
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 8 || performance.now() - down.t > 500) { down = null; return; }
    down = null;
    const rc = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects([charsG, bangunanG], true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o) { onPick && onPick(o.userData.pick, o); return; }
    }
    onPick && onPick(null);
  });

  let fokus = null;
  function fokusKe(x, z) { fokus = { x, z, t: 0, sx: controls.target.x, sz: controls.target.z, cx: camera.position.x, cz: camera.position.z }; }

  let sudahUkur = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!sudahUkur) {
      sudahUkur = true;
      const jarak = w / h < 0.8 ? 84 : 66; // HP potret butuh kamera lebih jauh
      camera.position.copy(controls.target).add(new THREE.Vector3(34, 38, 40).setLength(jarak));
    }
  }
  new ResizeObserver(resize).observe(canvas);

  let ikuti = null;
  // ---------- MODE JALAN-JALAN: pemilik KTP menggerakkan karakternya sendiri
  let pemain = null, pemainKode = null, dekatId = null;
  const masukan = { x: 0, y: 0 };
  const _f = new THREE.Vector3();
  function bisaDi(x, z) {
    if (x < -31 || x > 31 || z < -31 || z > 32.5) return false;
    if (z > RIVER[0] - 0.3 && z < RIVER[1] + 0.3 && Math.abs(x) > (kota && kota.jalan ? 1.5 : 0.85)) return false; // hanya lewat jembatan
    for (const f of rintangan) if (!f.lewat && Math.abs(x - f.x) < f.w / 2 + 0.15 && Math.abs(z - f.z) < f.d / 2 + 0.15) return false;
    for (const [px, pz] of pohonPos) if ((x - px) ** 2 + (z - pz) ** 2 < 0.3) return false;
    return true;
  }
  function stepPemain(dt, t) {
    const c = pemain, a = c.g.userData.anim, p = c.g.position;
    const mag = Math.min(1, Math.hypot(masukan.x, masukan.y));
    let jalan = false;
    if (mag > 0.08) {
      _f.subVectors(controls.target, camera.position); _f.y = 0; _f.normalize();
      const dx = _f.x * -masukan.y - _f.z * masukan.x, dz = _f.z * -masukan.y + _f.x * masukan.x;
      const l = Math.hypot(dx, dz) || 1, v = 4.2 * mag * dt;
      const nx = p.x + dx / l * v, nz = p.z + dz / l * v;
      const terjebak = !bisaDi(p.x, p.z);
      if (terjebak || bisaDi(nx, nz)) { p.x = nx; p.z = nz; jalan = true; }
      else if (bisaDi(nx, p.z)) { p.x = nx; jalan = true; }
      else if (bisaDi(p.x, nz)) { p.z = nz; jalan = true; }
      let df = Math.atan2(dx, dz) - c.g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
      c.g.rotation.y += df * Math.min(1, dt * 12);
    }
    const sw = jalan ? Math.sin(t * 11) * 0.7 * mag : 0;
    a.legs[0].rotation.x = sw; a.legs[1].rotation.x = -sw; a.arms[0].rotation.x = -sw; a.arms[1].rotation.x = sw;
    const diJembatan = Math.abs(p.x) < 1.8 && p.z > 19.9 && p.z < 26.1;
    p.y = (diJembatan ? 0.3 : 0) + (jalan ? Math.abs(Math.cos(t * 11)) * 0.05 : 0);
    // bangunan terdekat
    let best = null, bd = 2;
    for (const f of rintangan) {
      const d = Math.hypot(Math.max(0, Math.abs(p.x - f.x) - f.w / 2), Math.max(0, Math.abs(p.z - f.z) - f.d / 2));
      if (d < bd) { bd = d; best = f; }
    }
    const id = best ? (best.b.id || best.b.nama) : null;
    if (id !== dekatId) { dekatId = id; onDekat && onDekat(best ? best.b : null); }
  }
  function aturKontrolMain(aktif) {
    controls.enablePan = !aktif;
    controls.mouseButtons = aktif ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = aktif ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE } : { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  }
  function pasangPemain(c) {
    pemain = c; c.dikontrol = true; c.to = null; c.path = [];
    ikuti = c.g;
  }

  const timer = new THREE.Timer(); timer.connect(document);
  function langkah(dt, t, kameraManual) {
    for (const c of chars) { stepChar(c, dt, t); if (c.g.userData.tick) c.g.userData.tick(t); }
    if (pemain) stepPemain(dt, t);
    for (const a of ayam) stepAyam(a, dt, t);
    for (const c of awanG.children) { c.position.x += c.userData.v * dt; if (c.position.x > 70) c.position.x = -70; }
    if (fokus) {
      fokus.t = Math.min(1, fokus.t + dt * 1.8);
      const e = 1 - Math.pow(1 - fokus.t, 3);
      const nx = fokus.sx + (fokus.x - fokus.sx) * e, nz = fokus.sz + (fokus.z - fokus.sz) * e;
      camera.position.x += nx - controls.target.x; camera.position.z += nz - controls.target.z;
      controls.target.x = nx; controls.target.z = nz;
      if (fokus.t >= 1) fokus = null;
    }
    if (ikuti) {
      const p = ikuti.position;
      camera.position.x += (p.x - controls.target.x) * 0.08; camera.position.z += (p.z - controls.target.z) * 0.08;
      controls.target.x += (p.x - controls.target.x) * 0.08; controls.target.z += (p.z - controls.target.z) * 0.08;
    }
    if (!kameraManual) controls.update();
    renderer.render(scene, camera);
  }
  if (!manual) renderer.setAnimationLoop(() => {
    timer.update();
    langkah(Math.min(timer.getDelta(), 0.05), timer.getElapsed(), false);
  });
  resize();

  return {
    setKota(k) {
      kota = k;
      const fps = buildBangunan();
      rintangan = fps;
      buildStatic(fps);
      jadwalMaskot();
      return updateLangit();
    },
    setWarga,
    langit: updateLangit,
    zoom(f) {
      const off = camera.position.clone().sub(controls.target);
      const len = THREE.MathUtils.clamp(off.length() * f, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(off.setLength(len));
    },
    fokusBangunan(id) { const p = bangunanPos.get(id); if (p) fokusKe(p.x, p.z); },
    ikuti(obj) {
      ikuti = obj || (pemain ? pemain.g : null);
      if (obj) { // dekatkan kamera supaya label terbaca
        const off = camera.position.clone().sub(controls.target);
        if (off.length() > 34) camera.position.copy(controls.target).add(off.setLength(34));
      }
    },
    cariWarga(kode) { return chars.find(c => c.g.userData.pick.data && c.g.userData.pick.data.kode === kode); },
    maskot: () => maskot,
    mulaiMain(kode) {
      const c = chars.find(x => x.g.userData.pick.data && x.g.userData.pick.data.kode === kode);
      if (!c) return false;
      pemainKode = kode; pasangPemain(c); aturKontrolMain(true);
      fokus = null;
      const off = camera.position.clone().sub(controls.target);
      off.y = 0; off.setLength(24); off.y = 21; // agak tinggi supaya tidak terhalang pohon
      controls.target.set(c.g.position.x, 0, c.g.position.z);
      camera.position.copy(controls.target).add(off);
      dekatId = null;
      return true;
    },
    selesaiMain() {
      if (pemain) {
        const k = nearestNode(pemain.g.position.x, pemain.g.position.z);
        Object.assign(pemain, { dikontrol: false, from: k, to: null, path: [], wait: 1.5 });
        pemain.g.position.y = 0;
      }
      pemain = null; pemainKode = null; ikuti = null; masukan.x = masukan.y = 0;
      aturKontrolMain(false);
      if (dekatId !== null) { dekatId = null; onDekat && onDekat(null); }
    },
    gerak(x, y) { masukan.x = x; masukan.y = y; },
    sedangMain: () => !!pemain,
    karakter: () => chars,
    // ----- untuk mode video (manual)
    frame(dt, t) { langkah(dt, t, true); },
    setJam(h) { jamTetap = h; updateLangit(); },
    scene, camera, renderer,
    posisiPemain: () => pemain ? [pemain.g.position.x, pemain.g.position.z] : null,
    bisaDi,
  };
}
