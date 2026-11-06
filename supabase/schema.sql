-- SidoarjoVerse: skema database Supabase.
-- Jalankan sekali di Supabase > SQL Editor > New query > tempel > Run.

-- 1) Data kota (bangunan, info, donasi, dll) disimpan sebagai satu JSON.
create table if not exists public.kota (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) Daftar email yang boleh mengedit lewat admin.html
create table if not exists public.admins (
  email text primary key
);

-- 3) KTP warga
create table if not exists public.warga (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null default ('SDA-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))),
  nama text not null check (nama ~ '^[A-Za-z0-9 ._-]{2,20}$'),
  pekerjaan text not null check (char_length(pekerjaan) between 1 and 30),
  gender text not null default '-' check (gender in ('L', 'P', '-')),
  kecamatan text not null check (char_length(kecamatan) between 1 and 30),
  created_at timestamptz not null default now()
);
create index if not exists warga_created_idx on public.warga (created_at desc);
create index if not exists warga_kec_idx on public.warga (kecamatan);

-- Klasemen kecamatan
create or replace view public.klasemen_kecamatan with (security_invoker = true) as
  select kecamatan,
         count(*)::int as total,
         count(*) filter (where created_at > now() - interval '7 days')::int as minggu_ini
  from public.warga
  group by kecamatan;

-- Fungsi bantu: apakah user yang login adalah admin?
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = auth.jwt() ->> 'email');
$$;

-- Row Level Security
alter table public.kota enable row level security;
alter table public.admins enable row level security;
alter table public.warga enable row level security;

drop policy if exists "kota dibaca semua" on public.kota;
create policy "kota dibaca semua" on public.kota for select using (true);
drop policy if exists "kota ditulis admin" on public.kota;
create policy "kota ditulis admin" on public.kota for insert to authenticated with check (public.is_admin());
drop policy if exists "kota diubah admin" on public.kota;
create policy "kota diubah admin" on public.kota for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "warga dibaca semua" on public.warga;
create policy "warga dibaca semua" on public.warga for select using (true);
drop policy if exists "warga daftar" on public.warga;
create policy "warga daftar" on public.warga for insert to anon, authenticated with check (true);
drop policy if exists "warga dihapus admin" on public.warga;
create policy "warga dihapus admin" on public.warga for delete to authenticated using (public.is_admin());

-- Cegah spam: maksimal 30 KTP baru per menit untuk seluruh situs.
create or replace function public.batas_daftar() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.warga where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Pendaftaran sedang ramai, coba lagi sebentar lagi.';
  end if;
  return new;
end $$;
drop trigger if exists warga_batas on public.warga;
create trigger warga_batas before insert on public.warga for each row execute function public.batas_daftar();

-- Baris awal kota (isi data akan ditulis pertama kali saat admin menekan Simpan).
insert into public.kota (id, data) values ('sidoarjo', '{}'::jsonb) on conflict (id) do nothing;

-- GANTI dengan email admin kamu (akun dibuat di Authentication > Users > Add user):
-- insert into public.admins (email) values ('emailkamu@contoh.com');
