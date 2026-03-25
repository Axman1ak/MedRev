-- ============================================================
-- MedRev — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

-- Systems (matières)
create table public.systems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  icon text not null default '📁',
  cal_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- Lessons (fiches)
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  system_id uuid references public.systems on delete cascade not null,
  name text not null,
  learn_date date,
  steps jsonb not null default '[]'::jsonb,  -- array of 14: null | {score, note}
  ai_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Voyage checks
create table public.voyage_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  lesson_id uuid references public.lessons on delete cascade not null,
  passes integer not null default 0 check (passes between 0 and 2),
  unique(user_id, lesson_id)
);

-- ── Row Level Security ────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.systems enable row level security;
alter table public.lessons enable row level security;
alter table public.voyage_checks enable row level security;

-- Profiles: users can only see/edit their own
create policy "Own profile" on public.profiles
  for all using (auth.uid() = id);

-- Systems: users only see their own
create policy "Own systems" on public.systems
  for all using (auth.uid() = user_id);

-- Lessons: users only see their own
create policy "Own lessons" on public.lessons
  for all using (auth.uid() = user_id);

-- Voyage: users only see their own
create policy "Own voyage" on public.voyage_checks
  for all using (auth.uid() = user_id);

-- ── Trigger: auto-create profile on signup ────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Indexes ───────────────────────────────────────────────────
create index on public.systems (user_id);
create index on public.lessons (user_id);
create index on public.lessons (system_id);
create index on public.voyage_checks (user_id);
