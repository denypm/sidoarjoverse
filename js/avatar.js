// Penampilan karakter warga, ditentukan dari kode KTP (selalu sama di kartu & di peta).
const KULIT = ['#f1c27d', '#e0ac69', '#c68642', '#d9a066', '#eac086'];
const BAJU = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#8d5a97', '#e9c46a', '#3a86ff', '#ff6b9a', '#06a77d', '#f77f00'];
const CELANA = ['#2b2d42', '#3d405b', '#5c4033', '#264653', '#1d3557'];
const RAMBUT = ['#2b1d16', '#1a1a1a', '#4a2c1a', '#3b2416'];
const KERUDUNG = ['#e76f51', '#2a9d8f', '#8338ec', '#f4a261', '#ef476f', '#118ab2'];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function lookFor(w) {
  const h = hash((w && (w.kode || w.nama)) || 'x');
  const p = (arr, n) => arr[(h >>> n) % arr.length];
  const g = w && w.gender;
  return {
    kulit: p(KULIT, 0),
    baju: p(BAJU, 3),
    celana: p(CELANA, 7),
    rambut: p(RAMBUT, 11),
    kerudung: g === 'P' && (h >>> 13) % 2 === 0 ? p(KERUDUNG, 15) : null,
    rambutPanjang: g === 'P',
    kumis: g === 'L' && (h >>> 17) % 3 === 0,
    kacamata: (h >>> 19) % 5 === 0,
  };
}

// Gambar wajah blok (dipakai untuk tekstur kepala 3D dan foto KTP).
export function drawFace(ctx, x, y, s, look, opt = {}) {
  const u = s / 8;
  ctx.fillStyle = look.kulit; ctx.fillRect(x, y, s, s);
  // rambut / kerudung
  if (look.kerudung) {
    ctx.fillStyle = look.kerudung;
    ctx.fillRect(x, y, s, u * 2); ctx.fillRect(x, y, u, s); ctx.fillRect(x + s - u, y, u, s);
  } else if (!opt.peci) {
    ctx.fillStyle = look.rambut;
    ctx.fillRect(x, y, s, u * 1.6);
    if (look.rambutPanjang) { ctx.fillRect(x, y, u, s * 0.8); ctx.fillRect(x + s - u, y, u, s * 0.8); }
  }
  if (opt.peci) { ctx.fillStyle = '#151515'; ctx.fillRect(x, y, s, u * 1.4); }
  // mata
  ctx.fillStyle = '#fff'; ctx.fillRect(x + u * 1.6, y + u * 3, u * 1.6, u * 1.6); ctx.fillRect(x + u * 4.8, y + u * 3, u * 1.6, u * 1.6);
  ctx.fillStyle = '#1b1b1b'; ctx.fillRect(x + u * 2.2, y + u * 3.4, u * 0.9, u * 1.2); ctx.fillRect(x + u * 5.4, y + u * 3.4, u * 0.9, u * 1.2);
  // alis
  ctx.fillStyle = look.rambut; ctx.fillRect(x + u * 1.5, y + u * 2.4, u * 1.8, u * 0.45); ctx.fillRect(x + u * 4.7, y + u * 2.4, u * 1.8, u * 0.45);
  if (look.kacamata) {
    ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.strokeRect(x + u * 1.3, y + u * 2.8, u * 2.2, u * 2); ctx.strokeRect(x + u * 4.5, y + u * 2.8, u * 2.2, u * 2);
    ctx.beginPath(); ctx.moveTo(x + u * 3.5, y + u * 3.6); ctx.lineTo(x + u * 4.5, y + u * 3.6); ctx.stroke();
  }
  // hidung
  ctx.fillStyle = 'rgba(90,40,10,.18)'; ctx.fillRect(x + u * 3.6, y + u * 4.3, u * 0.8, u * 0.9);
  // pipi
  ctx.fillStyle = 'rgba(230,80,80,.25)'; ctx.fillRect(x + u * 1, y + u * 5, u * 1.2, u * 0.8); ctx.fillRect(x + u * 5.8, y + u * 5, u * 1.2, u * 0.8);
  // kumis / mulut
  if (look.kumis || opt.kumis) { ctx.fillStyle = '#2a1a10'; ctx.fillRect(x + u * 2.4, y + u * 5.3, u * 3.2, u * 0.8); }
  if (opt.mulut === 'buka') { // sedang bicara
    ctx.fillStyle = '#4a1414'; ctx.fillRect(x + u * 2.7, y + u * 6.1, u * 2.6, u * 1.3);
    ctx.fillStyle = '#e86a6a'; ctx.fillRect(x + u * 3.2, y + u * 6.9, u * 1.6, u * 0.5);
  } else if (opt.mulut === 'senyum') {
    ctx.fillStyle = '#7a2e2e'; ctx.fillRect(x + u * 2.6, y + u * 6.3, u * 2.8, u * 0.5); ctx.fillRect(x + u * 2.3, y + u * 5.95, u * 0.45, u * 0.5); ctx.fillRect(x + u * 5.25, y + u * 5.95, u * 0.45, u * 0.5);
  } else { ctx.fillStyle = '#7a2e2e'; ctx.fillRect(x + u * 3, y + u * 6.3, u * 2, u * 0.6); }
}

