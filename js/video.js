// Perender video vertikal 9:16 SidoarjoVerse, frame demi frame (dipanggil dari Playwright).
// Semua adegan dibaca dari naskah.json (kamera, pose, stiker, efek suara per baris).
// Pakai: video.html?dir=video/<nama>&skala=1.5
import * as THREE from 'three';
import { createWorld, makeCakDarjo, makeAyam } from './world.js';

const W = 720, H = 1280;
const q = new URLSearchParams(location.search);
const SKALA = +(q.get('skala') || 1);
const DIR = q.get('dir') || 'video/kenalan';
const ambil = async f => (await fetch(`${DIR}/${f}`, { cache: 'no-store' })).json();
const NASKAH = await ambil('naskah.json');
const TL = await ambil('timeline.json');
const FPS = TL.fps, N = Math.round(TL.durasi * FPS);
// Subtitle = persis yang diucapkan (ejaan mesin suara dirapikan); kata kunci dikapital agar disorot.
const SOROT = ['warga', 'ktp', 'follow', 'komen', 'like'];
function rapikan(tts) {
  return tts.replace(/Sidoarjo Vers/g, 'SidoarjoVerse').replace(/P\. O\. V\./g, 'POV').replace(/\.\.\./g, '…')
    .split(' ').map(k => SOROT.includes(k.replace(/[^A-Za-z]/g, '').toLowerCase()) ? k.toUpperCase() : k).join(' ');
}
const SEG = TL.segmen.map((s, i) => {
  const b = NASKAH.baris[i];
  return Object.assign({}, s, b, { cap: b.subtitle_khusus ? s.cap : rapikan(b.tts) });
});
const n = SEG.length;
const mulai = i => (i === 0 ? 0 : SEG[i - 1].start + SEG[i - 1].dur);          // adegan i mulai saat baris sebelumnya selesai
const selesai = i => (i === n - 1 ? TL.durasi : mulai(i + 1));
const segPada = t => { for (let i = n - 1; i >= 0; i--) if (t >= mulai(i)) return i; return 0; };

// ------------------------------------------------------------ dunia
const kota = await (await fetch('data/kota.json', { cache: 'no-store' })).json();
Object.assign(kota, { day: 0, jalan: false, ayam: 0 }, NASKAH.kota || {});
if (!NASKAH.kota || !NASKAH.kota.bangunan) kota.bangunan = [{ id: 'lahan1', nama: '???', tipe: 'lapangan', x: -8, z: -8, rot: 0, status: 'lahan', progres: 0 }];
const gl = document.getElementById('gl');
const world = createWorld(gl, { manual: true });
world.setKota(kota);
world.setWarga([], '');
world.maskot().g.visible = false;
world.setJam(NASKAH.jam ?? 9.3);
const { scene, camera, renderer } = world;
renderer.setPixelRatio(SKALA);
renderer.setSize(W, H, false);
camera.fov = 40; camera.aspect = W / H; camera.updateProjectionMatrix();

const darjo = makeCakDarjo();
darjo.position.set(0, 0, 0.6);
scene.add(darjo);
const tangan = darjo.children.find(c => c.isGroup && c.position.x > 0.3 && c.position.y > 1.1);
const tanganAwal = tangan.rotation.clone();
const ayam = makeAyam(() => 0.2);
ayam.position.set(1.35, 0, 1.9); ayam.rotation.y = -0.7;
scene.add(ayam);
const lahanB = kota.bangunan.find(b => b.status === 'lahan') || { x: -8, z: -8 };
const sorot = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.5, 7.2), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.5, depthWrite: false }));
sorot.position.set(+lahanB.x, 0.25, +lahanB.z); sorot.visible = false; scene.add(sorot);
sorot.add(new THREE.LineSegments(new THREE.EdgesGeometry(sorot.geometry), new THREE.LineBasicMaterial({ color: '#f28c28' })));

