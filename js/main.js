import { createWorld } from './world.js';
import * as D from './data.js';
import { CONFIG } from './config.js';
import { lookFor, drawPortrait } from './avatar.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const angka = n => new Intl.NumberFormat('id-ID').format(+n || 0);
const rupiah = n => 'Rp' + angka(n);
const KEY_KTP = 'sv_ktpku_' + CONFIG.KOTA_ID;

let kota = null, world = null, wargaList = [], saya = null;
let kodeSaya = localStorage.getItem(KEY_KTP) || '';

// ---------------------------------------------------------------- tab
function buka(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'info') { localStorage.setItem('sv_info_seen', infoTerbaru()); document.querySelector('.tab[data-view=info]').classList.remove('dot'); }
  if (view === 'klasemen') renderKlasemen();
  if (view !== 'peta') tutupCard();
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => buka(t.dataset.view)));

// ---------------------------------------------------------------- header & jam
function jamWIB() {
  const now = new Date();
  const tgl = now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const jam = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  $('clock').textContent = `${tgl} · ${jam} WIB`;
  const h = +now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }) % 24;
  $('phase').textContent = h >= 4 && h < 10 ? 'PAGI' : h < 15 && h >= 10 ? 'SIANG' : h >= 15 && h < 18 ? 'SORE' : 'MALAM';
}

function renderHeader() {
  $('dayBadge').textContent = 'DAY ' + (kota.day ?? 0);
  $('warga').textContent = angka(kota.follower);
  $('wargaUpd').textContent = kota.diperbarui ? 'diperbarui ' + kota.diperbarui : '';
  const items = (kota.berita || []).map(b => `<span>📣 ${esc(b)}</span>`).join('');
  $('ticker').innerHTML = items + items;
  document.title = `${kota.nama || 'SidoarjoVerse'} — ${kota.tagline || ''}`;
}

// ---------------------------------------------------------------- kartu info di peta
function tutupCard() { $('card').hidden = true; world && world.ikuti(null); }
$('cardX').addEventListener('click', tutupCard);

function statusChip(b) {
  const s = b.status || 'selesai';
  const t = s === 'selesai' ? 'Selesai' : s === 'dibangun' ? 'Sedang dibangun' : 'Lahan disiapkan';
  return `<span class="chip ${s}">${t}</span>`;
}

function kartuBangunan(b) {
  const p = b.status === 'selesai' ? 100 : (+b.progres || 0);
  return `<h3>${esc(b.nama)}</h3>${statusChip(b)}
    ${b.status !== 'lahan' ? `<div class="bar"><i style="width:${p}%"></i></div><div class="meta">Progres ${p}%</div>` : ''}
    ${b.day ? `<div class="meta">📅 Dibangun DAY ${esc(b.day)}</div>` : ''}
    ${b.usulan ? `<div class="meta">💬 ${esc(b.usulan)}</div>` : ''}
    ${b.ket ? `<p>${esc(b.ket)}</p>` : ''}
    ${b.status === 'lahan' ? '<p class="meta">Mau dibangun apa di sini? Komen usulanmu di postingan terbaru!</p>' : ''}`;
}

function bicaraMaskot() {
  const m = kota.maskot || {};
  const mk = world.maskot();
  const slot = mk && mk.slot;
  if (slot && slot.ket && Math.random() < 0.5) return slot.ket;
  const k = m.kalimat || ['Halo!'];
  return k[Math.floor(Math.random() * k.length)];
}

