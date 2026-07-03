-- RepMint Supabase backend
-- Run this in Supabase SQL editor or with: supabase db push
-- Auth is handled by Supabase Auth. This schema stores all app data by auth user.

create extension if not exists "pgcrypto";

create type public.experience_level as enum ('beginner', 'intermediate', 'advanced');
create type public.training_goal as enum (
  'strength_foundation',
  'muscle_building',
  'mobility_flow',
  'consistency',
  'return_to_gym_confidence',
  'technique_practice'
);
create type public.equipment_type as enum ('bodyweight', 'dumbbells', 'bands', 'kettlebell', 'bench', 'full_gym');
create type public.coaching_intensity as enum ('minimal', 'standard', 'active');
create type public.plan_status as enum ('draft', 'active', 'paused', 'completed', 'archived');
create type public.session_status as enum ('planned', 'in_progress', 'completed', 'skipped', 'abandoned');
create type public.block_type as enum ('warmup', 'main', 'superset', 'circuit', 'finisher', 'mobility');
create type public.movement_category as enum ('squat', 'lunge', 'push_up', 'hinge', 'plank', 'mobility_drill', 'other');
create type public.recommendation_status as enum ('new', 'seen', 'accepted', 'dismissed', 'completed');
create type public.agent_run_status as enum ('queued', 'running', 'succeeded', 'failed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  experience_level public.experience_level not null default 'beginner',
  primary_goal public.training_goal not null default 'strength_foundation',
  secondary_goals public.training_goal[] not null default '{}',
  available_equipment public.equipment_type[] not null default '{bodyweight}',
  workouts_per_week smallint not null default 3 check (workouts_per_week between 1 and 7),
  session_minutes smallint not null default 25 check (session_minutes between 5 and 180),
  coaching_intensity public.coaching_intensity not null default 'standard',
  movement_preferences jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  voice_feedback boolean not null default false,
  haptics_enabled boolean not null default true,
  sound_effects_enabled boolean not null default true,
  camera_side text not null default 'auto' check (camera_side in ('auto', 'front', 'back', 'webcam')),
  mirror_camera boolean not null default true,
  store_training_media boolean not null default false,
  ai_memory_enabled boolean not null default true,
  privacy_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.camera_calibrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_label text,
  camera_position text,
  room_notes text,
  calibration_data jsonb not null default '{}'::jsonb,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.movement_profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category public.movement_category not null,
  is_active boolean not null default true,
  supported_in_prototype boolean not null default true,
  landmarks jsonb not null default '{}'::jsonb,
  phase_rules jsonb not null default '{}'::jsonb,
  rep_rules jsonb not null default '{}'::jsonb,
  tempo_targets jsonb not null default '{}'::jsonb,
  cue_library jsonb not null default '[]'::jsonb,
  camera_guidance jsonb not null default '{}'::jsonb,
  summary_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  movement_profile_id uuid references public.movement_profiles(id) on delete set null,
  slug text not null unique,
  name text not null,
  category public.movement_category not null,
  equipment public.equipment_type[] not null default '{bodyweight}',
  default_tempo text,
  default_target_reps smallint,
  default_target_seconds smallint,
  coaching_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  goal public.training_goal not null,
  status public.plan_status not null default 'draft',
  start_date date,
  end_date date,
  weeks_count smallint not null default 4 check (weeks_count between 1 and 52),
  current_week smallint not null default 1 check (current_week >= 1),
  sessions_per_week smallint not null default 3 check (sessions_per_week between 1 and 7),
  source text not null default 'ai' check (source in ('ai', 'template', 'manual')),
  progression_rules jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  week_number smallint not null check (week_number >= 1),
  day_number smallint not null check (day_number between 1 and 7),
  name text not null,
  estimated_minutes smallint not null default 25 check (estimated_minutes between 1 and 240),
  focus text,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, week_number, day_number, sort_order)
);

