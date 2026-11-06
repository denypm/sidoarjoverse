// Perender video vertikal 9:16 SidoarjoVerse, frame demi frame (dipanggil dari Playwright).
// Adegan DAY 0: "Kota kosong, wargane cuma aku".
import * as THREE from 'three';
import { createWorld, makeCakDarjo, makeAyam } from './world.js';

const W = 720, H = 1280;
const q = new URLSearchParams(location.search);
const SKALA = +(q.get('skala') || 1);           // 1 = 720x1280, 1.5 = 1080x1920
const TL = await (await fetch(q.get('tl') || 'video/day0/timeline.json', { cache: 'no-store' })).json();
const FPS = TL.fps, N = Math.round(TL.durasi * FPS);
const S = Object.fromEntries(TL.segmen.map(s => [s.id, s]));
const awal = id => S[id].start, akhir = id => S[id].start + S[id].dur;
const mulaiSeg = id => (id === 1 ? 0 : akhir(id - 1));   // adegan mulai sejak baris sebelumnya selesai

// ------------------------------------------------------------ dunia
const kota = await (await fetch('data/kota.json', { cache: 'no-store' })).json();
Object.assign(kota, { day: 0, jalan: false, ayam: 0 });
kota.bangunan = [{ id: 'lahan1', nama: '???', tipe: 'lapangan', x: -8, z: -8, rot: 0, status: 'lahan', progres: 0 }];
const gl = document.getElementById('gl');
const world = createWorld(gl, { manual: true });
world.setKota(kota);
world.setWarga([], '');
world.maskot().g.visible = false;
world.setJam(9.3);
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
// sorotan kuning di atas lahan "???" (adegan 9)
const sorot = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.5, 7.2), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.5, depthWrite: false }));
sorot.position.set(-8, 0.25, -8); sorot.visible = false; scene.add(sorot);
const tepiSorot = new THREE.LineSegments(new THREE.EdgesGeometry(sorot.geometry), new THREE.LineBasicMaterial({ color: '#f28c28' }));
sorot.add(tepiSorot);

// ------------------------------------------------------------ util
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const popS = (t, t0, d = 0.28) => { const x = (t - t0) / d; if (x <= 0) return 0; if (x >= 1) return 1; const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, k) => a.clone().lerp(b, k);

// ------------------------------------------------------------ kamera per adegan
function kamera(t) {
  let pos, look;
  if (t < mulaiSeg(2)) {                                       // 1. POV close-up, dorong pelan
    const k = ease(t / mulaiSeg(2)); pos = lerpV(V(0, 1.75, 4.6), V(0, 1.72, 4.0), k); look = V(0, 1.45, 0.6);
  } else if (t < mulaiSeg(3)) {                                // 2. Monggo + melambai
    const k = ease((t - mulaiSeg(2)) / (mulaiSeg(3) - mulaiSeg(2))); pos = lerpV(V(0.4, 1.65, 5.0), V(0.9, 1.65, 4.8), k); look = V(0, 1.35, 0.6);
  } else if (t < mulaiSeg(4)) {                                // 3. mundur & naik: lihat kota
    const k = easeOut((t - mulaiSeg(3)) / (mulaiSeg(4) - mulaiSeg(3))); pos = lerpV(V(0.9, 1.65, 4.8), V(9, 13, 21), k); look = lerpV(V(0, 1.35, 0.6), V(0, 0.4, -5), k);
  } else if (t < mulaiSeg(5)) {                                // 4. udara, geser pelan (krik krik)
    const k = ease((t - mulaiSeg(4)) / (mulaiSeg(5) - mulaiSeg(4))); pos = lerpV(V(9, 13, 21), V(-5, 15, 21), k); look = lerpV(V(0, 0.4, -5), V(-2, 0, -7), k);
  } else if (t < mulaiSeg(6)) {                                // 5. ayam
    const k = ease((t - mulaiSeg(5)) / (mulaiSeg(6) - mulaiSeg(5))); pos = lerpV(V(2.6, 1.3, 5.2), V(2.2, 1.05, 4.4), k); look = V(0.9, 0.7, 1.3);
  } else if (t < mulaiSeg(7)) {                                // 6. hentakan close-up
    const k = easeOut((t - mulaiSeg(6)) / 0.45); pos = lerpV(V(0, 1.7, 5.6), V(0, 1.72, 3.9), k); look = V(0, 1.45, 0.6);
  } else if (t < mulaiSeg(8)) {                                // 7. ide bangunan (orbit pelan)
    const k = ease((t - mulaiSeg(7)) / (mulaiSeg(8) - mulaiSeg(7))); const a = lerp(-0.25, 0.25, k);
    pos = V(Math.sin(a) * 5.6, 1.6, 0.6 + Math.cos(a) * 5.6); look = V(0, 1.25, 0.6);
  } else if (t < mulaiSeg(9)) {                                // 8. aturan kota
    const k = ease((t - mulaiSeg(8)) / (mulaiSeg(9) - mulaiSeg(8))); pos = lerpV(V(0, 1.55, 5.2), V(0, 1.7, 3.9), k); look = V(0, 1.2, 0.6);
  } else if (t < mulaiSeg(10)) {                               // 9. dari atas: lahan ???
    const k = easeOut((t - mulaiSeg(9)) / (mulaiSeg(10) - mulaiSeg(9))); pos = lerpV(V(-4, 9, 4), V(-8, 19, 0), k); look = lerpV(V(-6, 0, -5), V(-8, 0, -8), k);
  } else {                                                     // 10. komen sekarang
    const k = easeOut((t - mulaiSeg(10)) / 0.6); pos = lerpV(V(0, 2.6, 7), V(0, 1.75, 4.3), k); look = V(0, 1.4, 0.6);
  }
  camera.position.copy(pos); camera.lookAt(look);
}

