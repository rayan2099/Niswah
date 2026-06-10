-- Niswah Supabase production schema
-- Run this in the Supabase SQL editor before deploying the Supabase-backed app.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email_hash text,
  madhhab text not null default 'HANBALI' check (madhhab in ('HANAFI','MALIKI','SHAFII','HANBALI')),
  language text not null default 'ar' check (language in ('en','ar')),
  birth_year integer,
  display_name text,
  anonymous_mode boolean not null default false,
  premium_status boolean not null default true,
  premium_expires_at timestamptz,
  avg_cycle_length integer not null default 28,
  avg_haid_duration integer not null default 5,
  known_adah_days integer,
  adah_confidence integer not null default 0,
  goal_flags jsonb not null default '[]'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  notification_prefs jsonb not null default '{}'::jsonb,
  pregnant boolean not null default false,
  pregnancy_week integer,
  reflect_health boolean not null default false,
  prayer_city text,
  prayer_country text,
  prayer_city_ar text,
  prayer_country_ar text,
  prayer_lat double precision,
  prayer_lon double precision,
  location_lat double precision,
  location_lng double precision,
  location_name text,
  manual_prayer_offsets jsonb not null default '{}'::jsonb,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cycle_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  time_logged timestamptz not null default now(),
  fiqh_state text not null check (fiqh_state in ('HAID','TAHARA','NIFAS','ISTIHADAH')),
  flow_intensity text not null default 'medium' check (flow_intensity in ('none','spotting','light','medium','heavy')),
  blood_color text not null default 'red' check (blood_color in ('red','dark','brown','pink','other')),
  blood_thickness text not null default 'normal' check (blood_thickness in ('thick','thin','normal')),
  kursuf_used boolean not null default false,
  discharge_internal boolean not null default false,
  is_predicted boolean not null default false,
  prediction_confidence numeric not null default 1,
  ramadan_day integer,
  fasting_status text check (fasting_status in ('obligatory','lifted','qadha')),
  symptoms jsonb,
  sleep_quality integer,
  energy_level integer,
  mood integer,
  feeling text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.symptoms_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  cycle_entry_id uuid references public.cycle_entries(id) on delete set null,
  date date not null,
  symptom_type text not null,
  severity integer check (severity between 1 and 5),
  body_location text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_log (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  prayer_name text not null check (prayer_name in ('fajr','dhuhr','asr','maghrib','isha')),
  scheduled_time timestamptz,
  status text not null check (status in ('prayed','qadha_required','lifted','missed')),
  fiqh_state_at_time text,
  period_started_after_prayer_entered boolean,
  notes text
);

create table if not exists public.adah_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  cycle_number integer not null default 0,
  haid_start timestamptz not null,
  haid_end timestamptz,
  haid_duration_hours numeric,
  tuhr_duration_days numeric,
  blood_color_pattern jsonb not null default '[]'::jsonb,
  blood_thickness_pattern jsonb not null default '[]'::jsonb,
  istihadah_episode boolean not null default false,
  scholar_consulted boolean not null default false,
  notes text
);

create table if not exists public.istihadah_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date,
  end_date date,
  madhhab_at_time text,
  tamyiz_applied boolean not null default false,
  blood_distinguishable boolean,
  reverted_to_adah boolean not null default false,
  adah_days_used integer,
  notes text
);

create table if not exists public.nifas_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  birth_date timestamptz not null,
  madhhab_max_days integer check (madhhab_max_days in (40, 60)),
  expected_end date,
  actual_end date,
  breastfeeding_started boolean not null default false,
  notes text
);

create table if not exists public.ramadan_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  hijri_year integer not null,
  total_missed_fasting integer not null default 0,
  qadha_completed integer not null default 0,
  qadha_schedule jsonb not null default '[]'::jsonb
);

create table if not exists public.pregnancy_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  lmp_date date,
  due_date date,
  current_week integer,
  birth_date date,
  nifas_id uuid references public.nifas_records(id) on delete set null,
  weekly_notes jsonb not null default '{}'::jsonb
);

