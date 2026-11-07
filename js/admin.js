import * as D from './data.js';
import { TIPE_LIST } from './tipe.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let kota = null, seksi = 'umum', kotor = false;

// ---------- login
$('loginInfo').textContent = D.DEMO
  ? 'Mode demo: masuk dengan password demo (lihat js/config.js). Perubahan hanya tersimpan di browser ini.'
  : 'Masuk dengan akun admin Supabase.';
if (D.DEMO) $('fldEmail').hidden = true;

$('lMasuk').onclick = async () => {
  $('lErr').textContent = '';
  try { await D.loginAdmin($('lEmail').value.trim(), $('lPass').value); await bukaPanel(); }
  catch (e) { $('lErr').textContent = e.message; }
};
$('lPass').addEventListener('keydown', e => { if (e.key === 'Enter') $('lMasuk').click(); });
$('keluar').onclick = () => { D.logoutAdmin(); location.reload(); };

async function bukaPanel() {
  kota = await D.ambilKota();
  for (const b of kota.bangunan || []) if (b.tampil === undefined) b.tampil = true;
  kota.papan = Object.assign({ tampil: true, judul: 'PENGUMUMAN', isi: 'Selamat datang di SidoarjoVerse!\nFollow = jadi warga\nKomen like terbanyak = besok dibangun\nBikin KTP-mu di tab KTP' }, kota.papan || {});
  kota.maskot = kota.maskot || { nama: 'Cak Darjo', kalimat: [], jadwal: [] };
  kota.maskot.jadwal = kota.maskot.jadwal || [];
  $('login').hidden = true; $('panel').hidden = false; $('keluar').hidden = false;
  render();
}
if (D.sesiAdmin()) bukaPanel();

window.addEventListener('beforeunload', e => { if (kotor) { e.preventDefault(); e.returnValue = ''; } });

// ---------- binder: <input data-p="bangunan.2.nama" data-t="num|bool|lines">
function setPath(path, val) {
  const ks = path.split('.');
  let o = kota;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] ?? (o[ks[i]] = {});
  o[ks.at(-1)] = val;
}
function getPath(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), kota); }
function nilai(el) {
  const t = el.dataset.t;
  if (t === 'bool') return el.checked;
  if (t === 'num') return el.value === '' ? 0 : +el.value;
  if (t === 'lines') return el.value.split('\n').map(s => s.trim()).filter(Boolean);
  return el.value;
}
function tandai() { kotor = true; $('simpanbar').hidden = false; $('status').textContent = 'Ada perubahan yang belum disimpan.'; }
$('isi').addEventListener('input', e => { const el = e.target; if (el.dataset.p) { setPath(el.dataset.p, nilai(el)); tandai(); } });
$('isi').addEventListener('change', e => { const el = e.target; if (el.dataset.p) { setPath(el.dataset.p, nilai(el)); tandai(); if (el.dataset.rerender) render(); } });