// ------------------------------------------------------------ Cak Darjo: bicara, melambai
function bicaraKah(t) { return TL.segmen.some(s => t >= s.start && t <= s.start + s.dur); }
function animDarjo(t, f) {
  const amp = TL.amp[Math.min(f, TL.amp.length - 1)] || 0;
  const bicara = bicaraKah(t);
  darjo.userData.ekspresi(bicara ? (amp > 0.28 ? 'buka' : amp > 0.1 ? 'diam' : 'senyum') : 'senyum');
  const head = darjo.userData.anim.head;
  head.rotation.z = Math.sin(t * 2.1) * 0.04 + (bicara ? Math.sin(t * 7) * amp * 0.05 : 0);
  head.rotation.x = bicara ? -amp * 0.06 : 0;
  darjo.position.y = Math.abs(Math.sin(t * 2.2)) * 0.02;
  // melambai saat "Monggo, rek!" (adegan 2) dan saat menutup (adegan 10)
  const lambai = (t >= awal(2) - 0.2 && t < awal(2) + 1.6) || (t >= awal(10) + 1.2 && t < akhir(10) + 0.8);
  if (lambai) { tangan.rotation.set(0, 0, 2.4 + Math.sin(t * 14) * 0.35); } else tangan.rotation.copy(tanganAwal);
  if (darjo.userData.tick) darjo.userData.tick(t);
  // ayam mematuk
  ayam.rotation.x = Math.max(0, Math.sin(t * 6)) * 0.35;
}

// ------------------------------------------------------------ overlay 2D
const out = document.getElementById('out');
out.width = W * SKALA; out.height = H * SKALA;
const c = out.getContext('2d');
const FONT = '"DejaVu Sans", system-ui, sans-serif';
const EMO = '"Noto Color Emoji"';
const TEAL = '#0f4c5c', OREN = '#f28c28', KUNING = '#ffd166', KREM = '#fff8ec';

function rr(x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function teks(str, x, y, { size = 40, warna = '#fff', bobot = 800, align = 'center', garis = 0, warnaGaris = TEAL } = {}) {
  c.font = `${bobot} ${size}px ${FONT}, ${EMO}`; c.textAlign = align; c.textBaseline = 'middle';
  if (garis) { c.lineJoin = 'round'; c.lineWidth = garis; c.strokeStyle = warnaGaris; c.strokeText(str, x, y); }
  c.fillStyle = warna; c.fillText(str, x, y);
}
function ukur(str, size, bobot = 800) { c.font = `${bobot} ${size}px ${FONT}, ${EMO}`; return c.measureText(str).width; }
function denganSkala(cx, cy, s, fn) { if (s <= 0.001) return; c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); fn(); c.restore(); }

