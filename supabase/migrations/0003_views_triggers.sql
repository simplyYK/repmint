-- RepMint rebuild — 0003_views_triggers.sql
-- Bootstrap trigger (auth.users -> profiles + user_settings) and
-- security_invoker views for calendar/progress/weekly stats.

-- ---------------------------------------------------------------------------
-- Bootstrap trigger: on auth.users insert -> create profiles + user_settings
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Lock down: only the trigger (which runs as the table owner) should invoke
-- this function. Prevent anon/authenticated from calling it directly via RPC.
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_user() from public;

-- ---------------------------------------------------------------------------
-- v_calendar_days — sessions per day (owner-scoped via security_invoker so
-- the caller's RLS on public.sessions applies).
-- ---------------------------------------------------------------------------

create view public.v_calendar_days
with (security_invoker = on) as
select
  owner_id,
  (started_at at time zone 'UTC')::date as day,
  count(*) as session_count,
  sum(total_reps) as total_reps,
  sum(total_sets) as total_sets,
  sum(active_seconds) as active_seconds,
  avg(avg_form_score) as avg_form_score
from public.sessions
where status = 'completed'
group by owner_id, (started_at at time zone 'UTC')::date;

-- ---------------------------------------------------------------------------
-- v_exercise_progress — per exercise: date, max weight, total reps, avg form
-- ---------------------------------------------------------------------------

create view public.v_exercise_progress
with (security_invoker = on) as
select
  ss.owner_id,
  ss.exercise_slug,
  (ss.created_at at time zone 'UTC')::date as day,
  max(ss.weight) as max_weight,
  sum(ss.reps) as total_reps,
  avg(ss.avg_form_score) as avg_form_score,
  avg(ss.rom_score) as avg_rom_score,
  sum(ss.tut_seconds) as total_tut_seconds
from public.session_sets ss
group by ss.owner_id, ss.exercise_slug, (ss.created_at at time zone 'UTC')::date;

-- ---------------------------------------------------------------------------
-- v_weekly_stats — rolled up per owner per ISO week
-- ---------------------------------------------------------------------------

create view public.v_weekly_stats
with (security_invoker = on) as
select
  owner_id,
  date_trunc('week', started_at at time zone 'UTC')::date as week_start,
  count(*) as session_count,
  sum(total_reps) as total_reps,
  sum(total_sets) as total_sets,
  sum(active_seconds) as active_seconds,
  avg(avg_form_score) as avg_form_score
from public.sessions
where status = 'completed'
group by owner_id, date_trunc('week', started_at at time zone 'UTC')::date;