// Foto KTP: gaya bulat (sama dengan karakter 3D): kepala bulat besar + badan oval.
export function drawPortrait(ctx, x, y, w, h, look, opt = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#cfe8ef'; ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, R = w * 0.3, hy = y + h * 0.42;
  const el = (ex, ey, rx, ry, c, rot = 0) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); };
  // badan
  el(cx, y + h * 1.02, w * 0.4, h * 0.36, opt.baju || look.baju);
  // rambut belakang / kerudung
  if (look.kerudung) el(cx, hy + R * 0.15, R * 1.18, R * 1.2, look.kerudung);
  else if (look.rambutPanjang) el(cx, hy + R * 0.25, R * 1.08, R * 1.15, look.rambut);
  // telinga & kepala
  if (!look.kerudung) { el(cx - R, hy, R * 0.16, R * 0.22, look.kulit); el(cx + R, hy, R * 0.16, R * 0.22, look.kulit); }
  el(cx, hy, R, R * 0.95, look.kulit);
  // rambut atas / peci
  if (!look.kerudung) {
    ctx.fillStyle = look.rambut; ctx.beginPath(); ctx.ellipse(cx, hy - R * 0.1, R * 1.02, R * 0.92, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  }
  if (opt.peci) { ctx.fillStyle = '#151515'; ctx.fillRect(cx - R * 0.66, hy - R * 1.32, R * 1.32, R * 0.5); }
  // mata + kilau
  for (const s of [-1, 1]) {
    el(cx + s * R * 0.33, hy + R * 0.02, R * 0.13, R * 0.17, '#1b1b1b');
    el(cx + s * R * 0.33 + R * 0.05, hy - R * 0.06, R * 0.045, R * 0.05, '#ffffff');
    el(cx + s * R * 0.55, hy + R * 0.28, R * 0.13, R * 0.07, 'rgba(240,138,138,.8)');
    ctx.strokeStyle = look.kerudung ? '#3a2a20' : look.rambut; ctx.lineWidth = R * 0.06; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + s * R * 0.22, hy - R * 0.33); ctx.lineTo(cx + s * R * 0.44, hy - R * 0.36); ctx.stroke();
  }
  if (look.kacamata) { ctx.strokeStyle = '#333'; ctx.lineWidth = R * 0.05; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * R * 0.33, hy + R * 0.02, R * 0.22, 0, Math.PI * 2); ctx.stroke(); } }
  el(cx, hy + R * 0.16, R * 0.08, R * 0.07, 'rgba(90,40,10,.25)');           // hidung
  if (look.kumis || opt.kumis) { ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = R * 0.1; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, hy + R * 0.33); ctx.lineTo(cx + s * R * 0.24, hy + R * 0.4); ctx.stroke(); } }
  ctx.strokeStyle = '#6b2424'; ctx.lineWidth = R * 0.055;                       // senyum
  ctx.beginPath(); ctx.arc(cx, hy + R * 0.38, R * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.restore();
}