create table public.workout_blocks (
  id uuid primary key default gen_random_uuid(),
  plan_workout_id uuid references public.plan_workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  block_type public.block_type not null default 'main',
  name text not null,
  rounds smallint not null default 1 check (rounds >= 1),
  rest_seconds smallint not null default 60 check (rest_seconds >= 0),
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.block_exercises (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.workout_blocks(id) on delete cascade,
  exercise_id uuid references public.exercise_library(id) on delete set null,
  movement_profile_id uuid references public.movement_profiles(id) on delete set null,
  name text not null,
  target_sets smallint not null default 3 check (target_sets >= 1),
  target_reps smallint check (target_reps >= 1),
  target_seconds smallint check (target_seconds >= 1),
  target_tut_seconds smallint check (target_tut_seconds >= 1),
  tempo text,
  load_prescription text,
  superset_group text,
  sort_order smallint not null default 1,
  coaching_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.training_plans(id) on delete set null,
  plan_workout_id uuid references public.plan_workouts(id) on delete set null,
  name text not null,
  status public.session_status not null default 'planned',
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  active_seconds integer not null default 0 check (active_seconds >= 0),
  total_reps integer not null default 0 check (total_reps >= 0),
  total_sets integer not null default 0 check (total_sets >= 0),
  avg_tempo_seconds numeric(6,2),
  avg_tut_seconds numeric(8,2),
  recurring_cues text[] not null default '{}',
  user_notes text,
  ai_summary text,
  sample_output boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.set_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  block_exercise_id uuid references public.block_exercises(id) on delete set null,
  movement_profile_id uuid references public.movement_profiles(id) on delete set null,
  exercise_name text not null,
  set_number smallint not null check (set_number >= 1),
  target_reps smallint,
  reps_count smallint not null default 0 check (reps_count >= 0),
  target_seconds smallint,
  duration_seconds numeric(8,2) not null default 0 check (duration_seconds >= 0),
  tut_seconds numeric(8,2) not null default 0 check (tut_seconds >= 0),
  avg_rep_seconds numeric(6,2),
  tempo text,
  tempo_data jsonb not null default '{}'::jsonb,
  range_signal text,
  control_signal text,
  stability_signal text,
  cues_triggered text[] not null default '{}',
  next_focus text,
  tracker_version text,
  tracker_payload jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, exercise_name, set_number)
);

create table public.rep_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  set_result_id uuid not null references public.set_results(id) on delete cascade,
  rep_number smallint not null check (rep_number >= 1),
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds numeric(6,2),
  tut_seconds numeric(6,2),
  eccentric_seconds numeric(6,2),
  pause_seconds numeric(6,2),
  concentric_seconds numeric(6,2),
  range_signal text,
  control_signal text,
  cue text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (set_result_id, rep_number)
);

