// Lapisan data: otomatis pakai Supabase bila dikonfigurasi, kalau tidak pakai MODE DEMO (localStorage).
import { CONFIG } from './config.js';

export const DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
const KEY_KOTA = 'sv_kota_' + CONFIG.KOTA_ID;
const KEY_WARGA = 'sv_warga_' + CONFIG.KOTA_ID;
const KEY_SESI = 'sv_admin_sesi';

export const NAMA_OK = /^[A-Za-z0-9 ._-]{2,20}$/;

// ---------- util ----------
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
    const w = Object.assign({ id: crypto.randomUUID(), kode: acakKode(), created_at: new Date().toISOString() }, row);
    list.unshift(w);
    localStorage.setItem(KEY_WARGA, JSON.stringify(list));
    return w;
  }
  const rows = await rest('/rest/v1/warga', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
  return rows[0];
}

export async function cariKode(kode) {
  kode = (kode || '').trim().toUpperCase();
  if (!kode) return null;
  if (DEMO) return wargaDemo().find(w => w.kode === kode) || null;
  const rows = await rest(`/rest/v1/warga?kode=eq.${encodeURIComponent(kode)}&select=*`);
  return rows[0] || null;
}

export async function cariNama(q) {
  q = (q || '').trim();
  if (q.length < 2) return [];
  if (DEMO) return wargaDemo().filter(w => w.nama.toLowerCase().includes(q.toLowerCase())).slice(0, 20);
  const pola = encodeURIComponent('*' + q.replace(/[*,()]/g, '') + '*');
  return rest(`/rest/v1/warga?nama=ilike.${pola}&select=*&order=created_at.desc&limit=20`);
}

export async function wargaTerbaru(limit = 30) {
  if (DEMO) return wargaDemo().slice(0, limit);
  return rest(`/rest/v1/warga?select=*&order=created_at.desc&limit=${limit}`);
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
