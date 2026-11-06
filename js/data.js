// Lapisan data: otomatis pakai Supabase bila dikonfigurasi, kalau tidak pakai MODE DEMO (localStorage).
import { CONFIG } from './config.js';

// ?demo di localhost memaksa mode demo (untuk uji coba tanpa menyentuh database asli).
const PAKSA_DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('demo');
export const DEMO = PAKSA_DEMO || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
// Kolom warga yang boleh dibaca publik (PIN sengaja tidak).
const KOLOM = 'id,kode,nama,pekerjaan,gender,kecamatan,created_at';
const KEY_PEMILU = 'sv_pemilu_' + CONFIG.KOTA_ID;
const KEY_KOTA = 'sv_kota_' + CONFIG.KOTA_ID;
const KEY_WARGA = 'sv_warga_' + CONFIG.KOTA_ID;
const KEY_SESI = 'sv_admin_sesi';

export const NAMA_OK = /^[A-Za-z0-9 ._-]{2,20}$/;

// ---------- util ----------
function acakPin() {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint32Array(6); crypto.getRandomValues(buf);
  return [...buf].map(n => huruf[n % huruf.length]).join('');
}

function acakKode() {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  for (const n of buf) s += huruf[n % huruf.length];
  return 'SDA-' + s;
}

async function rest(path, opt = {}, token) {
  // apikey saja sudah cukup untuk pengunjung (berlaku untuk key lama "anon" maupun baru "sb_publishable_").
  // Authorization hanya dikirim untuk admin yang sudah login.
  const headers = Object.assign({ apikey: CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    token && token !== 'demo' ? { Authorization: 'Bearer ' + token } : {}, opt.headers || {});
  const r = await fetch(CONFIG.SUPABASE_URL.replace(/\/$/, '') + path, Object.assign({}, opt, { headers, cache: 'no-store' }));
  if (!r.ok) {
    let msg = r.status + '';
    try { const j = await r.json(); msg = j.message || j.error_description || j.msg || msg; } catch (_) {}
    throw new Error(msg);
  }
  if (r.status === 204) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function kotaBawaan() {
  const r = await fetch('data/kota.json?v=' + Date.now(), { cache: 'no-store' });
  return r.json();
}

// ---------- data kota ----------
export async function ambilKota() {
  if (DEMO) {
    const s = localStorage.getItem(KEY_KOTA);
    if (s) { try { return JSON.parse(s); } catch (_) {} }
    return kotaBawaan();
  }
  const rows = await rest(`/rest/v1/kota?id=eq.${encodeURIComponent(CONFIG.KOTA_ID)}&select=data`);
  if (rows && rows[0] && rows[0].data && Object.keys(rows[0].data).length) return rows[0].data;
  return kotaBawaan(); // tabel masih kosong: tampilkan data bawaan
}

export async function simpanKota(data) {
  data.diperbarui = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 16);
  if (DEMO) { localStorage.setItem(KEY_KOTA, JSON.stringify(data)); return; }
  const sesi = sesiAdmin();
  if (!sesi) throw new Error('Belum login');
  const rows = await rest('/rest/v1/kota', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: CONFIG.KOTA_ID, data, updated_at: new Date().toISOString() }),
  }, sesi.token);
  if (!rows || !rows.length) throw new Error('Tidak diizinkan. Pastikan email kamu ada di tabel admins.');
}

export function resetDemo() {
  localStorage.removeItem(KEY_KOTA);
  localStorage.removeItem(KEY_WARGA);
  localStorage.removeItem(KEY_PEMILU);
}

// ---------- warga / KTP ----------

function wargaDemo() {
  const s = localStorage.getItem(KEY_WARGA);
  if (s) { try { return JSON.parse(s); } catch (_) {} }
  // Mulai kosong: belum ada warga selain kamu (maskot).
  const list = [];
  localStorage.setItem(KEY_WARGA, JSON.stringify(list));
  return list;
}

