// Peta 3D blocky SidoarjoVerse (Three.js). Semua model dibuat dari kotak di kode ini, tanpa aset luar.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { lookFor, drawFace } from './avatar.js';

// ---------------------------------------------------------------- material & builder
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const MATS = new Map();
const winMat = new THREE.MeshLambertMaterial({ color: '#bfe3f2' });
const lampMat = new THREE.MeshLambertMaterial({ color: '#fff3c4' });
const waterMat = new THREE.MeshLambertMaterial({ color: '#3f9fd1', transparent: true, opacity: 0.88 });
const tambakMat = new THREE.MeshLambertMaterial({ color: '#4f9c9a', transparent: true, opacity: 0.92 });

function mat(k) {
  if (k === 'win') return winMat;
  if (k === 'lamp') return lampMat;
  if (k === 'water') return waterMat;
  if (k === 'tambak') return tambakMat;
  let m = MATS.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: k }); MATS.set(k, m); }
  return m;
}

// Voxel Builder: kumpulkan kotak per warna lalu gabung jadi sedikit mesh (ringan di HP).
class VB {
  constructor() { this.parts = new Map(); }
  // x,z = pusat, y = dasar kotak
  box(x, y, z, w, h, d, c) {
    const m = new THREE.Matrix4().makeScale(w, h, d).setPosition(x, y + h / 2, z);
    let l = this.parts.get(c); if (!l) { l = []; this.parts.set(c, l); }
    l.push(m);
    return this;
  }
  build({ shadow = true } = {}) {
    const g = new THREE.Group();
    for (const [c, list] of this.parts) {
      const geos = list.map(m => UNIT.clone().applyMatrix4(m));
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

function rng(seed) {
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
    for (let i = 0; i < h; i += 0.6) vb.box(x + Math.sin(i) * 0.12, i, z, 0.32, 0.6, 0.32, '#8a6a43');
    vb.box(x, h, z, 2.6, 0.22, 0.5, '#3f8f3a').box(x, h, z, 0.5, 0.22, 2.6, '#3f8f3a').box(x, h + 0.15, z, 0.7, 0.3, 0.7, '#4fa548');
    vb.box(x + 0.25, h - 0.3, z, 0.25, 0.3, 0.25, '#6b4a2a');
    return;
  }
  const h = 1 + r() * 0.8, s = 1.6 + r() * 0.9;
  const hijau = ['#3e8e41', '#4caf50', '#2e7d32', '#5aa65a'][Math.floor(r() * 4)];
  vb.box(x, 0, z, 0.4, h, 0.4, '#7a5230');
  vb.box(x, h, z, s, s * 0.8, s, hijau);
  vb.box(x, h + s * 0.8, z, s * 0.65, s * 0.5, s * 0.65, hijau);
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

// ---------------------------------------------------------------- karakter
function makeChar(look, opt = {}) {
  const g = new THREE.Group();
  const M = c => mat(c);
  const part = (w, h, d, c, y, parent = g, x = 0, z = 0) => {
    const m = new THREE.Mesh(UNIT, M(c)); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  };
  const baju = opt.baju || look.baju, celana = opt.celana || look.celana;
  const legs = [], arms = [];
  for (const s of [-0.17, 0.17]) {
    const p = new THREE.Group(); p.position.set(s, 0.72, 0); g.add(p);
    part(0.3, 0.6, 0.32, celana, -0.32, p); part(0.32, 0.14, 0.38, '#2b2b2b', -0.65, p, 0, 0.03);
    legs.push(p);
  }
  part(0.72, 0.78, 0.42, baju, 1.1);
  if (opt.selempang) part(0.74, 0.12, 0.44, opt.selempang, 1.2);
  for (const s of [-0.48, 0.48]) {
    const p = new THREE.Group(); p.position.set(s, 1.42, 0); g.add(p);
    part(0.24, 0.5, 0.28, baju, -0.2, p); part(0.22, 0.26, 0.26, look.kulit, -0.56, p);
    arms.push(p);
  }
  // kepala: tekstur wajah di sisi depan (+z)
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  drawFace(cv.getContext('2d'), 0, 0, 64, look, opt);
  const ft = canvasTex(cv); ft.magFilter = THREE.NearestFilter; ft.minFilter = THREE.NearestFilter;
  const atas = look.kerudung || (opt.peci ? '#151515' : look.rambut);
  const sisi = look.kerudung || look.kulit;
  const head = new THREE.Mesh(UNIT, [M(sisi), M(sisi), M(atas), M(look.kulit), new THREE.MeshLambertMaterial({ map: ft }), M(look.kerudung || look.rambut)]);
  head.scale.set(0.72, 0.72, 0.72); head.position.y = 1.86; head.castShadow = true; g.add(head);
  if (opt.peci) part(0.74, 0.26, 0.74, '#151515', 2.3);
  if (look.rambutPanjang && !look.kerudung) part(0.74, 0.6, 0.2, look.rambut, 1.75, g, 0, -0.32);
  g.userData.anim = { legs, arms, head };
  return g;
}

function makeAyam(r) {
  const vb = new VB();
  const c = r() < 0.5 ? '#ffffff' : '#c8743c';
  vb.box(0, 0.2, 0, 0.42, 0.34, 0.55, c).box(0, 0.45, 0.25, 0.26, 0.28, 0.26, c).box(0, 0.73, 0.27, 0.08, 0.12, 0.18, '#e63946');
  vb.box(0, 0.5, 0.42, 0.1, 0.07, 0.1, '#f4a261').box(0, 0.35, -0.3, 0.3, 0.28, 0.12, c === '#ffffff' ? '#e0e0e0' : '#7a3e1d');
  vb.box(-0.1, 0, 0, 0.06, 0.2, 0.06, '#f4a261').box(0.1, 0, 0, 0.06, 0.2, 0.06, '#f4a261');
  return vb.build();
}

// ---------------------------------------------------------------- dunia
export function createWorld(canvas, { onPick } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#a8dcf5', 110, 220);
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

  const hemi = new THREE.HemisphereLight('#ffffff', '#6b8f4e', 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4dc', 2.2);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
  sun.shadow.bias = -0.0008;
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

  // ---------- lingkungan statis
  function buildStatic(footprints) {
    statik.clear();
    const r = rng(7);
    const tanah = new VB();
    const hijau = ['#86c35a', '#8fcb63', '#7fba55'];
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
        jalan.box(0, 0, z, EDGE * 2, 0.06, ROAD_W, '#5f646b');
        for (let x = -EDGE + 1; x < EDGE; x += 2.2) if (!LINES.some(l => Math.abs(l - x) < 2)) jalan.box(x, 0.06, z, 1.1, 0.01, 0.14, '#f1f1f1');
      }
      for (const x of LINES) {
        const z1 = -EDGE, z2 = x === 0 ? 31 : 16;
        jalan.box(x, 0, (z1 + z2) / 2, ROAD_W, 0.06, z2 - z1, '#5f646b');
        for (let z = z1 + 1; z < z2; z += 2.2) if (!LINES.some(l => Math.abs(l - z) < 2) && !(z > RIVER[0] - 1 && z < RIVER[1] + 1)) jalan.box(x, 0.061, z, 0.14, 0.01, 1.1, '#f1f1f1');
      }
      for (const z of LINES) for (const s of [-1, 1]) jalan.box(0, 0, z + s * (ROAD_W / 2 + 0.25), EDGE * 2, 0.12, 0.5, '#c9c2b4');
      for (const z of LINES) for (let x = -24; x <= 24; x += 8) { if (LINES.includes(x)) continue; jalan.box(x, 0, z - 2.1, 0.15, 2.8, 0.15, '#3a3a3a'); jalan.box(x, 2.8, z - 1.8, 0.2, 0.12, 0.8, '#3a3a3a'); jalan.box(x, 2.65, z - 1.45, 0.4, 0.18, 0.4, 'lamp'); }
    } else {
      // jalan setapak tanah
      for (const z of LINES) jalan.box(0, 0, z, EDGE * 2, 0.04, 1.8, '#c4a57a');
      for (const x of LINES) { const z1 = -EDGE, z2 = x === 0 ? 31 : 16; jalan.box(x, 0, (z1 + z2) / 2, 1.8, 0.04, z2 - z1, '#c4a57a'); }
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
    for (let i = 0; i < 900 && ditanam < 150; i++) {
      const x = (r() - 0.5) * 64, z = (r() - 0.5) * 66;
      if (!bebas(x, z)) continue;
      pohon(pohonVB, x, z, r, (z > 17 || Math.abs(x) > 27) && r() < 0.6 ? 'kelapa' : 'biasa');
      ditanam++;
    }
    // pohon & semak di tepi sungai
    for (let x = -30; x <= 30; x += 3.3) { if (Math.abs(x) < 3) continue; if (r() < 0.5) pohon(pohonVB, x, RIVER[0] - 0.9, r, 'kelapa'); else pohonVB.box(x, 0, RIVER[0] - 0.8, 0.9, 0.6, 0.9, '#4f9a45'); }
    statik.add(pohonVB.build());

    // awan
    awanG.clear();
    for (let i = 0; i < 9; i++) {
      const vb = new VB();
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) vb.box(k * 1.8 - n, r() * 0.6, (r() - 0.5) * 2, 2.6 + r() * 1.5, 1.2 + r(), 2.2 + r() * 1.2, '#ffffff');
      const c = vb.build({ shadow: false });
      c.position.set((r() - 0.5) * 140, 40 + r() * 10, (r() - 0.5) * 110); c.scale.setScalar(0.8);
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
      fps.push({ x: +b.x, z: +b.z, w, d });
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
          model.scale.y = p;
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
          lb.position.set(0, H * p + 1.2, 0); holder.add(lb);
        }
      }
      holder.add(model);
      holder.rotation.y = -rot;
      bangunanG.add(holder);
      if (b.id) bangunanPos.set(b.id, new THREE.Vector3(+b.x, 0, +b.z));
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
    lbl.position.y = 2.75; lbl.scale.multiplyScalar(1 / s * 0.82);
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

  function setWarga(list, kodeSaya) {
    for (const c of chars.splice(0)) charsG.remove(c.g);
    const r = rng(42);
    // maskot
    const m = (kota && kota.maskot) || { nama: 'Cak Darjo' };
    const lookM = { kulit: '#d9a066', baju: '#0f7c8c', celana: '#2b2d42', rambut: '#1a1a1a', kumis: true };
    maskot = spawn(lookM, { peci: true, kumis: true, selempang: '#f28c28', skala: 0.74 },
      { label: '★ ' + m.nama, labelStyle: { bg: 'rgba(242,140,40,.97)', fg: '#fff', size: 0.95 }, jenis: 'maskot', data: m }, r);
    maskot.speed = 1.6;
    for (const w of list || []) {
      const saya = w.kode && w.kode === kodeSaya;
      spawn(lookFor(w), {}, {
        label: (saya ? '⭐ ' : '') + w.nama,
        labelStyle: saya ? { bg: 'rgba(15,76,92,.96)', fg: '#ffd166', size: 0.9 } : { bg: 'rgba(255,255,255,.93)', fg: '#16324f', size: 0.75 },
        jenis: 'warga', data: w,
      }, r);
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
    [0, '#16213e', 0.25, 0.15], [4.5, '#1f2b4f', 0.3, 0.15], [5.5, '#f7b58b', 0.7, 0.9], [7, '#a9dcf5', 1.1, 2.0],
    [15, '#a9dcf5', 1.2, 2.2], [17.2, '#f9a66c', 0.85, 1.3], [18.4, '#3a3f6b', 0.45, 0.4], [19.5, '#16213e', 0.28, 0.15], [24, '#16213e', 0.25, 0.15],
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();
  let malam = false;
  function updateLangit() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const h = now.getHours() + now.getMinutes() / 60;
    let i = 0; while (i < LANGIT.length - 2 && LANGIT[i + 1][0] <= h) i++;
    const [h0, c0, e0, s0] = LANGIT[i], [h1, c1, e1, s1] = LANGIT[i + 1];
    const k = (h - h0) / (h1 - h0 || 1);
    cA.set(c0).lerp(cB.set(c1), k);
    scene.background = cA.clone(); scene.fog.color.copy(cA);
    hemi.intensity = e0 + (e1 - e0) * k;
    sun.intensity = s0 + (s1 - s0) * k;
    const ang = ((h - 6) / 12) * Math.PI;
    sun.position.set(Math.cos(ang) * 40, Math.max(12, Math.sin(ang) * 55), 22);
    sun.color.set(h < 6 || h > 18.5 ? '#9fb4ff' : '#fff4dc');
    malam = h < 5.6 || h >= 18.2;
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

  const timer = new THREE.Timer(); timer.connect(document);
  let ikuti = null;
  renderer.setAnimationLoop(() => {
    timer.update(); const dt = Math.min(timer.getDelta(), 0.05), t = timer.getElapsed();
    for (const c of chars) stepChar(c, dt, t);
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
    controls.update();
    renderer.render(scene, camera);
  });
  resize();

  return {
    setKota(k) {
      kota = k;
      const fps = buildBangunan();
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
    ikuti(obj) { ikuti = obj || null; },
    cariWarga(kode) { return chars.find(c => c.g.userData.pick.data && c.g.userData.pick.data.kode === kode); },
    maskot: () => maskot,
  };
}