create table public.form_signal_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  set_result_id uuid not null references public.set_results(id) on delete cascade,
  movement_profile_id uuid references public.movement_profiles(id) on delete set null,
  signal_name text not null,
  signal_value text,
  severity smallint check (severity between 0 and 3),
  observed_count smallint not null default 1 check (observed_count >= 0),
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.daily_hub_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null default current_date,
  recommended_plan_id uuid references public.training_plans(id) on delete set null,
  recommended_session_id uuid references public.plan_workouts(id) on delete set null,
  streak_days integer not null default 0 check (streak_days >= 0),
  sessions_completed integer not null default 0 check (sessions_completed >= 0),
  active_minutes integer not null default 0 check (active_minutes >= 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Coach chat',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  run_type text not null default 'coach_chat',
  model text not null,
  status public.agent_run_status not null default 'queued',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent_run_id uuid references public.ai_agent_runs(id) on delete set null,
  plan_id uuid references public.training_plans(id) on delete set null,
  session_id uuid references public.workout_sessions(id) on delete set null,
  movement_profile_id uuid references public.movement_profiles(id) on delete set null,
  title text not null,
  recommendation text not null,
  reason text not null,
  action_label text,
  status public.recommendation_status not null default 'new',
  priority smallint not null default 1 check (priority between 1 and 3),
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.workout_sessions(id) on delete cascade,
  set_result_id uuid references public.set_results(id) on delete cascade,
  storage_bucket text not null default 'training-media',
  storage_path text not null,
  media_type text not null check (media_type in ('image', 'video', 'pose_json')),
  purpose text not null default 'set_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index profiles_primary_goal_idx on public.profiles(primary_goal);
create index training_plans_user_status_idx on public.training_plans(user_id, status);
create index plan_workouts_plan_week_idx on public.plan_workouts(plan_id, week_number, day_number);
create index workout_sessions_user_completed_idx on public.workout_sessions(user_id, completed_at desc);
create index workout_sessions_user_status_idx on public.workout_sessions(user_id, status);
create index set_results_user_completed_idx on public.set_results(user_id, completed_at desc);
create index set_results_session_idx on public.set_results(session_id);
create index rep_events_set_idx on public.rep_events(set_result_id, rep_number);
create index form_signal_summaries_set_idx on public.form_signal_summaries(set_result_id);
create index ai_messages_conversation_idx on public.ai_messages(conversation_id, created_at);
create index ai_recommendations_user_status_idx on public.ai_recommendations(user_id, status, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings
for each row execute function public.set_updated_at();
create trigger camera_calibrations_set_updated_at before update on public.camera_calibrations
for each row execute function public.set_updated_at();
create trigger movement_profiles_set_updated_at before update on public.movement_profiles
for each row execute function public.set_updated_at();
create trigger exercise_library_set_updated_at before update on public.exercise_library
for each row execute function public.set_updated_at();
create trigger training_plans_set_updated_at before update on public.training_plans
for each row execute function public.set_updated_at();
create trigger plan_workouts_set_updated_at before update on public.plan_workouts
for each row execute function public.set_updated_at();
create trigger workout_blocks_set_updated_at before update on public.workout_blocks
for each row execute function public.set_updated_at();
create trigger block_exercises_set_updated_at before update on public.block_exercises
for each row execute function public.set_updated_at();
create trigger workout_sessions_set_updated_at before update on public.workout_sessions
for each row execute function public.set_updated_at();
create trigger set_results_set_updated_at before update on public.set_results
for each row execute function public.set_updated_at();
create trigger ai_conversations_set_updated_at before update on public.ai_conversations
for each row execute function public.set_updated_at();
create trigger ai_recommendations_set_updated_at before update on public.ai_recommendations
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.refresh_session_totals(target_session_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.workout_sessions ws
  set
    total_sets = coalesce(s.total_sets, 0),
    total_reps = coalesce(s.total_reps, 0),
    active_seconds = coalesce(s.active_seconds, 0),
    avg_tut_seconds = s.avg_tut_seconds,
    avg_tempo_seconds = s.avg_rep_seconds
  from (
    select
      session_id,
      count(*)::integer as total_sets,
      sum(reps_count)::integer as total_reps,
      round(sum(duration_seconds))::integer as active_seconds,
      round(avg(nullif(tut_seconds, 0)), 2) as avg_tut_seconds,
      round(avg(nullif(avg_rep_seconds, 0)), 2) as avg_rep_seconds
    from public.set_results
    where session_id = target_session_id
  ) s
  where ws.id = target_session_id;
end;
$$;

create or replace function public.refresh_session_totals_from_set()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_session_totals(coalesce(new.session_id, old.session_id));
  return coalesce(new, old);
end;
$$;

create trigger set_results_refresh_session_totals
after insert or update or delete on public.set_results
for each row execute function public.refresh_session_totals_from_set();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.camera_calibrations enable row level security;
alter table public.movement_profiles enable row level security;
alter table public.exercise_library enable row level security;
alter table public.training_plans enable row level security;
alter table public.plan_workouts enable row level security;
alter table public.workout_blocks enable row level security;
alter table public.block_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_results enable row level security;
alter table public.rep_events enable row level security;
alter table public.form_signal_summaries enable row level security;
alter table public.daily_hub_snapshots enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_agent_runs enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.training_media enable row level security;

create policy "profiles are owned by user" on public.profiles
for all using (id = auth.uid()) with check (id = auth.uid());

create policy "settings are owned by user" on public.user_settings
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "camera calibrations are owned by user" on public.camera_calibrations
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "movement profiles are readable" on public.movement_profiles
for select using (true);

create policy "exercise library is readable" on public.exercise_library
for select using (true);

create policy "training plans are owned by user" on public.training_plans
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "plan workouts follow owned plan" on public.plan_workouts
for all using (
  exists (
    select 1 from public.training_plans p
    where p.id = plan_workouts.plan_id and p.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.training_plans p
    where p.id = plan_workouts.plan_id and p.user_id = auth.uid()
  )
);

create policy "workout blocks are owned by user" on public.workout_blocks
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "block exercises follow owned block" on public.block_exercises
for all using (
  exists (
    select 1 from public.workout_blocks b
    where b.id = block_exercises.block_id and b.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.workout_blocks b
    where b.id = block_exercises.block_id and b.user_id = auth.uid()
  )
);

create policy "workout sessions are owned by user" on public.workout_sessions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "set results are owned by user" on public.set_results
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "rep events are owned by user" on public.rep_events
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "form summaries are owned by user" on public.form_signal_summaries
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "daily hub snapshots are owned by user" on public.daily_hub_snapshots
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ai conversations are owned by user" on public.ai_conversations
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ai messages are owned by user" on public.ai_messages
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ai agent runs are owned by user" on public.ai_agent_runs
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ai recommendations are owned by user" on public.ai_recommendations
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "training media rows are owned by user" on public.training_media
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.movement_profiles
  (slug, name, category, landmarks, phase_rules, rep_rules, tempo_targets, cue_library, camera_guidance, summary_rules)
values
  (
    'bodyweight-squat',
    'Bodyweight Squat',
    'squat',
    '{"primary":["hips","knees","ankles","shoulders"],"side_view_optional":true}'::jsonb,
    '{"phases":["standing","descent","bottom","ascent"],"prototype_thresholds":{"hip_drop":"configurable","knee_tracking":"configurable"}}'::jsonb,
    '{"complete_when":"standing_after_bottom","min_depth_source":"movement_profile_config"}'::jsonb,
    '{"default":"3-1-2-0","tut_seconds_per_rep_min":4}'::jsonb,
    '["Keep the descent controlled","Stand tall before the next rep","Keep pressure through the whole foot"]'::jsonb,
    '{"framing":"Full body visible from head to feet","distance":"Step back until ankles and shoulders are visible"}'::jsonb,
    '{"focus":["tempo","range","control"],"claim_safety":"coaching_feedback_only"}'::jsonb
  ),
  (
    'reverse-lunge',
    'Reverse Lunge',
    'lunge',
    '{"primary":["hips","knees","ankles"],"side_view_optional":true}'::jsonb,
    '{"phases":["standing","step_back","bottom","return"]}'::jsonb,
    '{"complete_when":"return_to_standing"}'::jsonb,
    '{"default":"2-1-2-0","tut_seconds_per_rep_min":3}'::jsonb,
    '["Step back with control","Stack ribs over hips","Finish tall before switching sides"]'::jsonb,
    '{"framing":"Full body visible with room behind you"}'::jsonb,
    '{"focus":["balance","tempo","range"],"claim_safety":"coaching_feedback_only"}'::jsonb
  ),
  (
    'strict-push-up',
    'Strict Push-up',
    'push_up',
    '{"primary":["shoulders","elbows","wrists","hips"],"side_view_recommended":true}'::jsonb,
    '{"phases":["top","lowering","bottom","pressing"]}'::jsonb,
    '{"complete_when":"top_after_bottom"}'::jsonb,
    '{"default":"2-1-1-0","tut_seconds_per_rep_min":3}'::jsonb,
    '["Move as one line","Pause briefly with control","Press the floor away"]'::jsonb,
    '{"framing":"Side view with shoulders, hips, and ankles visible"}'::jsonb,
    '{"focus":["tempo","line","control"],"claim_safety":"coaching_feedback_only"}'::jsonb
  ),
  (
    'hip-hinge',
    'Hip Hinge',
    'hinge',
    '{"primary":["hips","shoulders","knees","ankles"],"side_view_recommended":true}'::jsonb,
    '{"phases":["standing","hinge_back","bottom","stand"]}'::jsonb,
    '{"complete_when":"standing_after_hinge"}'::jsonb,
    '{"default":"3-1-2-0","tut_seconds_per_rep_min":4}'::jsonb,
    '["Push hips back","Keep the movement smooth","Stand tall with control"]'::jsonb,
    '{"framing":"Side view from head to feet"}'::jsonb,
    '{"focus":["hip_pattern","tempo","control"],"claim_safety":"coaching_feedback_only"}'::jsonb
  ),
  (
    'front-plank',
    'Front Plank',
    'plank',
    '{"primary":["shoulders","hips","ankles"],"side_view_recommended":true}'::jsonb,
    '{"phases":["hold"],"timer_based":true}'::jsonb,
    '{"complete_when":"target_time_elapsed","rep_count_mode":"hold"}'::jsonb,
    '{"default":"hold","target_seconds":30}'::jsonb,
    '["Hold a steady line","Breathe through the hold","Keep the timer honest"]'::jsonb,
    '{"framing":"Side view with shoulders, hips, and ankles visible"}'::jsonb,
    '{"focus":["hold_time","position_changes","control"],"claim_safety":"coaching_feedback_only"}'::jsonb
  ),
  (
    'mobility-flow',
    'Mobility Flow',
    'mobility_drill',
    '{"primary":["movement_specific"],"side_view_optional":true}'::jsonb,
    '{"phases":["start","flow","finish"],"timer_based":true}'::jsonb,
    '{"complete_when":"target_time_elapsed","rep_count_mode":"optional"}'::jsonb,
    '{"default":"smooth","target_seconds":45}'::jsonb,
    '["Move slowly enough to notice control","Use a range you can repeat","Keep the breath steady"]'::jsonb,
    '{"framing":"Show the full working position"}'::jsonb,
    '{"focus":["consistency","control","time"],"claim_safety":"coaching_feedback_only"}'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  landmarks = excluded.landmarks,
  phase_rules = excluded.phase_rules,
  rep_rules = excluded.rep_rules,
  tempo_targets = excluded.tempo_targets,
  cue_library = excluded.cue_library,
  camera_guidance = excluded.camera_guidance,
  summary_rules = excluded.summary_rules,
  updated_at = now();

insert into public.exercise_library
  (movement_profile_id, slug, name, category, equipment, default_tempo, default_target_reps, default_target_seconds, coaching_notes)
select id, 'bodyweight-squat', 'Bodyweight Squat', 'squat', '{bodyweight}', '3-1-2-0', 10, null, 'Starter squat pattern for camera-based rep counting.'
from public.movement_profiles where slug = 'bodyweight-squat'
on conflict (slug) do nothing;

insert into public.exercise_library
  (movement_profile_id, slug, name, category, equipment, default_tempo, default_target_reps, default_target_seconds, coaching_notes)
select id, 'reverse-lunge', 'Reverse Lunge', 'lunge', '{bodyweight,dumbbells}', '2-1-2-0', 8, null, 'Single-leg pattern with side-to-side history support.'
from public.movement_profiles where slug = 'reverse-lunge'
on conflict (slug) do nothing;

insert into public.exercise_library
  (movement_profile_id, slug, name, category, equipment, default_tempo, default_target_reps, default_target_seconds, coaching_notes)
select id, 'strict-push-up', 'Strict Push-up', 'push_up', '{bodyweight}', '2-1-1-0', 8, null, 'Upper-body bodyweight press with tempo and line cues.'
from public.movement_profiles where slug = 'strict-push-up'
on conflict (slug) do nothing;

insert into public.exercise_library
  (movement_profile_id, slug, name, category, equipment, default_tempo, default_target_reps, default_target_seconds, coaching_notes)
select id, 'hip-hinge', 'Hip Hinge', 'hinge', '{bodyweight,dumbbells,kettlebell,full_gym}', '3-1-2-0', 10, null, 'Hinge practice that can support dumbbell and gym variations later.'
from public.movement_profiles where slug = 'hip-hinge'
on conflict (slug) do nothing;

insert into public.exercise_library
  (movement_profile_id, slug, name, category, equipment, default_tempo, default_target_reps, default_target_seconds, coaching_notes)
select id, 'front-plank', 'Front Plank', 'plank', '{bodyweight}', null, null, 30, 'Timer-based hold tracked by duration and position changes.'
from public.movement_profiles where slug = 'front-plank'
on conflict (slug) do nothing;

insert into public.exercise_library
  (movement_profile_id, slug, name, category, equipment, default_tempo, default_target_reps, default_target_seconds, coaching_notes)
select id, 'mobility-flow', 'Mobility Flow', 'mobility_drill', '{bodyweight}', null, null, 45, 'General mobility block for warmups and recovery-style sessions.'
from public.movement_profiles where slug = 'mobility-flow'
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'training-media',
  'training-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/json']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "users can read own training media objects" on storage.objects
for select using (
  bucket_id = 'training-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users can upload own training media objects" on storage.objects
for insert with check (
  bucket_id = 'training-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users can update own training media objects" on storage.objects
for update using (
  bucket_id = 'training-media'
  and auth.uid()::text = (storage.foldername(name))[1]
) with check (
  bucket_id = 'training-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users can delete own training media objects" on storage.objects
for delete using (
  bucket_id = 'training-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);