function onPick(p, obj) {
  if (!p) { tutupCard(); return; }
  let html = '';
  if (p.jenis === 'bangunan') html = kartuBangunan(p.data);
  else if (p.jenis === 'maskot') {
    const m = p.data;
    html = `<h3>★ ${esc(m.nama)}</h3><div class="meta">${esc(m.jabatan || 'Kepala Kota')} SidoarjoVerse</div>
      <div class="bubble">“${esc(bicaraMaskot())}”</div>
      <div class="ktp-acts" style="justify-content:flex-start"><button class="btn ghost" id="btnIkuti">🎥 Ikuti</button></div>`;
  } else if (p.jenis === 'warga') {
    const w = p.data;
    const mine = w.kode && w.kode === kodeSaya;
    html = `<div style="display:flex;gap:12px;align-items:center"><canvas id="fotoMini" width="96" height="96" style="width:56px;height:56px;border-radius:10px"></canvas>
      <div><h3>${mine ? '⭐ ' : ''}${esc(w.nama)}</h3><div class="meta">${esc(w.pekerjaan)} · Kec. ${esc(w.kecamatan)}</div></div></div>
      <div class="ktp-acts" style="justify-content:flex-start"><button class="btn ghost" id="btnIkuti">🎥 Ikuti</button>${mine ? '<button class="btn oren" id="btnKtpku">Lihat KTP-ku</button>' : ''}</div>`;
  }
  $('cardBody').innerHTML = html;
  $('card').hidden = false;
  const fm = $('fotoMini');
  if (fm) drawPortrait(fm.getContext('2d'), 0, 0, 96, 96, lookFor(p.data));
  const bi = $('btnIkuti'); if (bi) bi.onclick = () => { world.ikuti(obj); bi.textContent = '🎥 Mengikuti…'; };
  const bk = $('btnKtpku'); if (bk) bk.onclick = () => buka('ktp');
}

// ---------------------------------------------------------------- info & riwayat
function infoTerbaru() { return (kota.info || []).map(i => i.tanggal + i.id).sort().pop() || ''; }

function renderInfo() {
  const list = [...(kota.info || [])].sort((a, b) => (b.pin - a.pin) || String(b.tanggal).localeCompare(a.tanggal));
  $('infoList').innerHTML = list.map(i => `<div class="item ${i.pin ? 'pin' : ''}">
      <div class="lab">${i.pin ? '📌 ' : ''}${esc(i.label || 'Info')}</div><h4>${esc(i.judul)}</h4><p>${esc(i.isi)}</p>
      <div class="tgl">${esc(i.tanggal || '')}</div></div>`).join('') || '<p class="sub">Belum ada pengumuman.</p>';
  const dayN = d => parseFloat(String(d).replace(/[^\d.]/g, '')) || 0;
  const riw = (kota.bangunan || []).filter(b => b.status !== 'lahan' && b.tampil !== false).sort((a, b) => dayN(b.day) - dayN(a.day));
  $('riwayat').innerHTML = riw.map(b => `<div class="riw"><span class="d">${b.day ? 'DAY ' + esc(b.day) : '—'}</span>
      <span class="n">${esc(b.nama)}<small>${b.status === 'dibangun' ? 'Sedang dibangun ' + (+b.progres || 0) + '%' : 'Selesai'}${b.usulan ? ' · ' + esc(b.usulan) : ''}</small></span>
      <button data-id="${esc(b.id)}">Lihat</button></div>`).join('');
  $('riwayat').querySelectorAll('button').forEach(btn => btn.onclick = () => {
    buka('peta');
    world.fokusBangunan(btn.dataset.id);
    const b = kota.bangunan.find(x => x.id === btn.dataset.id);
    if (b) onPick({ jenis: 'bangunan', data: b });
  });
  const seen = localStorage.getItem('sv_info_seen');
  if (infoTerbaru() && seen !== infoTerbaru()) document.querySelector('.tab[data-view=info]').classList.add('dot');
}

