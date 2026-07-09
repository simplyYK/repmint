-- RepMint rebuild — 0001_schema.sql
-- Core tables, enums, and indexes. RLS is added in 0002_rls.sql.
-- Views + bootstrap triggers are added in 0003_views_triggers.sql.

create extension if not exists "pgcrypto";
create schema if not exists extensions;
create extension if not exists "citext" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.experience_level as enum ('beginner', 'intermediate', 'advanced');
create type public.units_pref as enum ('kg', 'lb');
create type public.exercise_difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.load_type as enum ('bodyweight', 'external', 'both');
create type public.template_source as enum ('user', 'ai', 'system');
create type public.plan_source as enum ('ai', 'user');
create type public.plan_status as enum ('active', 'archived', 'completed');
create type public.session_status as enum ('active', 'completed', 'discarded');
create type public.weight_unit as enum ('kg', 'lb');
create type public.coach_role as enum ('user', 'assistant');
create type public.friendship_status as enum ('pending', 'accepted');
create type public.share_visibility as enum ('friends', 'public');

-- ---------------------------------------------------------------------------
-- profiles — identity root is auth.users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username extensions.citext unique,
  display_name text,
  avatar_url text,
  goal text,
  experience_level public.experience_level not null default 'beginner',
  equipment text[] not null default '{}',
  is_public boolean not null default false,
  units public.units_pref not null default 'kg',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- exercises — global read-only bank (seeded separately from TS registry)
-- ---------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  aliases text[] not null default '{}',
  category text,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  difficulty public.exercise_difficulty not null default 'beginner',
  tier smallint not null default 3 check (tier in (1, 2, 3)),
  load_type public.load_type not null default 'bodyweight',
  instructions jsonb not null default '[]'::jsonb,
  form_points jsonb not null default '[]'::jsonb,
  common_mistakes jsonb not null default '[]'::jsonb,
  rom_guideline text,
  tut_target int4range,
  tracking jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workout_templates / template_exercises
-- ---------------------------------------------------------------------------

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  source public.template_source not null default 'user',
  goal text,
  est_duration_min smallint,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  position smallint not null default 1,
  exercise_slug text not null references public.exercises(slug) on delete restrict,
  sets smallint not null default 3 check (sets >= 1),
  target_reps smallint,
  target_seconds smallint,
  target_weight numeric,
  rest_seconds smallint not null default 60 check (rest_seconds >= 0),
  superset_group smallint,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- plans / plan_days
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal text,
  weeks smallint not null default 4 check (weeks between 1 and 52),
  source public.plan_source not null default 'user',
  model_used text,
  status public.plan_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  day_index smallint not null,
  weekday smallint check (weekday between 0 and 6),
  template_id uuid references public.workout_templates(id) on delete set null,
  title text,
  focus text,
  is_rest boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sessions / session_sets — this IS the calendar
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null,
  plan_day_id uuid references public.plan_days(id) on delete set null,
  title text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status public.session_status not null default 'active',
  total_reps integer not null default 0 check (total_reps >= 0),
  total_sets integer not null default 0 check (total_sets >= 0),
  active_seconds integer not null default 0 check (active_seconds >= 0),
  avg_form_score numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  exercise_slug text not null references public.exercises(slug) on delete restrict,
  set_index smallint not null default 1,
  reps integer,
  seconds integer,
  weight numeric,
  weight_unit public.weight_unit not null default 'kg',
  is_bodyweight boolean not null default true,
  avg_form_score numeric,
  rom_score numeric,
  tut_seconds numeric,
  top_cues jsonb not null default '[]'::jsonb,
  rep_metrics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- coach_messages / user_settings
-- ---------------------------------------------------------------------------

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  role public.coach_role not null,
  content text not null,
  model text,
  created_at timestamptz not null default now()
);

create table public.user_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  ai_model text not null default 'google/gemini-2.5-flash',
  ai_instructions_override text,
  coach_voice text not null default 'Supportive',
  audio_cues boolean not null default false,
  haptics boolean not null default true,
  rest_timer_default integer not null default 60 check (rest_timer_default >= 0)
);

-- ---------------------------------------------------------------------------
-- Social scaffold (tables + RLS now, UI later)
-- ---------------------------------------------------------------------------

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint friendships_no_self check (user_id <> friend_id),
  constraint friendships_unique_pair unique (user_id, friend_id)
);

create table public.shared_workouts (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  visibility public.share_visibility not null default 'friends',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes — every FK + owner_id
-- ---------------------------------------------------------------------------

create index idx_exercises_slug on public.exercises(slug);
create index idx_exercises_tier on public.exercises(tier);

create index idx_workout_templates_owner_id on public.workout_templates(owner_id);
create index idx_workout_templates_is_public on public.workout_templates(is_public);

create index idx_template_exercises_template_id on public.template_exercises(template_id);
create index idx_template_exercises_exercise_slug on public.template_exercises(exercise_slug);

create index idx_plans_owner_id on public.plans(owner_id);
create index idx_plans_status on public.plans(status);

create index idx_plan_days_plan_id on public.plan_days(plan_id);
create index idx_plan_days_template_id on public.plan_days(template_id);

create index idx_sessions_owner_id on public.sessions(owner_id);
create index idx_sessions_template_id on public.sessions(template_id);
create index idx_sessions_plan_day_id on public.sessions(plan_day_id);
create index idx_sessions_owner_started_at on public.sessions(owner_id, started_at desc);

create index idx_session_sets_session_id on public.session_sets(session_id);
create index idx_session_sets_owner_id on public.session_sets(owner_id);
create index idx_session_sets_exercise_slug on public.session_sets(exercise_slug);
create index idx_session_sets_owner_exercise on public.session_sets(owner_id, exercise_slug, created_at desc);

create index idx_coach_messages_owner_id on public.coach_messages(owner_id);
create index idx_coach_messages_session_id on public.coach_messages(session_id);
create index idx_coach_messages_owner_created_at on public.coach_messages(owner_id, created_at desc);

create index idx_friendships_user_id on public.friendships(user_id);
create index idx_friendships_friend_id on public.friendships(friend_id);
create index idx_friendships_status on public.friendships(status);

create index idx_shared_workouts_template_id on public.shared_workouts(template_id);
create index idx_shared_workouts_owner_id on public.shared_workouts(owner_id);