const inp = (p, label, t = 'text', extra = '') => {
  const v = getPath(p);
  const val = t === 'lines' ? (v || []).join('\n') : (v ?? '');
  if (t === 'lines' || t === 'area') return `<div class="fld lebar"><label class="k">${label}</label><textarea class="inp" data-p="${p}" data-t="${t === 'area' ? 'text' : 'lines'}" ${extra}>${esc(val)}</textarea></div>`;
  if (t === 'bool') return `<div class="fld"><label class="k">${label}</label><input type="checkbox" data-p="${p}" data-t="bool" ${v ? 'checked' : ''}></div>`;
  return `<div class="fld"><label class="k">${label}</label><input class="inp" data-p="${p}" data-t="${t}" type="${t === 'num' ? 'number' : t === 'date' ? 'date' : 'text'}" value="${esc(val)}" ${extra}></div>`;
};
const sel = (p, label, opts, extra = '') => `<div class="fld"><label class="k">${label}</label><select class="inp" data-p="${p}" ${extra}>${opts.map(([v, t]) => `<option value="${esc(v)}" ${getPath(p) === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;

function idBaru(prefix) { return prefix + Math.random().toString(36).slice(2, 8); }

// ---------- seksi
const SEKSI = {
  umum() {
    setTimeout(async () => { const el = $('statKtp'); if (el) { try { el.textContent = new Intl.NumberFormat('id-ID').format(await D.hitungWarga()); } catch (e) { el.textContent = '?'; } } });
    return `<div class="row stat"><div><small>Total KTP warga (otomatis)</small><b id="statKtp">…</b></div><div><small>Follower (isi manual di bawah)</small><b>${new Intl.NumberFormat('id-ID').format(kota.follower || 0)}</b></div></div>
    <div class="tip">Update angka <b>follower</b> dan <b>DAY</b> setiap hari setelah posting. Angka follower tampil sebagai jumlah WARGA di peta. Jumlah KTP dihitung otomatis setiap ada warga yang membuat KTP.</div>
    <div class="row"><div class="grid">
      ${inp('nama', 'Nama website')}${inp('kota', 'Nama kota')}${inp('day', 'DAY ke-', 'num')}${inp('follower', 'Jumlah follower (warga)', 'num')}
      ${inp('tagline', 'Tagline', 'text', 'style="grid-column:1/-1"')}
      ${inp('jalan', 'Jalan aspal sudah dibangun', 'bool')}${inp('ayam', 'Jumlah ayam berkeliaran (0–20)', 'num', 'min="0" max="20"')}
      ${inp('papan.tampil', 'Tampilkan papan pengumuman di peta', 'bool')}${inp('papan.judul', 'Papan pengumuman: judul')}
      ${inp('papan.isi', 'Papan pengumuman: isi (pakai baris baru, maks ±6 baris)', 'area')}
      ${inp('berita', 'Berita berjalan (satu baris = satu berita)', 'lines')}
    </div></div>
    <div class="row"><div class="hd"><b>Akun resmi</b></div><div class="grid">
      ${inp('akun.instagram', 'Instagram')}${inp('akun.tiktok', 'TikTok')}${inp('akun.youtube', 'YouTube')}${inp('akun.facebook', 'Facebook')}
    </div></div>
    <div class="row"><div class="grid">${inp('pekerjaan', 'Pilihan pekerjaan di KTP (satu per baris)', 'lines')}</div></div>`;
  },
  bangunan() {
    const opsiTipe = TIPE_LIST.map(t => [t.id, t.label]);
    const opsiStatus = [['lahan', 'Lahan (belum dibangun)'], ['dibangun', 'Sedang dibangun'], ['selesai', 'Selesai']];
    return `<div class="tip">Peta punya jalan di x/z = −16, 0, 16 dan sungai di z 21–25. Posisi blok yang aman: x/z = ±8 (blok tengah), ±22 (blok luar), z = 28 untuk area seberang sungai. Lihat hasilnya dengan tombol "Buka peta" setelah menyimpan.</div>
    ${(kota.bangunan || []).map((b, i) => `<div class="row"><div class="hd"><b>${esc(b.nama || '(tanpa nama)')}</b><button class="hapus" data-del="bangunan.${i}">Hapus</button></div><div class="grid">
      ${inp(`bangunan.${i}.nama`, 'Nama')}${sel(`bangunan.${i}.tipe`, 'Model', opsiTipe)}${sel(`bangunan.${i}.status`, 'Status', opsiStatus)}
      ${inp(`bangunan.${i}.progres`, 'Progres %', 'num', 'min="0" max="100"')}${inp(`bangunan.${i}.day`, 'DAY')}
      ${inp(`bangunan.${i}.x`, 'Posisi x', 'num', 'step="0.5"')}${inp(`bangunan.${i}.z`, 'Posisi z', 'num', 'step="0.5"')}${sel(`bangunan.${i}.rot`, 'Putar', [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']].map(([v, t]) => [v, t]), 'data-t="num"')}
      ${b.tipe === 'perumahan' ? inp(`bangunan.${i}.jumlah`, 'Jumlah rumah (1–6)', 'num', 'min="1" max="6"') : ''}
      ${inp(`bangunan.${i}.tampil`, 'Tampil', 'bool')}
      ${inp(`bangunan.${i}.usulan`, 'Usulan dari', 'text', 'style="grid-column:1/-1"')}
      ${inp(`bangunan.${i}.ket`, 'Keterangan', 'area')}
    </div></div>`).join('')}
    <button class="btn tambah" id="addB">+ Tambah bangunan</button>`;
  },
  info() {
    const list = kota.info || [];
    return `${list.map((it, i) => `<div class="row"><div class="hd"><b>${esc(it.judul || '(tanpa judul)')}</b><button class="hapus" data-del="info.${i}">Hapus</button></div><div class="grid">
      ${inp(`info.${i}.judul`, 'Judul', 'text', 'style="grid-column:1/-1"')}${sel(`info.${i}.label`, 'Label', [['Pengumuman', 'Pengumuman'], ['Agenda', 'Agenda'], ['Voting', 'Voting'], ['Info', 'Info']])}
      ${inp(`info.${i}.tanggal`, 'Tanggal', 'date')}${inp(`info.${i}.pin`, 'Sematkan', 'bool')}
      ${inp(`info.${i}.isi`, 'Isi pengumuman', 'area')}
    </div></div>`).join('')}<button class="btn tambah" id="addI">+ Tambah pengumuman</button>`;
  },
  donasi() {
    return `${(kota.donasi || []).map((d, i) => `<div class="row"><div class="hd"><b>${esc(d.judul)}</b><button class="hapus" data-del="donasi.${i}">Hapus</button></div><div class="grid">
      ${inp(`donasi.${i}.judul`, 'Judul')}${inp(`donasi.${i}.link`, 'Link donasi (Saweria, dll)')}${inp(`donasi.${i}.tombol`, 'Teks tombol')}
      ${inp(`donasi.${i}.target`, 'Target (Rp)', 'num')}${inp(`donasi.${i}.terkumpul`, 'Terkumpul (Rp)', 'num')}
      ${inp(`donasi.${i}.ket`, 'Keterangan', 'area')}
    </div></div>`).join('')}<button class="btn tambah" id="addD">+ Tambah program donasi</button>`;
  },
  maskot() {
    const ids = [['keliling', 'Keliling kota'], ...(kota.bangunan || []).filter(b => b.id).map(b => [b.id, b.nama])];
    return `<div class="row"><div class="grid">${inp('maskot.nama', 'Nama maskot')}${inp('maskot.jabatan', 'Jabatan')}
      ${inp('maskot.kalimat', 'Kalimat saat diketuk (satu per baris)', 'lines')}</div></div>
      <h3 class="sec">Jadwal harian (WIB)</h3>
      ${(kota.maskot.jadwal || []).map((j, i) => `<div class="row"><div class="hd"><b>${esc(j.mulai)}–${esc(j.selesai)}</b><button class="hapus" data-del="maskot.jadwal.${i}">Hapus</button></div><div class="grid">
        ${inp(`maskot.jadwal.${i}.mulai`, 'Mulai (HH:MM)')}${inp(`maskot.jadwal.${i}.selesai`, 'Selesai (HH:MM)')}${sel(`maskot.jadwal.${i}.lok`, 'Lokasi', ids)}
        ${inp(`maskot.jadwal.${i}.ket`, 'Ucapan', 'text', 'style="grid-column:1/-1"')}</div></div>`).join('')}
      <button class="btn tambah" id="addJ">+ Tambah jadwal</button>`;
  },
  pemilu() {
    setTimeout(muatPemilu);
    return `<div class="tip"><b>Alur:</b> buat pemilihan (status <i>Pendaftaran</i>) → pilih 2–5 finalis dari komen IG lalu tambahkan sebagai kandidat (isi nomor KTP mereka supaya label jabatan muncul di karakternya) → ubah status ke <i>Voting</i> → setelah waktu habis ubah ke <i>Selesai</i>; pemenang otomatis suara terbanyak. Pemilihan dengan status <i>Draft</i> tidak terlihat publik.<br>Aturan otomatis: 1 KTP = 1 suara, butuh PIN, KTP harus dibuat sebelum waktu mulai voting.</div>
      <div id="pmList">Memuat…</div>`;
  },
  warga() {
    setTimeout(muatWarga);
    return `<div class="tip">Hapus KTP dengan nama tidak pantas. ${D.DEMO ? 'Mode demo: hanya data di browser ini.' : ''}</div>
      <input id="wCari" class="inp" placeholder="Cari nama warga…" style="margin-bottom:10px"><div id="wList">Memuat…</div>`;
  },
  data() {
    return `<div class="row"><div class="hd"><b>Cadangan data</b></div>
      <p class="sub">Unduh semua data kota sebagai file JSON, atau pulihkan dari file cadangan.</p>
      <div class="hd-act"><button class="btn" id="exp">⬇️ Unduh JSON</button><label class="btn ghost" style="color:var(--teal);border-color:var(--teal)">⬆️ Impor JSON<input type="file" id="imp" accept=".json" hidden></label></div></div>
      ${D.DEMO ? `<div class="row"><div class="hd"><b>Reset demo</b></div><p class="sub">Kembalikan data ke isi awal <code>data/kota.json</code> dan hapus warga contoh.</p><button class="btn ghost" id="rst" style="color:#c62828;border-color:#c62828">Reset data demo</button></div>` : ''}`;
  },
};

async function muatWarga() {
  const box = $('wList'); if (!box) return;
  const q = ($('wCari') && $('wCari').value) || '';
  try {
    const rows = q.trim().length >= 2 ? await D.cariNama(q) : await D.wargaTerbaru(50);
    box.innerHTML = rows.map(w => `<div class="wrow"><span><b>${esc(w.nama)}</b><small>${esc(w.kode)} · ${esc(w.pekerjaan)} · Kec. ${esc(w.kecamatan)}</small></span><button class="hapus" data-wid="${esc(w.id)}">Hapus</button></div>`).join('') || '<p class="sub">Belum ada warga.</p>';
    box.querySelectorAll('[data-wid]').forEach(b => b.onclick = async () => {
      if (!confirm('Hapus KTP warga ini?')) return;
      try { await D.hapusWarga(b.dataset.wid); muatWarga(); } catch (e) { alert(e.message); }
    });
  } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  const c = $('wCari'); if (c && !c.dataset.on) { c.dataset.on = 1; let t; c.oninput = () => { clearTimeout(t); t = setTimeout(muatWarga, 300); }; }
}

// ---------- pemilu (langsung tersimpan ke database, terpisah dari tombol Simpan kota)
const keLokal = iso => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const dariLokal = v => v ? new Date(v).toISOString() : null;
const STATUS = [['draft', 'Draft (tersembunyi)'], ['daftar', 'Pendaftaran calon'], ['voting', 'Voting dibuka'], ['selesai', 'Selesai']];
const TEMPLATE = [
  ['Ketua RT', { judul: 'Pemilihan Ketua RT Blok A', jabatan: 'Ketua RT Blok A' }],
  ['Camat Verse', { judul: 'Pemilihan Camat Verse Waru', jabatan: 'Camat Verse Waru', kecamatan: 'Waru' }],
  ['Wakil Kepala Kota', { judul: 'Pemilihan Wakil Kepala Kota', jabatan: 'Wakil Kepala Kota' }],
];

function formPemilu(p, i) {
  const opsiKec = [['', 'Semua warga'], ...(kota.kecamatan || []).map(k => [k, 'Kec. ' + k])];
  const o = (arr, v) => arr.map(([a, b]) => `<option value="${esc(a)}" ${String(v ?? '') === a ? 'selected' : ''}>${esc(b)}</option>`).join('');
  const total = (p.kandidat || []).reduce((a, k) => a + (k.suara || 0), 0);
  return `<div class="row" data-pm="${i}">
    <div class="hd"><b>${p.id ? esc(p.judul) : '➕ Pemilihan baru'}</b>${p.id ? `<span class="chip ${p.status === 'voting' ? 'selesai' : 'lahan'}">${esc((STATUS.find(s => s[0] === p.status) || [])[1] || '')} · ${total} suara</span>` : ''}</div>
    ${p.id ? '' : `<div class="hd-act" style="margin-bottom:8px">${TEMPLATE.map(([t], j) => `<button class="btn ghost kecil2" data-tpl="${j}">${t}</button>`).join('')}</div>`}
    <div class="grid">
      <div class="fld"><label class="k">Judul</label><input class="inp" data-f="judul" value="${esc(p.judul || '')}"></div>
      <div class="fld"><label class="k">Label jabatan pemenang</label><input class="inp" data-f="jabatan" value="${esc(p.jabatan || '')}" placeholder="Ketua RT Blok A"></div>
      <div class="fld"><label class="k">Yang boleh memilih</label><select class="inp" data-f="kecamatan">${o(opsiKec, p.kecamatan || '')}</select></div>
      <div class="fld"><label class="k">Status</label><select class="inp" data-f="status">${o(STATUS, p.status || 'draft')}</select></div>
      <div class="fld"><label class="k">Voting mulai (WIB)</label><input class="inp" type="datetime-local" data-f="mulai" value="${keLokal(p.mulai)}"></div>
      <div class="fld"><label class="k">Voting selesai (WIB)</label><input class="inp" type="datetime-local" data-f="selesai" value="${keLokal(p.selesai)}"></div>
      ${p.id && (p.kandidat || []).length ? `<div class="fld"><label class="k">Pemenang</label><select class="inp" data-f="pemenang">${o([['', '(otomatis: suara terbanyak)'], ...p.kandidat.map(k => [k.id, `${k.nomor}. ${k.nama} (${k.suara || 0})`])], p.pemenang || '')}</select></div>` : ''}
      <div class="fld lebar"><label class="k">Keterangan (cara daftar, hadiah, dll.)</label><textarea class="inp" data-f="ket">${esc(p.ket || '')}</textarea></div>
    </div>
    <div class="hd-act" style="margin-top:10px"><button class="btn oren" data-simpan="${i}">💾 Simpan pemilihan</button>${p.id ? `<button class="hapus" data-hapus="${i}">Hapus pemilihan</button>` : ''}</div>
    <div class="err" data-perr="${i}"></div>
    ${p.id ? `<h3 class="sec" style="margin-top:16px">Kandidat</h3>
      ${(p.kandidat || []).map((k, j) => formKandidat(k, i, j, total)).join('')}
      ${formKandidat({ nomor: (p.kandidat || []).length + 1 }, i, 'baru', total)}` : ''}
  </div>`;
}

function formKandidat(k, i, j, total) {
  const pct = total ? Math.round((k.suara || 0) / total * 100) : 0;
  return `<div class="kandrow" data-kd="${i}:${j}">
    <div class="grid">
      <div class="fld"><label class="k">No.</label><input class="inp" type="number" min="1" data-kf="nomor" value="${esc(k.nomor || 1)}"></div>
      <div class="fld"><label class="k">Nama</label><input class="inp" data-kf="nama" value="${esc(k.nama || '')}"></div>
      <div class="fld"><label class="k">Akun IG</label><input class="inp" data-kf="akun" value="${esc(k.akun || '')}" placeholder="@akun"></div>
      <div class="fld"><label class="k">No. KTP (opsional)</label><input class="inp" data-kf="kode" value="${esc(k._kode || '')}" placeholder="SDA-XXXXXX"></div>
      <div class="fld lebar"><label class="k">Visi-misi (dari komennya)</label><textarea class="inp" data-kf="visi" style="min-height:60px">${esc(k.visi || '')}</textarea></div>
    </div>
    <div class="hd-act" style="margin-top:6px;align-items:center">
      <button class="btn kecil2" data-ksimpan="${i}:${j}">${k.id ? 'Simpan kandidat' : '+ Tambah kandidat'}</button>
      ${k.id ? `<button class="hapus" data-khapus="${i}:${j}">Hapus</button><span class="mini">${k.suara || 0} suara (${pct}%)</span>` : ''}
    </div><div class="err" data-kerr="${i}:${j}"></div></div>`;
}

let pmData = [];
async function muatPemilu() {
  const box = $('pmList'); if (!box) return;
  try { pmData = await D.daftarPemilu({ admin: true }); }
  catch (e) { box.innerHTML = `<p class="err">Gagal memuat: ${esc(e.message)}. ${D.DEMO ? '' : 'Sudah menjalankan supabase/02-pemilu.sql?'}</p>`; return; }
  // tampilkan nomor KTP kandidat yang terhubung
  const ids = pmData.flatMap(p => p.kandidat.map(k => k.warga_id)).filter(Boolean);
  if (ids.length) { const ws = await D.wargaById(ids).catch(() => []); for (const p of pmData) for (const k of p.kandidat) { const w = ws.find(x => x.id === k.warga_id); if (w) k._kode = w.kode; } }
  box.innerHTML = formPemilu({}, 'baru') + pmData.map((p, i) => formPemilu(p, i)).join('');
  const ambil = (sel, attr) => { const o = {}; box.querySelectorAll(sel).forEach(el => o[el.dataset[attr]] = el.value); return o; };
  box.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => {
    const t = TEMPLATE[+b.dataset.tpl][1], row = box.querySelector('[data-pm="baru"]');
    for (const [k, v] of Object.entries(t)) { const el = row.querySelector(`[data-f="${k}"]`); if (el) el.value = v; }
  });
  box.querySelectorAll('[data-simpan]').forEach(b => b.onclick = async () => {
    const i = b.dataset.simpan, row = box.querySelector(`[data-pm="${i}"]`);
    const f = {}; row.querySelectorAll('[data-f]').forEach(el => f[el.dataset.f] = el.value);
    const lama = i === 'baru' ? {} : pmData[+i];
    const p = Object.assign({}, lama, f, { mulai: dariLokal(f.mulai), selesai: dariLokal(f.selesai), kecamatan: f.kecamatan || null, pemenang: f.pemenang || null });
    const err = box.querySelector(`[data-perr="${i}"]`);
    if (!p.judul || !p.jabatan) { err.textContent = 'Judul dan label jabatan wajib diisi.'; return; }
    if (p.status === 'voting' && !p.mulai) p.mulai = new Date().toISOString(); // KTP baru setelah ini tidak bisa ikut
    if (p.status === 'selesai') {
      if (!p.pemenang && (lama.kandidat || []).length) p.pemenang = [...lama.kandidat].sort((a, b) => (b.suara || 0) - (a.suara || 0))[0].id;
      if (!p.selesai || Date.parse(p.selesai) > Date.now()) p.selesai = new Date().toISOString();
    }
    b.disabled = true;
    try { await D.simpanPemilu(p); await muatPemilu(); } catch (e) { err.textContent = e.message; b.disabled = false; }
  });
  box.querySelectorAll('[data-hapus]').forEach(b => b.onclick = async () => {
    const p = pmData[+b.dataset.hapus];
    if (!confirm(`Hapus "${p.judul}" beserta kandidat dan semua suaranya?`)) return;
    try { await D.hapusPemilu(p.id); muatPemilu(); } catch (e) { alert(e.message); }
  });
  box.querySelectorAll('[data-ksimpan]').forEach(b => b.onclick = async () => {
    const [i, j] = b.dataset.ksimpan.split(':'), p = pmData[+i];
    const row = box.querySelector(`[data-kd="${i}:${j}"]`), err = box.querySelector(`[data-kerr="${i}:${j}"]`);
    const f = {}; row.querySelectorAll('[data-kf]').forEach(el => f[el.dataset.kf] = el.value.trim());
    if (!f.nama) { err.textContent = 'Nama kandidat wajib diisi.'; return; }
    let warga_id = null;
    if (f.kode) { const w = await D.cariKode(f.kode).catch(() => null); if (!w) { err.textContent = 'Nomor KTP tidak ditemukan.'; return; } warga_id = w.id; }
    const lama = j === 'baru' ? {} : p.kandidat[+j];
    b.disabled = true;
    try { await D.simpanKandidat({ id: lama.id, pemilu_id: p.id, nomor: f.nomor, nama: f.nama, akun: f.akun, visi: f.visi, warga_id }); await muatPemilu(); }
    catch (e) { err.textContent = e.message; b.disabled = false; }
  });
  box.querySelectorAll('[data-khapus]').forEach(b => b.onclick = async () => {
    const [i, j] = b.dataset.khapus.split(':'), k = pmData[+i].kandidat[+j];
    if (!confirm(`Hapus kandidat ${k.nama}? Suaranya ikut terhapus.`)) return;
    try { await D.hapusKandidat(k.id); muatPemilu(); } catch (e) { alert(e.message); }
  });
}

function render() {
  document.querySelectorAll('.atabs button').forEach(b => b.classList.toggle('on', b.dataset.s === seksi));
  $('isi').innerHTML = SEKSI[seksi]();
  // pilihan "rot" & tipe harus memicu render ulang (ukuran/field berubah)
  $('isi').querySelectorAll('select[data-p$=".tipe"]').forEach(s => s.dataset.rerender = 1);
  $('isi').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    const ks = b.dataset.del.split('.'); const idx = +ks.pop();
    const arr = getPath(ks.join('.'));
    if (confirm('Hapus item ini?')) { arr.splice(idx, 1); tandai(); render(); }
  });
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = () => { fn(); tandai(); render(); }; };
  on('addB', () => kota.bangunan.push({ id: idBaru('b'), nama: 'Bangunan Baru', tipe: 'rumah', x: 8, z: 8, rot: 0, status: 'lahan', progres: 0, day: String(kota.day || ''), usulan: '', ket: '', tampil: true }));
  on('addI', () => (kota.info = kota.info || []).unshift({ id: idBaru('i'), judul: '', isi: '', label: 'Pengumuman', tanggal: new Date().toISOString().slice(0, 10), pin: false }));
  on('addD', () => (kota.donasi = kota.donasi || []).push({ id: idBaru('d'), judul: 'Program Baru', ket: '', link: '', tombol: 'Donasi di sini', target: 1000000, terkumpul: 0 }));
  on('addJ', () => kota.maskot.jadwal.push({ mulai: '00:00', selesai: '01:00', lok: 'keliling', ket: '' }));
  const exp = $('exp'); if (exp) exp.onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(kota, null, 2)], { type: 'application/json' }));
    a.download = 'sidoarjoverse-data.json'; a.click();
  };
  const imp = $('imp'); if (imp) imp.onchange = async () => {
    try { const j = JSON.parse(await imp.files[0].text()); if (!j.bangunan) throw new Error('File bukan data SidoarjoVerse'); kota = j; tandai(); render(); }
    catch (e) { alert('Gagal impor: ' + e.message); }
  };
  const rst = $('rst'); if (rst) rst.onclick = () => { if (confirm('Reset semua data demo?')) { D.resetDemo(); kotor = false; location.reload(); } };
}
document.querySelectorAll('.atabs button').forEach(b => b.onclick = () => { seksi = b.dataset.s; render(); });

$('simpan').onclick = async () => {
  const btn = $('simpan'); btn.disabled = true; $('status').textContent = 'Menyimpan…';
  try {
    for (const b of kota.bangunan) { b.progres = Math.max(0, Math.min(100, +b.progres || 0)); if (b.status === 'selesai') b.progres = 100; }
    await D.simpanKota(kota);
    kotor = false; $('status').textContent = '✅ Tersimpan! Peta sudah diperbarui.';
    setTimeout(() => { if (!kotor) $('simpanbar').hidden = true; }, 2500);
  } catch (e) { $('status').textContent = '❌ ' + e.message; }
  btn.disabled = false;
};