// ------------------------------------------------------------ util
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const popS = (t, t0, d = 0.28) => { const x = (t - t0) / d; if (x <= 0) return 0; if (x >= 1) return 1; const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------ kamera: setiap jenis = titik awal → akhir
const LIHAT_D = V(0, 1.95, 0.6);   // tinggi wajah Cak Darjo (gaya figur premium)
function bidikan(jenis, sebelum) {
  const sb = sebelum || { pos: V(0, 2.1, 4.6), look: LIHAT_D.clone() };
  const [j, arg] = String(jenis || 'closeup').split(':');
  switch (j) {
    case 'medium': return { a: { pos: V(0.4, 1.95, 6.6), look: V(0, 1.6, 0.6) }, b: { pos: V(0.9, 1.95, 6.1), look: V(0, 1.6, 0.6) }, e: ease };
    case 'mundur': return { a: sb, b: { pos: V(9, 13, 21), look: V(0, 0.4, -5) }, e: easeOut };
    case 'udara': return { a: { pos: V(9, 13, 21), look: V(0, 0.4, -5) }, b: { pos: V(-5, 15, 21), look: V(-2, 0, -7) }, e: ease };
    case 'atas': return { a: { pos: V(lahanB.x + 4, 9, lahanB.z + 12), look: V(lahanB.x + 2, 0, lahanB.z + 3) }, b: { pos: V(+lahanB.x, 25, lahanB.z + 11), look: V(+lahanB.x, 0, +lahanB.z) }, e: easeOut };
    case 'ayam': return { a: { pos: V(2.6, 1.3, 5.2), look: V(0.9, 0.7, 1.3) }, b: { pos: V(2.2, 1.05, 4.4), look: V(0.9, 0.7, 1.3) }, e: ease };
    case 'bangunan': {
      const b = kota.bangunan.find(x => x.id === arg) || lahanB;
      return { a: { pos: V(+b.x + 10, 9, +b.z + 12), look: V(+b.x, 1, +b.z) }, b: { pos: V(+b.x + 6, 6, +b.z + 9), look: V(+b.x, 1.2, +b.z) }, e: ease };
    }
    default: return { a: { pos: V(0, 2.2, 5.6), look: LIHAT_D.clone() }, b: { pos: V(0, 2.18, 4.9), look: LIHAT_D.clone() }, e: ease }; // closeup
  }
}
const SHOT = []; { let prev = null; for (const s of SEG) { const b = bidikan(s.kamera, prev); SHOT.push(b); prev = b.b; } }
function kamera(t) {
  const i = segPada(t), sh = SHOT[i];
  const d = Math.max(0.3, Math.min(selesai(i) - mulai(i), sh.e === easeOut ? 1.6 : 99));
  const k = sh.e((t - mulai(i)) / d);
  camera.position.copy(sh.a.pos).lerp(sh.b.pos, k);
  camera.lookAt(sh.a.look.clone().lerp(sh.b.look, k));
}

// ------------------------------------------------------------ Cak Darjo
function animDarjo(t, f) {
  const amp = TL.amp[Math.min(f, TL.amp.length - 1)] || 0;
  const i = segPada(t), s = SEG[i];
  const bicara = t >= s.start && t <= s.start + s.dur;
  // ekspresi dasar per baris (naskah: "ekspresi"), mulut ikut suara saat bicara
  darjo.userData.ekspresi(s.ekspresi || (s.pose === 'senyum' ? 'senang' : 'normal'));
  if (bicara && amp > 0.1) darjo.userData.ekspresi(amp > 0.28 ? 'buka' : 'diam');
  const head = darjo.userData.anim.head;
  head.rotation.z = Math.sin(t * 2.1) * 0.04 + (bicara ? Math.sin(t * 7) * amp * 0.05 : 0);
  head.rotation.x = bicara ? -amp * 0.06 : 0;
  head.rotation.y = s.pose === 'menoleh' ? Math.sin((t - mulai(i)) * 2.4) * 0.55 : 0;
  darjo.position.y = Math.abs(Math.sin(t * 2.2)) * 0.02;
  const lambai = s.pose === 'melambai' && t >= mulai(i) && t < s.start + Math.min(2.2, s.dur);
  if (lambai) tangan.rotation.set(0, 0, 2.4 + Math.sin(t * 14) * 0.35); else tangan.rotation.copy(tanganAwal);
  if (darjo.userData.tick) darjo.userData.tick(t);
  ayam.rotation.x = Math.max(0, Math.sin(t * 6)) * 0.35;
}

// ------------------------------------------------------------ overlay 2D
const out = document.getElementById('out');
out.width = W * SKALA; out.height = H * SKALA;
const c = out.getContext('2d');
const FONT = '"DejaVu Sans", system-ui, sans-serif', EMO = '"Noto Color Emoji"';
const TEAL = '#0f4c5c', OREN = '#f28c28', KUNING = '#ffd166', KREM = '#fff8ec';
const WARNA = { kuning: [KUNING, '#3b2a00', '#b8861f'], oren: [OREN, '#fff', '#b8611a'], putih: ['#fff', '#16324f', '#c9c2b4'], teal: [TEAL, '#fff', '#082d36'], merah: ['#e63946', '#fff', '#9b1d27'] };

function rr(x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function teks(str, x, y, { size = 40, warna = '#fff', bobot = 800, align = 'center', garis = 0, warnaGaris = TEAL } = {}) {
  c.font = `${bobot} ${size}px ${FONT}, ${EMO}`; c.textAlign = align; c.textBaseline = 'middle';
  if (garis) { c.lineJoin = 'round'; c.lineWidth = garis; c.strokeStyle = warnaGaris; c.strokeText(str, x, y); }
  c.fillStyle = warna; c.fillText(str, x, y);
}
function ukur(str, size, bobot = 800) { c.font = `${bobot} ${size}px ${FONT}, ${EMO}`; return c.measureText(str).width; }
function pas(str, size, maks, bobot) { while (ukur(str, size, bobot) > maks && size > 18) size -= 2; return size; }
function denganSkala(cx, cy, s, fn) { if (s <= 0.001) return; c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); fn(); c.restore(); }
function pil(str, cx, cy, s, warna = 'kuning', size = 40, pad = 26) {
  const [bg, fg, bayang] = WARNA[warna] || WARNA.kuning;
  size = pas(str, size, W - 80 - pad * 2);
  denganSkala(cx, cy, s, () => {
    const w = ukur(str, size) + pad * 2, h = size + 30;
    c.fillStyle = bayang; rr(cx - w / 2, cy - h / 2 + 6, w, h, h / 2); c.fill();
    c.fillStyle = bg; rr(cx - w / 2, cy - h / 2, w, h, h / 2); c.fill();
    teks(str, cx, cy + 1, { size, warna: fg });
  });
}
function kartu(cx, cy, w, h, s, isi, { bg = '#ffffff', tepi = TEAL } = {}) {
  denganSkala(cx, cy, s, () => {
    c.fillStyle = 'rgba(0,0,0,.18)'; rr(cx - w / 2, cy - h / 2 + 8, w, h, 26); c.fill();
    c.fillStyle = bg; rr(cx - w / 2, cy - h / 2, w, h, 26); c.fill();
    c.lineWidth = 5; c.strokeStyle = tepi; c.stroke();
    isi(cx - w / 2, cy - h / 2);
  });
}
function proyeksi(p) { const v = p.clone().project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }

// subtitle per 3–5 kata. Waktunya hanya berjalan saat suara terdengar (jeda dilewati), sesuai panjang huruf.
function bagianBersuara(sg) {
  const f0 = Math.floor(sg.start * FPS), f1 = Math.ceil((sg.start + sg.dur) * FPS);
  const iv = []; let a = null, diam = 0;
  for (let f = f0; f <= f1; f++) {
    const on = (TL.amp[f] || 0) > 0.06;
    if (on) { if (a === null) a = f; diam = 0; }
    else if (a !== null && ++diam > 6) { iv.push([a / FPS, (f - diam + 1) / FPS]); a = null; diam = 0; }
  }
  if (a !== null) iv.push([a / FPS, f1 / FPS]);
  return iv.length ? iv : [[sg.start, sg.start + sg.dur]];
}
const potongan = SEG.map(sg => {
  const kata = sg.cap.split(' '); const chunk = []; let cur = [];
  for (const k of kata) {
    if (cur.length && (cur.join(' ') + ' ' + k).length > 22) { chunk.push(cur.join(' ')); cur = []; }
    cur.push(k);
    if (/[.!?]$/.test(k) || (/[…,:—]$/.test(k) && cur.join(' ').length >= 8)) { chunk.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) chunk.push(cur.join(' '));
  const iv = bagianBersuara(sg), total = iv.reduce((x, [a, b]) => x + b - a, 0);
  const waktu = frac => { let sisa = frac * total; for (const [a, b] of iv) { if (sisa <= b - a) return a + sisa; sisa -= b - a; } return iv[iv.length - 1][1]; };
  const tot = chunk.reduce((a, x) => a + x.length, 0); let acc = 0;
  return chunk.map(x => { const r = { t0: waktu(acc / tot), t1: waktu((acc + x.length) / tot), x }; acc += x.length; return r; });
}).flat();
function subtitle(t) {
  const p = potongan.find(p => t >= p.t0 - 0.05 && t < p.t1 + 0.12);
  if (!p) return;
  const s = popS(t, p.t0 - 0.05, 0.18) * 0.12 + 0.88;
  const size = pas(p.x, 44, 600), w = ukur(p.x, size) + 60, h = 86, cx = W / 2, cy = 1050;
  denganSkala(cx, cy, s, () => {
    c.fillStyle = 'rgba(15,76,92,.93)'; rr(cx - w / 2, cy - h / 2, w, h, 22); c.fill();
    let x = cx - ukur(p.x, size) / 2;
    for (const k of p.x.split(' ')) {
      const huruf = k.replace(/[^A-Za-z]/g, '');
      const sorot = huruf.length >= 3 && huruf === huruf.toUpperCase();
      teks(k, x, cy + 2, { size, warna: sorot ? KUNING : '#fff', align: 'left' });
      x += ukur(k + ' ', size);
    }
  });
}

// ------------------------------------------------------------ stiker
const KONFETI = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % W, v: 280 + (i * 53) % 260, r: (i * 31) % 360, w: 10 + (i % 4) * 4, col: ['#f28c28', '#ffd166', '#2a9d8f', '#e63946', '#8338ec'][i % 5], d: (i % 7) * 0.05 }));
const POS_IDE = [[150, 330], [560, 290], [175, 470], [565, 440], [360, 220]];
const sfx = [];
const catat = (t, j) => sfx.push([+t.toFixed(3), j]);