// ---------------------------------------------------------------- KTP
function gambarKTP(cv, w) {
  const W = 960, H = 600;
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#e9f6f4'); g.addColorStop(1, '#fdf3e1');
  c.fillStyle = g; c.beginPath(); c.roundRect(0, 0, W, H, 34); c.fill();
  // motif ombak delta
  c.save(); c.beginPath(); c.roundRect(0, 0, W, H, 34); c.clip();
  c.strokeStyle = 'rgba(15,76,92,.07)'; c.lineWidth = 6;
  for (let y = 150; y < H + 40; y += 34) { c.beginPath(); for (let x = -20; x <= W + 20; x += 20) c.lineTo(x, y + Math.sin(x / 40) * 8); c.stroke(); }
  c.fillStyle = '#0f4c5c'; c.fillRect(0, 0, W, 112);
  c.fillStyle = '#f28c28'; c.fillRect(0, 112, W, 10);
  c.restore();
  c.fillStyle = '#ffd166'; c.font = '900 40px system-ui, sans-serif'; c.textBaseline = 'middle';
  c.fillText('KARTU TANDA WARGA', 40, 44);
  c.fillStyle = '#fff'; c.font = '700 24px system-ui, sans-serif';
  c.fillText('SIDOARJOVERSE · KOTA DELTA', 40, 84);
  c.textAlign = 'right'; c.fillStyle = '#ffd166'; c.font = '900 30px system-ui, sans-serif'; c.fillText('★', W - 40, 56); c.textAlign = 'left';
  // foto
  c.fillStyle = '#fff'; c.beginPath(); c.roundRect(668, 158, 252, 300, 18); c.fill();
  c.save(); c.beginPath(); c.roundRect(680, 170, 228, 276, 12); c.clip();
  drawPortrait(c, 680, 170, 228, 276, lookFor(w)); c.restore();
  // isi
  const baris = [['NO. WARGA', w.kode], ['NAMA', w.nama], ['PEKERJAAN', w.pekerjaan], ['KECAMATAN', w.kecamatan], ['TERDAFTAR', new Date(w.created_at || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })], ['BERLAKU', 'SELAMA FOLLOW']];
  let y = 180;
  for (const [k, v] of baris) {
    c.fillStyle = '#5b7083'; c.font = '700 20px system-ui, sans-serif'; c.fillText(k, 40, y);
    c.fillStyle = '#16324f'; c.font = (k === 'NO. WARGA' ? '900 34px ui-monospace, monospace' : '800 32px system-ui, sans-serif');
    let t = String(v || '-'); while (c.measureText(t).width > 590 && t.length > 3) t = t.slice(0, -2) + '…';
    c.fillText(t, 40, y + 32); y += 68;
  }
  c.fillStyle = '#16324f'; c.font = 'italic 700 30px Georgia, serif'; c.textAlign = 'center'; c.fillText('Cak Darjo', 794, 500);
  c.strokeStyle = '#16324f'; c.lineWidth = 2; c.beginPath(); c.moveTo(704, 520); c.lineTo(884, 520); c.stroke();
  c.font = '600 16px system-ui, sans-serif'; c.fillStyle = '#5b7083'; c.fillText('Kepala Kota', 794, 542);
  c.textAlign = 'left'; c.font = '600 15px system-ui, sans-serif'; c.fillStyle = '#8796a5';
  c.fillText('Kartu fiksi komunitas SidoarjoVerse · bukan dokumen resmi', 40, H - 28);
}

