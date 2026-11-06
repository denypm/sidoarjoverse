# SidoarjoVerse: panduan proyek untuk Claude

Kota virtual Sidoarjo bergaya 3D bulat menggemaskan yang **dibangun dari komentar netizen**.
Akun: @sidoarjoverse · Website: https://sidoarjoverse.github.io · Admin: /admin.html
Bahasa komunikasi dengan pemilik: **Bahasa Indonesia**, santai dan jelas (pemilik bukan programmer).

## Konsep media sosial (jangan diubah tanpa persetujuan pemilik)
- Follow = jadi warga. Komen dengan like terbanyak, besok dibangun. Seri harian "DAY X".
- Website: peta 3D, KTP warga (+PIN), klasemen 18 kecamatan, Pemilu (1 KTP = 1 suara), donasi, mode jalan-jalan.
- Event bertahap sesuai follower: 1.000 = Pemilihan Ketua RT, 3.000 = Camat Verse, 5.000 = sponsor/ruko mitra, 10.000 = Wakil Kepala Kota.
- Tetap fiktif & sopan: tanpa politik nyata, SARA, nama pejabat/merek asli. Jangan meniru karakter/nama/kalimat akun lain (mis. @sekolahbebaz): hanya format yang boleh mirip.

## Cak Darjo (WAJIB konsisten)
Dibuat oleh `makeCakDarjo()` di `js/world.js` (satu sumber untuk website, video, gambar). Jangan buat versi lain.
Kepala bulat besar, badan oval (chibi), peci hitam, kumis, pipi merona, **batik lengan panjang motif udang-bandeng teal**,
selempang oranye, **jam tangan emas** di kiri, **selalu membawa akuarium bundar (1 bandeng + 1 udang)**. Tanpa kacamata.
Sifat ramah, lucu, sedikit ngenes. Bicara Indonesia + Suroboyoan ringan ("rek", "sampeyan", "sesuk tak bangun").

## Membuat video (alur standar)
1. Pemilik mengirim tabel script (dari ChatGPT) atau ide → ubah ke `video/<nama>/naskah.json`
   (format: lihat contoh di bawah; kamera: closeup | medium | mundur | udara | atas | ayam | bangunan:<id>;
   pose: bicara | senyum | melambai | menoleh; stiker: pil, papan, judul, kartu_teks, ide, lahan, aturan, stempel, follow, url, komen, konfeti;
   sfx: pop | whoosh | krik | tada | stempel).
2. `bash alat/buat-video.sh video/<nama>` → suara ElevenLabs + render 1080×1920 + audio + `SidoarjoVerse-<nama>.mp4` + `cover.jpg`.
   Rekaman suara dari pemilik: potong per baris jadi `vo01.wav…`, lalu `SUARA_OPSI=--rekaman bash alat/buat-video.sh video/<nama>`.
3. Uji cepat beberapa frame dulu: `node alat/render.js video/<nama> 30,300,600` (server: `python3 -m http.server 8080` di root repo).
4. Kirim MP4 ke pemilik. Folder `video/` tidak di-commit (gitignore).
- **Subtitle = persis kata yang diucapkan** (kolom Subtitle ChatGPT diabaikan; `subtitle_khusus: true` untuk pengecualian).
- Suara: ElevenLabs (key tersimpan di environment, header `xi-api-key: proxy-injected`), model `eleven_multilingual_v2`.
  Suara resmi: **Bagas** (minta Voice ID ke pemilik jika belum ada di `naskah.json` → `"suara"`). Cadangan: Adam `pNInz6obpgDQGcFmaJgB`.

Contoh satu baris naskah:
```json
{"tts": "Komen dengan like terbanyak, sesuk tak bangun!", "kamera": "closeup", "pose": "bicara",
 "stiker": [{"jenis": "aturan"}], "sfx": "stempel"}
```

## Teknis singkat
- Situs statis (GitHub Pages, repo `sidoarjoverse/sidoarjoverse.github.io`, branch `main`) + Supabase (`js/config.js`, key publishable boleh publik).
- SQL: `supabase/schema.sql` (sudah) dan `supabase/02-pemilu.sql` (pemilik perlu menjalankan di SQL Editor bila belum).
- Uji di localhost dengan `?demo` agar tidak menyentuh database asli.
- Folder rencana `konten-30-hari/` dan `roadmap-fitur/` sengaja tidak di-commit (repo publik).