export async function daftarWarga({ nama, pekerjaan, gender, kecamatan }) {
  nama = (nama || '').trim().replace(/\s+/g, ' ');
  if (!NAMA_OK.test(nama)) throw new Error('Nama 2–20 karakter: huruf, angka, spasi, titik, - atau _');
  const row = { nama, pekerjaan, gender, kecamatan };
  if (DEMO) {
    const list = wargaDemo();
    const w = Object.assign({ id: crypto.randomUUID(), kode: acakKode(), pin: acakPin(), created_at: new Date().toISOString() }, row);
    list.unshift(w);
    localStorage.setItem(KEY_WARGA, JSON.stringify(list));
    return w;
  }
  try {
    return await rest('/rest/v1/rpc/daftar_warga', { method: 'POST', body: JSON.stringify({ p_nama: nama, p_pekerjaan: pekerjaan, p_gender: gender, p_kecamatan: kecamatan }) });
  } catch (e) {
    // Database belum diperbarui dengan 02-pemilu.sql: pakai cara lama (tanpa PIN).
    if (!/daftar_warga|function|404|PGRST202/i.test(e.message)) throw e;
    const rows = await rest(`/rest/v1/warga?select=${KOLOM}`, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
    return rows[0];
  }
}

export async function cariKode(kode) {
  kode = (kode || '').trim().toUpperCase();
  if (!kode) return null;
  if (DEMO) return wargaDemo().find(w => w.kode === kode) || null;
  const rows = await rest(`/rest/v1/warga?kode=eq.${encodeURIComponent(kode)}&select=${KOLOM}`);
  return rows[0] || null;
}

export async function cariNama(q) {
  q = (q || '').trim();
  if (q.length < 2) return [];
  if (DEMO) return wargaDemo().filter(w => w.nama.toLowerCase().includes(q.toLowerCase())).slice(0, 20);
  const pola = encodeURIComponent('*' + q.replace(/[*,()]/g, '') + '*');
  return rest(`/rest/v1/warga?nama=ilike.${pola}&select=${KOLOM}&order=created_at.desc&limit=20`);
}

export async function wargaTerbaru(limit = 30) {
  if (DEMO) return wargaDemo().slice(0, limit);
  return rest(`/rest/v1/warga?select=${KOLOM}&order=created_at.desc&limit=${limit}`);
}

export async function wargaById(ids) {
  ids = [...new Set(ids.filter(Boolean))];
  if (!ids.length) return [];
  if (DEMO) return wargaDemo().filter(w => ids.includes(w.id));
  return rest(`/rest/v1/warga?id=in.(${ids.map(encodeURIComponent).join(',')})&select=${KOLOM}`);
}

export async function cekPin(kode, pin) {
  kode = (kode || '').trim().toUpperCase(); pin = (pin || '').trim().toUpperCase();
  if (DEMO) return wargaDemo().some(w => w.kode === kode && w.pin === pin);
  return rest('/rest/v1/rpc/cek_pin', { method: 'POST', body: JSON.stringify({ p_kode: kode, p_pin: pin }) });
}

export async function hitungWarga() {
  if (DEMO) return wargaDemo().length;
  const r = await fetch(CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/warga?select=id', {
    method: 'HEAD', headers: { apikey: CONFIG.SUPABASE_ANON_KEY, Prefer: 'count=exact', Range: '0-0' }, cache: 'no-store' });
  const m = (r.headers.get('content-range') || '').match(/\/(\d+)/);
  return m ? +m[1] : 0;
}

export async function klasemen(daftarKecamatan) {
  let rows;
  if (DEMO) {
    const seminggu = Date.now() - 7 * 864e5;
    const m = {};
    for (const w of wargaDemo()) {
      const k = m[w.kecamatan] || (m[w.kecamatan] = { kecamatan: w.kecamatan, total: 0, minggu_ini: 0 });
      k.total++;
      if (new Date(w.created_at).getTime() > seminggu) k.minggu_ini++;
    }
    rows = Object.values(m);
  } else {
    rows = await rest('/rest/v1/klasemen_kecamatan?select=*');
  }
  const ada = new Map(rows.map(r => [r.kecamatan, r]));
  for (const k of daftarKecamatan || []) if (!ada.has(k)) rows.push({ kecamatan: k, total: 0, minggu_ini: 0 });
  return rows.sort((a, b) => b.total - a.total || a.kecamatan.localeCompare(b.kecamatan));
}

