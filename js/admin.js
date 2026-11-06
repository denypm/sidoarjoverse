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
    return `<div class="tip">Update angka <b>follower</b> dan <b>DAY</b> setiap hari setelah posting. Angka follower tampil sebagai jumlah WARGA di peta.</div>
    <div class="row"><div class="grid">
      ${inp('nama', 'Nama website')}${inp('kota', 'Nama kota')}${inp('day', 'DAY ke-', 'num')}${inp('follower', 'Jumlah follower (warga)', 'num')}
      ${inp('tagline', 'Tagline', 'text', 'style="grid-column:1/-1"')}
      ${inp('jalan', 'Jalan aspal sudah dibangun', 'bool')}${inp('ayam', 'Jumlah ayam berkeliaran (0–20)', 'num', 'min="0" max="20"')}
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