function renderKTP() {
  const v = $('ktpView');
  if (saya) {
    v.innerHTML = `<h2>KTP-ku</h2><p class="sub">Karaktermu sekarang ikut jalan-jalan di peta ⭐</p>
      <div class="ktp-wrap"><canvas id="ktpCv"></canvas></div>
      <div class="ktp-acts">
        <button class="btn oren" id="kLihat">📍 Lihat aku di peta</button>
        <button class="btn" id="kSimpan">⬇️ Simpan gambar</button>
        <button class="btn ghost" id="kShare">🔗 Bagikan</button>
      </div>
      <p class="mini">Simpan nomor warga <b>${esc(saya.kode)}</b> untuk membuka KTP ini di HP lain.</p>
      <button class="lnk" id="kLupa">Bukan KTP saya / ganti KTP</button>`;
    gambarKTP($('ktpCv'), saya);
    $('kSimpan').onclick = () => { const a = document.createElement('a'); a.download = `KTP-SidoarjoVerse-${saya.nama}.png`; a.href = $('ktpCv').toDataURL('image/png'); a.click(); };
    $('kLihat').onclick = () => {
      buka('peta');
      const c = world.cariWarga(saya.kode);
      if (c) { world.ikuti(c.g); onPick(c.g.userData.pick, c.g); }
    };
    $('kShare').onclick = async () => {
      const teks = `Aku resmi jadi warga SidoarjoVerse dari Kec. ${saya.kecamatan}! 🏙️ Bikin KTP-mu juga:`;
      const url = location.origin + location.pathname;
      try {
        if (navigator.share) await navigator.share({ title: 'SidoarjoVerse', text: teks, url });
        else { await navigator.clipboard.writeText(teks + ' ' + url); $('kShare').textContent = '✅ Link disalin'; }
      } catch (_) {}
    };
    $('kLupa').onclick = () => { if (confirm('Lepas KTP ini dari perangkat ini? (Data warga tetap ada, buka lagi pakai nomor warga.)')) { localStorage.removeItem(KEY_KTP); kodeSaya = ''; saya = null; renderKTP(); refreshWarga(); } };
    $('ctaKtp').hidden = true;
    return;
  }
  $('ctaKtp').hidden = false;
  const pk = (kota.pekerjaan || []).map(p => `<option>${esc(p)}</option>`).join('');
  const kc = (kota.kecamatan || []).map(k => `<option>${esc(k)}</option>`).join('');
  v.innerHTML = `<h2>Bikin KTP Warga</h2><p class="sub">Gratis. Karaktermu akan ikut keliling kota bersama warga lain.</p>
    <form id="fKtp" autocomplete="off">
      <div class="fld"><label for="fNama">Nama panggilan</label><input id="fNama" class="inp" maxlength="20" required placeholder="misal: Rizky"><small>Tampil di peta untuk umum. Jangan pakai nama lengkap.</small></div>
      <div class="fld"><label for="fPek">Pekerjaan versi kota</label><select id="fPek" class="inp">${pk}</select></div>
      <div class="fld"><label>Jenis kelamin</label><div class="seg">
        <label><input type="radio" name="g" value="L" checked><span>Laki-laki</span></label>
        <label><input type="radio" name="g" value="P"><span>Perempuan</span></label>
        <label><input type="radio" name="g" value="-"><span>Rahasia</span></label></div>
        <small>Hanya untuk gambar karaktermu.</small></div>
      <div class="fld"><label for="fKec">Kecamatan</label><select id="fKec" class="inp">${kc}</select><small>Bantu kecamatanmu naik klasemen!</small></div>
      <div class="err" id="fErr"></div>
      <button class="btn oren full" id="fKirim">🪪 Terbitkan KTP</button>
    </form>
    <h3 class="sec">Sudah punya KTP?</h3>
    <div style="display:flex;gap:8px"><input id="fKode" class="inp" placeholder="SDA-XXXXXX" autocapitalize="characters"><button class="btn" id="fBuka">Buka</button></div>
    <div class="err" id="fErr2"></div>`;
  $('fKtp').onsubmit = async e => {
    e.preventDefault();
    const btn = $('fKirim'); btn.disabled = true; $('fErr').textContent = '';
    try {
      const w = await D.daftarWarga({ nama: $('fNama').value, pekerjaan: $('fPek').value, gender: document.querySelector('input[name=g]:checked').value, kecamatan: $('fKec').value });
      setSaya(w);
    } catch (err) { $('fErr').textContent = err.message; }
    btn.disabled = false;
  };
  $('fBuka').onclick = async () => {
    $('fErr2').textContent = '';
    try { const w = await D.cariKode($('fKode').value); if (w) setSaya(w); else $('fErr2').textContent = 'Nomor warga tidak ditemukan.'; }
    catch (err) { $('fErr2').textContent = err.message; }
  };
}

function setSaya(w) {
  saya = w; kodeSaya = w.kode;
  localStorage.setItem(KEY_KTP, w.kode);
  renderKTP();
  refreshWarga();
}

async function refreshWarga() {
  try { wargaList = await D.wargaTerbaru(CONFIG.MAKS_WARGA_DI_PETA); } catch (e) { console.warn(e); wargaList = []; }
  const list = [...wargaList];
  if (saya && !list.some(w => w.kode === saya.kode)) list.unshift(saya);
  world.setWarga(list, kodeSaya);
}

// ---------------------------------------------------------------- klasemen & cari
async function renderKlasemen() {
  const box = $('klasemen');
  try {
    const rows = await D.klasemen(kota.kecamatan);
    const max = Math.max(1, ...rows.map(r => r.total));
    box.innerHTML = rows.map((r, i) => `<div class="klas ${i === 0 && r.total ? 'top1' : ''} ${saya && saya.kecamatan === r.kecamatan ? 'saya' : ''}">
        <span class="no">${i === 0 && r.total ? '🏆' : i + 1}</span>
        <span class="nm"><b>Kec. ${esc(r.kecamatan)}</b><small>${angka(r.total)} warga · +${angka(r.minggu_ini)} minggu ini</small>
        <div class="bar"><i style="width:${(r.total / max) * 100}%"></i></div></span></div>`).join('');
  } catch (e) { box.innerHTML = `<p class="err">Gagal memuat klasemen: ${esc(e.message)}</p>`; }
}