export async function hapusWarga(id) {
  if (DEMO) {
    simpanPemiluDemo(pemiluDemo().map(p => Object.assign(p, { suara: (p.suara || []).filter(s => s.warga_id !== id) })));
    localStorage.setItem(KEY_WARGA, JSON.stringify(wargaDemo().filter(w => w.id !== id)));
    return;
  }
  const sesi = sesiAdmin();
  await rest(`/rest/v1/warga?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }, sesi && sesi.token);
}

// ---------- admin ----------
export function sesiAdmin() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY_SESI) || 'null');
    if (s && s.kadaluarsa > Date.now()) return s;
  } catch (_) {}
  return null;
}

export async function loginAdmin(email, password) {
  if (DEMO) {
    if (password !== CONFIG.DEMO_ADMIN_PASSWORD) throw new Error('Password salah');
    sessionStorage.setItem(KEY_SESI, JSON.stringify({ token: 'demo', email: 'demo', kadaluarsa: Date.now() + 8 * 3600e3 }));
    return;
  }
  const j = await rest('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  sessionStorage.setItem(KEY_SESI, JSON.stringify({ token: j.access_token, email, kadaluarsa: Date.now() + (j.expires_in - 60) * 1000 }));
}

export function logoutAdmin() { sessionStorage.removeItem(KEY_SESI); }

// ---------- pemilu ----------
// Bentuk data: { id, judul, jabatan, kecamatan, status, mulai, selesai, ket, pemenang, created_at, kandidat: [{id, nomor, nama, akun, visi, warga_id}] }
function pemiluDemo() { try { return JSON.parse(localStorage.getItem(KEY_PEMILU) || '[]'); } catch (_) { return []; } }
function simpanPemiluDemo(l) { localStorage.setItem(KEY_PEMILU, JSON.stringify(l)); }
const tanpaSuara = p => { const { suara, ...x } = p; return x; };

// Daftar pemilu (publik: tanpa draft; admin: semua). Sertakan jumlah suara per kandidat.
export async function daftarPemilu({ admin = false } = {}) {
  let list;
  if (DEMO) {
    list = pemiluDemo().filter(p => admin || p.status !== 'draft').map(p => {
      const x = tanpaSuara(p);
      x.kandidat = (x.kandidat || []).map(k => Object.assign({}, k, { suara: (p.suara || []).filter(s => s.kandidat_id === k.id).length }));
      return x;
    });
  } else {
    const sesi = admin ? sesiAdmin() : null;
    list = await rest('/rest/v1/pemilu?select=*,kandidat(*)&order=created_at.desc', {}, sesi && sesi.token);
    const hasil = await rest('/rest/v1/hasil_pemilu?select=*');
    const m = new Map(hasil.map(h => [h.kandidat_id, h.suara]));
    for (const p of list) for (const k of p.kandidat || []) k.suara = m.get(k.id) || 0;
  }
  for (const p of list) (p.kandidat || []).sort((a, b) => a.nomor - b.nomor);
  return list;
}

export async function vote(kode, pin, kandidatId) {
  kode = (kode || '').trim().toUpperCase(); pin = (pin || '').trim().toUpperCase();
  if (!DEMO) return rest('/rest/v1/rpc/vote', { method: 'POST', body: JSON.stringify({ p_kode: kode, p_pin: pin, p_kandidat: kandidatId }) });
  const w = wargaDemo().find(x => x.kode === kode);
  if (!w || w.pin !== pin) throw new Error('Nomor KTP atau PIN salah.');
  const list = pemiluDemo();
  const p = list.find(x => (x.kandidat || []).some(k => k.id === kandidatId));
  if (!p) throw new Error('Kandidat tidak ditemukan.');
  const now = Date.now();
  if (p.status !== 'voting' || (p.mulai && now < Date.parse(p.mulai)) || (p.selesai && now > Date.parse(p.selesai))) throw new Error('Voting belum dibuka atau sudah ditutup.');
  if (p.kecamatan && p.kecamatan !== w.kecamatan) throw new Error(`Pemilihan ini khusus warga Kec. ${p.kecamatan}.`);
  if (p.mulai && Date.parse(w.created_at) > Date.parse(p.mulai)) throw new Error('KTP-mu dibuat setelah voting dibuka. Ikut pemilihan berikutnya, ya!');
  p.suara = p.suara || [];
  if (p.suara.some(s => s.warga_id === w.id)) throw new Error('Kamu sudah memilih di pemilihan ini.');
  p.suara.push({ warga_id: w.id, kandidat_id: kandidatId });
  simpanPemiluDemo(list);
  return { ok: true };
}

export async function pilihanku(kode, pin, pemiluId) {
  if (!kode || !pin) return null;
  if (!DEMO) return rest('/rest/v1/rpc/pilihanku', { method: 'POST', body: JSON.stringify({ p_kode: kode, p_pin: pin, p_pemilu: pemiluId }) });
  const w = wargaDemo().find(x => x.kode === kode && x.pin === pin);
  const p = pemiluDemo().find(x => x.id === pemiluId);
  const s = w && p && (p.suara || []).find(x => x.warga_id === w.id);
  return s ? s.kandidat_id : null;
}

// Pejabat aktif: pemenang pemilu terakhir per jabatan.
export async function pejabat() {
  if (!DEMO) return rest('/rest/v1/pejabat?select=*');
  const terbaru = new Map();
  for (const p of pemiluDemo().filter(p => p.status === 'selesai' && p.pemenang)) {
    const t = Date.parse(p.selesai || p.created_at);
    if (!terbaru.has(p.jabatan) || t > terbaru.get(p.jabatan).t) terbaru.set(p.jabatan, { p, t });
  }
  const ws = wargaDemo();
  return [...terbaru.values()].map(({ p }) => {
    const k = (p.kandidat || []).find(k => k.id === p.pemenang) || {};
    const w = ws.find(w => w.id === k.warga_id);
    return { jabatan: p.jabatan, pemilu_id: p.id, nama: k.nama, akun: k.akun, warga_id: k.warga_id || null, kode: w ? w.kode : null, selesai: p.selesai };
  });
}

// ----- admin pemilu
export async function simpanPemilu(p) {
  const row = { judul: p.judul, jabatan: p.jabatan, kecamatan: p.kecamatan || null, status: p.status, mulai: p.mulai || null, selesai: p.selesai || null, ket: p.ket || '', pemenang: p.pemenang || null };
  if (DEMO) {
    const list = pemiluDemo();
    let x = p.id && list.find(q => q.id === p.id);
    if (!x) { x = { id: crypto.randomUUID(), created_at: new Date().toISOString(), kandidat: [], suara: [] }; list.unshift(x); }
    Object.assign(x, row);
    simpanPemiluDemo(list);
    return x;
  }
  const sesi = sesiAdmin();
  const body = p.id ? Object.assign({ id: p.id }, row) : row;
  const rows = await rest('/rest/v1/pemilu', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(body) }, sesi && sesi.token);
  if (!rows || !rows.length) throw new Error('Tidak diizinkan. Sudah menjalankan 02-pemilu.sql dan login sebagai admin?');
  return rows[0];
}

export async function hapusPemilu(id) {
  if (DEMO) { simpanPemiluDemo(pemiluDemo().filter(p => p.id !== id)); return; }
  const sesi = sesiAdmin();
  await rest(`/rest/v1/pemilu?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }, sesi && sesi.token);
}