function pil(str, cx, cy, s, { bg = KUNING, fg = '#3b2a00', size = 40, pad = 26, bayang = '#b8861f' } = {}) {
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

// subtitle: potong per 3–5 kata, waktunya mengikuti panjang huruf
const potongan = TL.segmen.map(sg => {
  const kata = sg.cap.split(' '); const chunk = []; let cur = [];
  for (const k of kata) {
    if (cur.length && (cur.join(' ') + ' ' + k).length > 20) { chunk.push(cur.join(' ')); cur = []; }
    cur.push(k);
    if (/[.!?…,:]$/.test(k) && cur.join(' ').length >= 8) { chunk.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) chunk.push(cur.join(' '));
  const tot = chunk.reduce((a, x) => a + x.length, 0); let t0 = sg.start;
  return chunk.map(x => { const d = sg.dur * x.length / tot; const r = { t0, t1: t0 + d, x }; t0 += d; return r; });
}).flat();
function subtitle(t) {
  const p = potongan.find(p => t >= p.t0 - 0.05 && t < p.t1 + 0.12);
  if (!p) return;
  const s = popS(t, p.t0 - 0.05, 0.18) * 0.12 + 0.88;
  let size = 44; while (ukur(p.x, size) > 600 && size > 26) size -= 2;
  const w = ukur(p.x, size) + 60, h = 86, cx = W / 2, cy = 1050;
  denganSkala(cx, cy, s, () => {
    c.fillStyle = 'rgba(15,76,92,.93)'; rr(cx - w / 2, cy - h / 2, w, h, 22); c.fill();
    // kata berhuruf besar semua disorot kuning
    const kata = p.x.split(' '); let x = cx - (ukur(p.x, size)) / 2;
    for (const k of kata) {
      const sorot = /^[A-Z]{3,}/.test(k.replace(/[^A-Za-z]/g, '')) && k.replace(/[^A-Za-z]/g, '') === k.replace(/[^A-Za-z]/g, '').toUpperCase();
      teks(k, x, cy + 2, { size, warna: sorot ? KUNING : '#fff', align: 'left' });
      x += ukur(k + ' ', size);
    }
  });
}

const sfx = []; // [waktu, jenis] untuk dicampur saat encoding
const catat = (t, j) => sfx.push([+t.toFixed(3), j]);

const KOMEN = [
  ['@arek.waru', 'TAMBAK BANDENG!! 🐟'],
  ['@nengsda_', 'warung kopi 24 jam ☕'],
  ['@cakbudi99', 'masjid dulu rek 🕌'],
  ['@mbak.candi', 'alun-alun buat nongkrong 🌳'],
];
const IDE = [['🕌 Masjid?', 150, 330], ['☕ Warung kopi?', 560, 280], ['🐟 Tambak bandeng?', 175, 470], ['🏫 Sekolah?', 565, 430]];
const KONFETI = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % W, v: 280 + (i * 53) % 260, r: (i * 31) % 360, w: 10 + (i % 4) * 4, col: ['#f28c28', '#ffd166', '#2a9d8f', '#e63946', '#8338ec'][i % 5], d: (i % 7) * 0.05 }));

function proyeksi(p) { const v = p.clone().project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }

