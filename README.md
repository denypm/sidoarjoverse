# SidoarjoVerse 🏙️

**Kota Delta yang dibangun dari komen kamu.** Website peta 3D blocky yang tumbuh mengikuti komentar dan follower media sosial.

- **Follow = jadi warga**: jumlah follower tampil sebagai jumlah warga
- **Komen dengan like terbanyak dibangun besok**: admin menambah atau mengubah bangunan lewat panel admin
- **KTP warga**: pengunjung membuat KTP, lalu karakter mereka ikut berjalan di peta
- **Klasemen 18 kecamatan Sidoarjo**, **donasi** dengan progress bar, dan **maskot Cak Darjo** dengan jadwal harian

Semua model 3D dibuat dari kode (Three.js), tanpa aset gambar dari luar.

## Struktur

| File | Fungsi |
|---|---|
| `index.html` | Website utama (Peta, Info, KTP, Klasemen, Donasi, Akun) |
| `admin.html` | Panel admin untuk update kota tanpa ngoding |
| `data/kota.json` | Data awal kota (bangunan, pengumuman, maskot, dll.) |
| `js/config.js` | **Pengaturan**: alamat Supabase, password demo |
| `js/world.js` | Mesin peta 3D: semua model bangunan dan karakter |
| `supabase/schema.sql` | Skema database untuk Supabase |

## Mencoba di komputer

```bash
cd sidoarjoverse
python3 -m http.server 8080
```

Buka http://localhost:8080 (peta) dan http://localhost:8080/admin.html (admin, password demo: `admin`).

Selama `SUPABASE_URL` di `js/config.js` masih kosong, website berjalan dalam **mode demo**: KTP dan perubahan admin hanya tersimpan di browser yang dipakai.

## Menyambungkan Supabase (gratis)

1. Buat akun dan project baru di https://supabase.com.
2. Buka **SQL Editor → New query**, tempel isi `supabase/schema.sql`, lalu klik **Run**.
3. Buka **Authentication → Users → Add user** dan buat akun admin (email + password).
4. Kembali ke SQL Editor, lalu jalankan perintah ini dengan email admin kamu:
   ```sql
   insert into public.admins (email) values ('emailkamu@contoh.com');
   ```
5. Buka **Project Settings → API**, salin **Project URL** dan **anon public key** ke `js/config.js`:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   ```
   Anon key memang aman ditaruh di website publik. Keamanan data dijaga oleh aturan RLS di `schema.sql`.
6. Buka `admin.html`, login, lalu klik **Simpan & Publikasikan** sekali agar data awal masuk ke database.

## Online gratis

Pilih salah satu:

- **Netlify**: buka https://app.netlify.com/drop, lalu seret folder `sidoarjoverse`. Selesai.
- **GitHub Pages**: upload folder ini ke repository GitHub, lalu buka **Settings → Pages → Deploy from branch → main**.
- **Vercel / Cloudflare Pages**: import repository; tidak perlu build command.

Domain sendiri (misalnya `sidoarjoverse.id`) bisa dipasang di pengaturan domain layanan hosting tersebut.

## Rutinitas harian (yang membuat orang terus kembali)

1. **Posting video "DAY X"** dengan judul yang memancing komentar ("Bangun apa besok?", "Kamu dari kecamatan mana?").
2. Malamnya, pilih **komen dengan like terbanyak**.
3. Di `admin.html`:
   - **Umum**: naikkan `DAY`, update jumlah follower, tulis berita berjalan baru
   - **Bangunan**: tambah bangunan usulan (status *Lahan* lalu *Dibangun* lalu *Selesai*), isi "Usulan dari" dengan nama akun pengusul
   - **Info**: umumkan pemenang voting atau agenda baru
4. Rekam layar peta yang berubah sebagai konten video berikutnya.

## Catatan keamanan

- Nama warga dibatasi 2–20 karakter (huruf, angka, spasi, `._-`), dicek di browser **dan** di database.
- Pendaftaran KTP dibatasi maksimal 30 per menit untuk seluruh situs (anti-spam).
- Hapus nama yang tidak pantas di **admin → Warga**.
- Ganti `DEMO_ADMIN_PASSWORD` atau sambungkan Supabase sebelum online. Password demo hanya melindungi mode demo di browser sendiri.

Three.js © three.js authors, lisensi MIT (`vendor/THREE-LICENSE.txt`).