export async function simpanKandidat(k) {
  const row = { pemilu_id: k.pemilu_id, warga_id: k.warga_id || null, nomor: +k.nomor || 1, nama: k.nama, akun: k.akun || '', visi: k.visi || '' };
  if (DEMO) {
    const list = pemiluDemo();
    const p = list.find(q => q.id === k.pemilu_id);
    if (!p) throw new Error('Pemilu tidak ditemukan');
    let x = k.id && p.kandidat.find(q => q.id === k.id);
    if (!x) { x = { id: crypto.randomUUID() }; p.kandidat.push(x); }
    Object.assign(x, row);
    simpanPemiluDemo(list);
    return x;
  }
  const sesi = sesiAdmin();
  const body = k.id ? Object.assign({ id: k.id }, row) : row;
  const rows = await rest('/rest/v1/kandidat', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(body) }, sesi && sesi.token);
  if (!rows || !rows.length) throw new Error('Tidak diizinkan.');
  return rows[0];
}

export async function hapusKandidat(id) {
  if (DEMO) { simpanPemiluDemo(pemiluDemo().map(p => Object.assign(p, { kandidat: p.kandidat.filter(k => k.id !== id), suara: (p.suara || []).filter(s => s.kandidat_id !== id) }))); return; }
  const sesi = sesiAdmin();
  await rest(`/rest/v1/kandidat?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }, sesi && sesi.token);
}