// waktu munculnya setiap stiker
SEG.forEach((s, i) => {
  (s.stiker || []).forEach((st, k) => { st._t0 = s.start + (st.tunda ?? (k === 0 ? 0.15 : 0.45 + k * 0.3)); });
  if (s.sfx === 'krik') catat(s.start + s.dur + 0.1, 'krik');
  else if (s.sfx === 'whoosh') catat(mulai(i) + 0.02, 'whoosh');
  else if (s.sfx === 'stempel') catat(s.start + s.dur * 0.8, 'stempel');
  else if (s.sfx === 'tada') catat(s.start + 0.3, 'tada');
  for (const st of s.stiker || []) {
    if (['pil', 'papan', 'kartu_teks', 'judul', 'url', 'follow', 'aturan'].includes(st.jenis)) catat(st._t0, 'pop');
    if (st.jenis === 'ide') st.items.forEach((_, k) => catat(s.start + 0.2 + k * s.dur * 0.18, 'pop'));
    if (st.jenis === 'komen') st.items.forEach((_, k) => catat(st._t0 + 0.3 + k * 0.5, 'pop'));
  }
});

function gambarStiker(st, s, i, t, slot) {
  const t0 = st._t0, ps = popS(t, t0);
  const y = 170 + slot * 110;
  switch (st.jenis) {
    case 'pil': return pil(st.teks, W / 2, y, ps, st.warna || 'kuning');
    case 'papan': return pil(st.teks, W / 2, y, ps, 'oren', 34);
    case 'url': return pil(st.teks, W / 2, 230, ps, 'teal', 34);
    case 'kartu_teks': {
      const size = pas(st.teks, 84, 520);
      return kartu(W / 2, 300, Math.max(360, ukur(st.teks, size) + 100), 170, ps, (x, yy) => teks(st.teks, W / 2, yy + 88, { size, warna: TEAL }), { bg: KREM });
    }
    case 'judul': {
      const s2 = popS(t, t0 + 0.55, 0.35), ts = pas(st.teks, 80, 640);
      if (st.atas) denganSkala(W / 2, 290, ps, () => teks(st.atas, W / 2, 290, { size: 44, warna: '#fff', garis: 12 }));
      denganSkala(W / 2, 370, st.atas ? s2 : ps, () => teks(st.teks, W / 2, 370, { size: ts, warna: KUNING, garis: 18 }));
      return;
    }
    case 'follow':
      return kartu(W / 2, 282, 600, 104, ps, (x, yy) => {
        c.fillStyle = TEAL; c.beginPath(); c.arc(x + 58, yy + 52, 34, 0, Math.PI * 2); c.fill();
        teks('🐟', x + 58, yy + 54, { size: 34 });
        teks('@sidoarjoverse', x + 106, yy + 38, { size: 27, warna: '#16324f', align: 'left' });
        teks('Kota Delta dari komen kamu', x + 106, yy + 72, { size: 19, warna: '#5b7083', bobot: 500, align: 'left' });
        const ikut = t > t0 + 1.0;
        c.fillStyle = ikut ? '#e8eef1' : '#3a86ff'; rr(x + 420, yy + 30, 160, 46, 14); c.fill();
        teks(ikut ? 'Mengikuti ✓' : 'Ikuti', x + 500, yy + 54, { size: 21, warna: ikut ? '#16324f' : '#fff' });
      });
    case 'aturan':
      return kartu(W / 2, 300, 600, 250, ps, (x, yy) => {
        c.fillStyle = TEAL; rr(x, yy, 600, 66, [26, 26, 0, 0]); c.fill();
        teks(st.judul || '📜 ATURAN KOTA No. 1', x + 300, yy + 35, { size: 32, warna: KUNING });
        teks(st.baris1 || 'Komen ❤️ like terbanyak', x + 300, yy + 118, { size: pas(st.baris1 || 'Komen ❤️ like terbanyak', 38, 560), warna: '#16324f' });
        const t2 = s.start + s.dur * 0.45;
        if (t >= t2) denganSkala(x + 300, yy + 190, popS(t, t2), () => teks(st.baris2 || '→ BESOK DIBANGUN 🏗️', x + 300, yy + 190, { size: pas(st.baris2 || '→ BESOK DIBANGUN 🏗️', 40, 560), warna: OREN }));
      }, { bg: KREM });
    case 'stempel': {
      const t2 = s.start + s.dur * 0.8; if (t < t2) return;
      const sc = popS(t, t2, 0.22) * (1 + Math.max(0, 0.6 - (t - t2)) * 0.6);
      c.save(); c.translate(W / 2 + 110, 470); c.rotate(-0.16);
      denganSkala(0, 0, sc, () => { const sz = pas(st.teks, 38, 380); const w = ukur(st.teks, sz) + 40; c.lineWidth = 7; c.strokeStyle = '#d62828'; rr(-w / 2, -40, w, 80, 14); c.stroke(); teks(st.teks, 0, 2, { size: sz, warna: '#d62828' }); });
      c.restore(); return;
    }
    case 'ide':
      return st.items.forEach((str, k) => { const [x, yy] = POS_IDE[k % POS_IDE.length]; pil(str, x, yy, popS(t, s.start + 0.2 + k * s.dur * 0.18), 'putih', 30, 20); });
    case 'komen':
      return st.items.forEach(([u, kk], k) => {
        const tk = t0 + 0.3 + k * 0.5, kiri = k % 2 === 0;
        const w = Math.max(ukur(kk, 26, 600), ukur(u, 21)) + 110, cx = kiri ? 40 + w / 2 : W - 40 - w / 2, cy = 290 + k * 100;
        kartu(cx, cy, w, 80, popS(t, tk), (x, yy) => {
          c.fillStyle = ['#f4a261', '#2a9d8f', '#8d5a97', '#e9c46a'][k % 4]; c.beginPath(); c.arc(x + 40, yy + 40, 22, 0, Math.PI * 2); c.fill();
          teks(u, x + 74, yy + 26, { size: 21, warna: '#5b7083', align: 'left' });
          teks(kk, x + 74, yy + 55, { size: 26, warna: '#16324f', bobot: 600, align: 'left' });
        }, { tepi: '#e7dcc8' });
      });
    case 'konfeti':
      for (const k of KONFETI) {
        const u = t - t0 - k.d; if (u < 0 || u > 2.4) continue;
        const yy = -30 + u * k.v, x = k.x + Math.sin(u * 3 + k.r) * 30;
        c.save(); c.translate(x, yy); c.rotate((k.r + u * 240) * Math.PI / 180); c.fillStyle = k.col; c.fillRect(-k.w / 2, -k.w / 4, k.w, k.w / 2); c.restore();
      }
      return;
    case 'lahan': {
      if (t < s.start + s.dur * 0.4) return;
      const [px, py] = proyeksi(V(+lahanB.x, 0.5, +lahanB.z));
      return denganSkala(px, py, popS(t, s.start + s.dur * 0.4, 0.35), () => teks('???', px, py, { size: 120, warna: '#fff', garis: 16, warnaGaris: OREN }));
    }
  }
}