function overlay(t) {
  c.save(); c.scale(SKALA, SKALA);
  // watermark akun
  teks('@sidoarjoverse', 40, 64, { size: 26, warna: 'rgba(255,255,255,.92)', align: 'left', garis: 6, warnaGaris: 'rgba(15,76,92,.6)' });

  // 1. POV + kartu follow
  if (t < awal(2) - 0.1) {
    pil('POV:', W / 2, 170, popS(t, 0.15));
    const s = popS(t, 1.3);
    kartu(W / 2, 282, 600, 104, s, (x, y) => {
      c.fillStyle = TEAL; c.beginPath(); c.arc(x + 58, y + 52, 34, 0, Math.PI * 2); c.fill();
      teks('🐟', x + 58, y + 54, { size: 34 });
      teks('@sidoarjoverse', x + 106, y + 38, { size: 27, warna: '#16324f', align: 'left' });
      teks('Kota Delta dari komen kamu', x + 106, y + 72, { size: 19, warna: '#5b7083', bobot: 500, align: 'left' });
      c.fillStyle = '#e8eef1'; rr(x + 420, y + 30, 160, 46, 14); c.fill();
      teks('Mengikuti ✓', x + 500, y + 54, { size: 21, warna: '#16324f' });
    });
  }
  // 2. papan nama
  if (t >= awal(2) && t < mulaiSeg(3) + 0.3) pil('★ Cak Darjo · Kepala Kota', W / 2, 200, popS(t, awal(2) + 0.7), { bg: OREN, fg: '#fff', size: 34, bayang: '#b8611a' });
  // 3. judul
  if (t >= awal(3) - 0.1 && t < mulaiSeg(5)) {
    const s1 = popS(t, awal(3) - 0.1), s2 = popS(t, awal(3) + 0.6, 0.35);
    denganSkala(W / 2, 290, s1, () => teks('SELAMAT DATANG DI', W / 2, 290, { size: 44, warna: '#fff', garis: 12 }));
    let ts = 80; while (ukur('SIDOARJOVERSE', ts) > 640) ts -= 2;
    denganSkala(W / 2, 370, s2, () => teks('SIDOARJOVERSE', W / 2, 370, { size: ts, warna: KUNING, garis: 18 }));
  }
  // 4. krik krik
  if (t >= akhir(4) + 0.1 && t < mulaiSeg(5)) {
    const a = Math.min(1, (t - akhir(4) - 0.1) / 0.3);
    c.globalAlpha = a;
    teks('krik… krik… 🦗', W / 2 + Math.sin(t * 9) * 4, 640, { size: 46, warna: '#fff', bobot: 700, garis: 10, warnaGaris: 'rgba(0,0,0,.35)' });
    c.globalAlpha = 1;
  }
  // 5. aset kota
  if (t >= awal(5) + 1.5 && t < mulaiSeg(6) + 0.2) pil('🐔 Aset kota: 1 ekor ayam', W / 2, 250, popS(t, awal(5) + 1.5), { bg: '#fff', fg: '#16324f', size: 34, bayang: '#c9c2b4' });
  // 6. konfeti
  if (t >= awal(6) && t < awal(6) + 2.2) {
    for (const k of KONFETI) {
      const u = t - awal(6) - k.d; if (u < 0) continue;
      const y = -30 + u * k.v, x = k.x + Math.sin(u * 3 + k.r) * 30;
      c.save(); c.translate(x, y); c.rotate((k.r + u * 240) * Math.PI / 180); c.fillStyle = k.col; c.fillRect(-k.w / 2, -k.w / 4, k.w, k.w / 2); c.restore();
    }
  }
  // 7. ide bangunan + "semua dari kamu"
  if (t >= mulaiSeg(7) && t < mulaiSeg(8)) {
    const d = S[7].dur;
    IDE.forEach(([str, x, y], i) => pil(str, x, y, popS(t, awal(7) + 0.2 + i * d * 0.17), { bg: '#fff', fg: '#16324f', size: 30, bayang: '#c9c2b4', pad: 20 }));
    pil('👉 SEMUA DARI KAMU', W / 2, 170, popS(t, awal(7) + d * 0.78), { bg: OREN, fg: '#fff', size: 38, bayang: '#b8611a' });
  }
  // 8. aturan kota
  if (t >= mulaiSeg(8) && t < mulaiSeg(9)) {
    const d = S[8].dur;
    kartu(W / 2, 300, 600, 250, popS(t, awal(8) - 0.1), (x, y) => {
      c.fillStyle = TEAL; rr(x, y, 600, 66, [26, 26, 0, 0]); c.fill();
      teks('📜 ATURAN KOTA No. 1', x + 300, y + 35, { size: 32, warna: KUNING });
      teks('Komen ❤️ like terbanyak', x + 300, y + 118, { size: 38, warna: '#16324f' });
      if (t >= awal(8) + d * 0.45) denganSkala(x + 300, y + 190, popS(t, awal(8) + d * 0.45), () => teks('→ BESOK DIBANGUN 🏗️', x + 300, y + 190, { size: 40, warna: OREN }));
    }, { bg: KREM });
    if (t >= awal(8) + d * 0.8) {
      const s = popS(t, awal(8) + d * 0.8, 0.22) * (1 + Math.max(0, 0.6 - (t - awal(8) - d * 0.8)) * 0.6);
      c.save(); c.translate(W / 2 + 150, 470); c.rotate(-0.16);
      denganSkala(0, 0, s, () => { c.lineWidth = 7; c.strokeStyle = '#d62828'; rr(-190, -40, 380, 80, 14); c.stroke(); teks('GAK PAKE PROTES!', 0, 2, { size: 38, warna: '#d62828' }); });
      c.restore();
    }
  }
  // 9. lahan ???
  if (t >= mulaiSeg(9) && t < mulaiSeg(10)) {
    const [px, py] = proyeksi(V(-8, 0.5, -8));
    denganSkala(px, py, popS(t, awal(9) + S[9].dur * 0.55, 0.35), () => teks('???', px, py, { size: 120, warna: '#fff', garis: 16, warnaGaris: OREN }));
    pil('🏗️ BANGUNAN PERTAMA:', W / 2, 180, popS(t, awal(9)), { bg: TEAL, fg: '#fff', size: 36, bayang: '#082d36' });
  }
  // 10. komen sekarang
  if (t >= mulaiSeg(10)) {
    pil('💬 KOMEN SEKARANG 👇', W / 2, 170, popS(t, awal(10) - 0.2), { bg: '#e63946', fg: '#fff', size: 40, bayang: '#9b1d27' });
    KOMEN.forEach(([u, k], i) => {
      const t0 = awal(10) + 0.35 + i * 0.55, kiri = i % 2 === 0;
      const w = Math.max(ukur(k, 26, 600), ukur(u, 21)) + 110, cx = kiri ? 40 + w / 2 : W - 40 - w / 2, cy = 280 + i * 100;
      kartu(cx, cy, w, 80, popS(t, t0), (x, y) => {
        c.fillStyle = ['#f4a261', '#2a9d8f', '#8d5a97', '#e9c46a'][i]; c.beginPath(); c.arc(x + 40, y + 40, 22, 0, Math.PI * 2); c.fill();
        teks(u, x + 74, y + 26, { size: 21, warna: '#5b7083', align: 'left' });
        teks(k, x + 74, y + 55, { size: 26, warna: '#16324f', bobot: 600, align: 'left' });
      }, { tepi: '#e7dcc8' });
    });
  }
  subtitle(t);
  c.restore();
}

