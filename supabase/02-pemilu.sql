-- SidoarjoVerse: fitur PEMILU + PIN KTP + jabatan.
-- Jalankan SEKALI di Supabase > SQL Editor (setelah schema.sql). Aman dijalankan ulang.

-- 1) PIN rahasia per KTP (hanya pemilik KTP yang tahu; dipakai untuk vote)
create or replace function public.acak_pin() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;
alter table public.warga add column if not exists pin text not null default public.acak_pin();

-- Kolom PIN tidak boleh dibaca publik: izin baca per kolom.
revoke select, insert, update on public.warga from anon, authenticated;
grant select (id, kode, nama, pekerjaan, gender, kecamatan, created_at) on public.warga to anon, authenticated;
grant delete on public.warga to authenticated;

-- Pendaftaran KTP lewat fungsi (mengembalikan PIN sekali ke pemiliknya)
drop policy if exists "warga daftar" on public.warga;
create or replace function public.daftar_warga(p_nama text, p_pekerjaan text, p_gender text, p_kecamatan text)
returns json language plpgsql security definer set search_path = public as $$
declare w public.warga;
begin
  insert into public.warga (nama, pekerjaan, gender, kecamatan)
  values (trim(regexp_replace(p_nama, '\s+', ' ', 'g')), p_pekerjaan, coalesce(p_gender, '-'), p_kecamatan)
  returning * into w;
  return row_to_json(w);
end $$;

create or replace function public.cek_pin(p_kode text, p_pin text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.warga where kode = upper(trim(p_kode)) and pin = upper(trim(p_pin)));
$$;

-- 2) Pemilu & kandidat
create table if not exists public.pemilu (
  id uuid primary key default gen_random_uuid(),
  judul text not null check (char_length(judul) between 2 and 80),
  jabatan text not null check (char_length(jabatan) between 2 and 40),   -- label pemenang, mis. "Ketua RT Blok A"
  kecamatan text,                                                        -- isi = hanya warga kecamatan ini yang boleh vote
  status text not null default 'draft' check (status in ('draft', 'daftar', 'voting', 'selesai')),
  mulai timestamptz,
  selesai timestamptz,
  ket text,
  pemenang uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.kandidat (
  id uuid primary key default gen_random_uuid(),
  pemilu_id uuid not null references public.pemilu(id) on delete cascade,
  warga_id uuid references public.warga(id) on delete set null,
  nomor int not null default 1,
  nama text not null check (char_length(nama) between 1 and 40),
  akun text,
  visi text,
  created_at timestamptz not null default now()
);
create table if not exists public.suara (
  pemilu_id uuid not null references public.pemilu(id) on delete cascade,
  warga_id uuid not null references public.warga(id) on delete cascade,
  kandidat_id uuid not null references public.kandidat(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pemilu_id, warga_id)
);
create index if not exists suara_kandidat_idx on public.suara (kandidat_id);

alter table public.pemilu enable row level security;
alter table public.kandidat enable row level security;
alter table public.suara enable row level security;

drop policy if exists "pemilu dibaca" on public.pemilu;
create policy "pemilu dibaca" on public.pemilu for select using (status <> 'draft' or public.is_admin());
drop policy if exists "pemilu admin" on public.pemilu;
create policy "pemilu admin" on public.pemilu for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kandidat dibaca" on public.kandidat;
create policy "kandidat dibaca" on public.kandidat for select using (
  exists (select 1 from public.pemilu p where p.id = pemilu_id and (p.status <> 'draft' or public.is_admin())));
drop policy if exists "kandidat admin" on public.kandidat;
create policy "kandidat admin" on public.kandidat for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Suara bersifat rahasia: publik hanya melihat jumlah (lewat view hasil_pemilu).
drop policy if exists "suara admin" on public.suara;
create policy "suara admin" on public.suara for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.suara from anon, authenticated;

-- Hasil (jumlah suara per kandidat). Berjalan sebagai pemilik view agar bisa menghitung suara rahasia.
create or replace view public.hasil_pemilu as
  select k.pemilu_id, k.id as kandidat_id, count(s.warga_id)::int as suara
  from public.kandidat k
  join public.pemilu p on p.id = k.pemilu_id and p.status <> 'draft'
  left join public.suara s on s.kandidat_id = k.id
  group by k.pemilu_id, k.id;
grant select on public.hasil_pemilu to anon, authenticated;

-- Pejabat aktif: pemenang pemilu terakhir per jabatan.
create or replace view public.pejabat with (security_invoker = true) as
  select distinct on (p.jabatan) p.jabatan, p.id as pemilu_id, k.nama, k.akun, k.warga_id, w.kode, p.selesai
  from public.pemilu p
  join public.kandidat k on k.id = p.pemenang
  left join public.warga w on w.id = k.warga_id
  where p.status = 'selesai'
  order by p.jabatan, coalesce(p.selesai, p.created_at) desc;
grant select on public.pejabat to anon, authenticated;

-- 3) Memberi suara: 1 KTP = 1 suara per pemilu
create or replace function public.vote(p_kode text, p_pin text, p_kandidat uuid) returns json
language plpgsql security definer set search_path = public as $$
declare w public.warga; k public.kandidat; p public.pemilu;
begin
  select * into w from public.warga where kode = upper(trim(p_kode));
  if not found or w.pin <> upper(trim(p_pin)) then raise exception 'Nomor KTP atau PIN salah.'; end if;
  select * into k from public.kandidat where id = p_kandidat;
  if not found then raise exception 'Kandidat tidak ditemukan.'; end if;
  select * into p from public.pemilu where id = k.pemilu_id;
  if p.status <> 'voting' or (p.mulai is not null and now() < p.mulai) or (p.selesai is not null and now() > p.selesai) then
    raise exception 'Voting belum dibuka atau sudah ditutup.';
  end if;
  if p.kecamatan is not null and p.kecamatan <> w.kecamatan then
    raise exception 'Pemilihan ini khusus warga Kec. %.', p.kecamatan;
  end if;
  if p.mulai is not null and w.created_at > p.mulai then
    raise exception 'KTP-mu dibuat setelah voting dibuka. Ikut pemilihan berikutnya, ya!';
  end if;
  insert into public.suara (pemilu_id, warga_id, kandidat_id) values (p.id, w.id, k.id)
    on conflict (pemilu_id, warga_id) do nothing;
  if not found then raise exception 'Kamu sudah memilih di pemilihan ini.'; end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.pilihanku(p_kode text, p_pin text, p_pemilu uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select s.kandidat_id from public.suara s join public.warga w on w.id = s.warga_id
  where s.pemilu_id = p_pemilu and w.kode = upper(trim(p_kode)) and w.pin = upper(trim(p_pin));
$$;

revoke execute on function public.daftar_warga, public.cek_pin, public.vote, public.pilihanku from public;
grant execute on function public.daftar_warga, public.cek_pin, public.vote, public.pilihanku to anon, authenticated;