function overlay(t) {
  c.save(); c.scale(SKALA, SKALA);
  teks('@sidoarjoverse', 40, 64, { size: 26, warna: 'rgba(255,255,255,.92)', align: 'left', garis: 6, warnaGaris: 'rgba(15,76,92,.6)' });
  const i = segPada(t), s = SEG[i];
  let slot = 0;
  for (const st of s.stiker || []) { if (t >= st._t0) gambarStiker(st, s, i, t, slot); if (['pil', 'papan'].includes(st.jenis)) slot++; }
  // krik-krik di jeda setelah baris
  if (i > 0 && SEG[i - 1].sfx === 'krik' && t < s.start) {
    const u = t - (SEG[i - 1].start + SEG[i - 1].dur);
    c.globalAlpha = Math.min(1, u / 0.3);
    teks('krik… krik… 🦗', W / 2 + Math.sin(t * 9) * 4, 640, { size: 46, warna: '#fff', bobot: 700, garis: 10, warnaGaris: 'rgba(0,0,0,.35)' });
    c.globalAlpha = 1;
  }
  subtitle(t);
  c.restore();
}

// ------------------------------------------------------------ API untuk perekam
let tPrev = 0;
window.video = {
  N, FPS, durasi: TL.durasi, sfx,
  render(f, mutu = 0.9) {
    const t = f / FPS, dt = Math.max(0, t - tPrev); tPrev = t;
    animDarjo(t, f);
    const i = segPada(t), s = SEG[i];
    const ada = (s.stiker || []).some(x => x.jenis === 'lahan');
    const ks = (t - s.start - 0.3) / 0.5;
    sorot.visible = ada && ks > 0;
    sorot.material.opacity = Math.min(1, Math.max(0, ks)) * (0.42 + Math.sin(t * 6) * 0.14);
    kamera(t);
    world.frame(Math.min(dt, 0.05) || 1 / FPS, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(gl, 0, 0, out.width, out.height);
    overlay(t);
    return out.toDataURL('image/jpeg', mutu);
  },
};
window.videoSiap = true;