let tCari;
$('cariNama').addEventListener('input', () => {
  clearTimeout(tCari);
  tCari = setTimeout(async () => {
    const q = $('cariNama').value;
    const box = $('hasilCari');
    if (q.trim().length < 2) { box.innerHTML = ''; return; }
    try {
      const rows = await D.cariNama(q);
      box.innerHTML = rows.length ? rows.map((w, i) => `<div class="hasil"><canvas width="76" height="76" data-i="${i}"></canvas>
        <div style="flex:1"><b>${esc(w.nama)}</b><small>${esc(w.pekerjaan)} · Kec. ${esc(w.kecamatan)}</small></div>
        ${world.cariWarga(w.kode) ? `<button class="btn ghost" data-k="${esc(w.kode)}" style="padding:6px 10px">Lihat</button>` : ''}</div>`).join('') : '<p class="sub">Tidak ada warga dengan nama itu.</p>';
      box.querySelectorAll('canvas').forEach(cv => drawPortrait(cv.getContext('2d'), 0, 0, 76, 76, lookFor(rows[+cv.dataset.i])));
      box.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => { const c = world.cariWarga(b.dataset.k); if (c) { buka('peta'); world.ikuti(c.g); onPick(c.g.userData.pick, c.g); } });
    } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }, 300);
});

// ---------------------------------------------------------------- donasi & akun
function renderDonasi() {
  $('donasi').innerHTML = (kota.donasi || []).map(d => {
    const p = Math.min(100, Math.round((+d.terkumpul || 0) / Math.max(1, +d.target || 1) * 100));
    return `<div class="item don"><div class="lab">💝 Donasi</div><h4>${esc(d.judul)}</h4><p>${esc(d.ket)}</p>
      <div class="bar"><i style="width:${p}%"></i></div>
      <div class="angka"><span>Terkumpul <b>${rupiah(d.terkumpul)}</b></span><span>${p}% dari ${rupiah(d.target)}</span></div>
      ${d.link ? `<a class="btn oren full" href="${esc(d.link)}" target="_blank" rel="noopener">${esc(d.tombol || 'Donasi')}</a>` : ''}</div>`;
  }).join('') || '<p class="sub">Belum ada program donasi.</p>';
}

function renderAkun() {
  const ik = { instagram: ['📸', 'Instagram'], tiktok: ['🎵', 'TikTok'], youtube: ['▶️', 'YouTube'], facebook: ['👍', 'Facebook'] };
  $('akun').innerHTML = Object.entries(kota.akun || {}).filter(([, u]) => u).map(([k, u]) =>
    `<a href="${esc(u)}" target="_blank" rel="noopener"><span>${(ik[k] || ['🔗'])[0]}</span>${esc((ik[k] || [k, k])[1])}</a>`).join('');
  $('modeInfo').textContent = D.DEMO ? 'Mode demo: data KTP hanya tersimpan di browser ini. Sambungkan Supabase agar online.' : '';
}

// ---------------------------------------------------------------- peta controls
$('zin').onclick = () => world.zoom(0.75);
$('zout').onclick = () => world.zoom(1.33);
$('cariCak').onclick = () => { const m = world.maskot(); if (m) { world.ikuti(m.g); onPick(m.g.userData.pick, m.g); } };
$('ctaKtp').onclick = () => buka('ktp');
$('map').addEventListener('pointerdown', () => { world && world.ikuti(null); const b = $('btnIkuti'); if (b) b.textContent = '🎥 Ikuti'; });
setTimeout(() => $('hint').classList.add('hide'), 7000);

// ---------------------------------------------------------------- mulai
async function mulai() {
  jamWIB(); setInterval(jamWIB, 15000);
  try {
    kota = await D.ambilKota();
  } catch (e) {
    $('loading').innerHTML = `Gagal memuat data kota.<br><small>${esc(e.message)}</small>`;
    return;
  }
  renderHeader();
  try {
    world = createWorld($('map'), { onPick });
    world.setKota(kota);
  } catch (e) {
    console.error(e);
    $('loading').innerHTML = 'Browser ini belum mendukung peta 3D (WebGL).<br><small>Menu lain tetap bisa dipakai.</small>';
  }
  if (kodeSaya) { try { saya = await D.cariKode(kodeSaya); } catch (_) {} if (!saya) { localStorage.removeItem(KEY_KTP); kodeSaya = ''; } }
  if (world) { await refreshWarga(); $('loading').classList.add('done'); }
  renderInfo(); renderKTP(); renderDonasi(); renderAkun();
}
mulai();