create table if not exists public.secret_vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  encrypted_content text,
  entry_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  chat_type text not null check (chat_type in ('dream','doctor','niswah')),
  role text not null,
  content text not null,
  timestamp timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(content) < 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email_hash,
    display_name,
    madhhab,
    language,
    premium_status,
    created_at,
    updated_at
  )
  values (
    new.id,
    encode(digest(coalesce(new.email, 'anonymous'), 'sha256'), 'hex'),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', 'Sister'),
    'HANBALI',
    'ar',
    true,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists auth_users_create_profile on auth.users;
create trigger auth_users_create_profile
after insert on auth.users
for each row execute function public.create_user_profile();

insert into public.users (
  id,
  email_hash,
  display_name,
  madhhab,
  language,
  premium_status,
  created_at,
  updated_at
)
select
  auth_users.id,
  encode(digest(coalesce(auth_users.email, 'anonymous'), 'sha256'), 'hex'),
  coalesce(auth_users.raw_user_meta_data ->> 'display_name', auth_users.raw_user_meta_data ->> 'full_name', 'Sister'),
  'HANBALI',
  'ar',
  true,
  now(),
  now()
from auth.users auth_users
on conflict (id) do nothing;

create index if not exists cycle_entries_user_date_idx on public.cycle_entries(user_id, date desc, time_logged desc);
create index if not exists adah_ledger_user_cycle_idx on public.adah_ledger(user_id, cycle_number desc);
create index if not exists prayer_log_user_date_idx on public.prayer_log(user_id, date desc);
create index if not exists ramadan_records_user_year_idx on public.ramadan_records(user_id, hijri_year);
create index if not exists chat_history_user_type_ts_idx on public.chat_history(user_id, chat_type, timestamp);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists community_posts_set_updated_at on public.community_posts;
create trigger community_posts_set_updated_at before update on public.community_posts
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.cycle_entries enable row level security;
alter table public.symptoms_log enable row level security;
alter table public.prayer_log enable row level security;
alter table public.adah_ledger enable row level security;
alter table public.istihadah_episodes enable row level security;
alter table public.nifas_records enable row level security;
alter table public.ramadan_records enable row level security;
alter table public.pregnancy_records enable row level security;
alter table public.secret_vault enable row level security;
alter table public.chat_history enable row level security;
alter table public.community_posts enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_access_user(row_user_id uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() = row_user_id or public.is_admin();
$$;

drop policy if exists "users_read_own" on public.users;
create policy "users_read_own" on public.users for select using (public.can_access_user(id));
drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id and role = 'user');
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());
drop policy if exists "users_delete_own" on public.users;
create policy "users_delete_own" on public.users for delete using (auth.uid() = id or public.is_admin());

drop policy if exists "cycle_entries_own" on public.cycle_entries;
create policy "cycle_entries_own" on public.cycle_entries for all using (public.can_access_user(user_id)) with check (auth.uid() = user_id);
drop policy if exists "symptoms_log_own" on public.symptoms_log;
create policy "symptoms_log_own" on public.symptoms_log for all using (public.can_access_user(user_id)) with check (auth.uid() = user_id);
drop policy if exists "prayer_log_own" on public.prayer_log;
create policy "prayer_log_own" on public.prayer_log for all using (public.can_access_user(user_id)) with check (auth.uid() = user_id);
drop policy if exists "adah_ledger_own" on public.adah_ledger;
create policy "adah_ledger_own" on public.adah_ledger for all using (public.can_access_user(user_id)) with check (auth.uid() = user_id);
drop policy if exists "istihadah_episodes_own" on public.istihadah_episodes;
create policy "istihadah_episodes_own" on public.istihadah_episodes for all using (public.can_access_user(user_id)) with check (auth.uid() = user_id);
drop policy if exists "nifas_records_own" on public.nifas_records;
create policy "nifas_records_own" on public.nifas_records for all using (public.can_access_user(user_id)) with check (auth.uid() = user_id);
drop policy if exists "ramadan_records_own" on public.ramadan_records;
create policy "ramadan_records_own" on public.ramadan_records for all using (public.can_access_user(user_id)) with check (auth.uid() = user_id);
drop policy if exists "pregnancy_records_own" on public.pregnancy_records;
create policy "pregnancy_records_own" on public.pregnancy_records for all using (public.can_access_user(user_id)) with check (auth.uid() = user_id);
drop policy if exists "secret_vault_own" on public.secret_vault;
create policy "secret_vault_own" on public.secret_vault for all using (public.can_access_user(user_id)) with check (auth.uid() = user_id);
drop policy if exists "chat_history_own" on public.chat_history;
create policy "chat_history_own" on public.chat_history for all using (public.can_access_user(user_id)) with check (auth.uid() = user_id);

drop policy if exists "community_posts_read_auth" on public.community_posts;
create policy "community_posts_read_auth" on public.community_posts for select using (auth.role() = 'authenticated');
drop policy if exists "community_posts_insert_own" on public.community_posts;
create policy "community_posts_insert_own" on public.community_posts for insert with check (auth.uid() = author_id);
drop policy if exists "community_posts_update_own" on public.community_posts;
create policy "community_posts_update_own" on public.community_posts for update using (auth.uid() = author_id or public.is_admin()) with check (auth.uid() = author_id or public.is_admin());
drop policy if exists "community_posts_delete_own" on public.community_posts;
create policy "community_posts_delete_own" on public.community_posts for delete using (auth.uid() = author_id or public.is_admin());

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_my_account() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'users') then
    alter publication supabase_realtime add table public.users;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cycle_entries') then
    alter publication supabase_realtime add table public.cycle_entries;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'adah_ledger') then
    alter publication supabase_realtime add table public.adah_ledger;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prayer_log') then
    alter publication supabase_realtime add table public.prayer_log;
  end if;
end $$;