// catat efek suara (dipakai saat menggabungkan audio)
catat(0.15, 'pop'); catat(1.3, 'pop'); catat(awal(2) + 0.7, 'pop'); catat(awal(3) - 0.1, 'whoosh'); catat(awal(3) + 0.6, 'pop');
catat(akhir(4) + 0.1, 'krik'); catat(awal(5) + 1.5, 'pop'); catat(awal(6), 'tada');
IDE.forEach((_, i) => catat(awal(7) + 0.2 + i * S[7].dur * 0.17, 'pop')); catat(awal(7) + S[7].dur * 0.78, 'pop');
catat(awal(8) - 0.1, 'pop'); catat(awal(8) + S[8].dur * 0.45, 'pop'); catat(awal(8) + S[8].dur * 0.8, 'stempel');
catat(mulaiSeg(9) + 0.05, 'whoosh'); catat(awal(9) + S[9].dur * 0.55, 'pop'); catat(awal(10) - 0.2, 'pop');
KOMEN.forEach((_, i) => catat(awal(10) + 0.35 + i * 0.55, 'pop'));

// ------------------------------------------------------------ API untuk perekam
let tPrev = 0;
window.video = {
  N, FPS, durasi: TL.durasi, sfx,
  render(f, mutu = 0.9) {
    const t = f / FPS, dt = Math.max(0, t - tPrev); tPrev = t;
    animDarjo(t, f);
    const ks = (t - awal(9) - 0.3) / 0.5;
    sorot.visible = t >= mulaiSeg(9) && t < mulaiSeg(10) && ks > 0;
    sorot.material.opacity = Math.min(1, ks) * (0.42 + Math.sin(t * 6) * 0.14);
    kamera(t);
    world.frame(Math.min(dt, 0.05) || 1 / FPS, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(gl, 0, 0, out.width, out.height);
    overlay(t);
    return out.toDataURL('image/jpeg', mutu);
  },
};
window.videoSiap = true;
