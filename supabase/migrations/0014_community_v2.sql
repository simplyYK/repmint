-- 0014 — Community v2: friend-scoped sharing, profile stats, multi-metric
-- challenges.
--
-- 1. SHARING IS FOR FRIENDS, NOT THE WORLD. The original
--    workout_templates_select policy exposed every is_public template to every
--    authenticated user — sharing with one friend showed the workout to
--    strangers too. Shared templates are now visible only to the owner's
--    ACCEPTED friends (system templates, owner null, stay global).
-- 2. Saved copies carry attribution in a real column (saved_from_username)
--    instead of a title suffix, so the UI can group "Saved from friends".
-- 3. friend_profile_stats(): privacy-safe training aggregates for a friend's
--    profile page. SECURITY DEFINER with an explicit friendship guard — raw
--    sessions stay owner-private.
-- 4. Challenges can race on 1-4 metrics at once (challenges.metrics), and
--    challenge_scores() returns every aggregate per participant so the
--    leaderboard can rank on a combined score.

-- ---------------------------------------------------------------------------
-- Friendship helper: used by RLS policies and RPC guards.
-- SECURITY DEFINER so policies on other tables don't depend on friendships RLS.
-- ---------------------------------------------------------------------------

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = a and f.friend_id = b) or (f.user_id = b and f.friend_id = a))
  );
$$;

revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Friend-scoped template visibility.
-- ---------------------------------------------------------------------------

drop policy if exists "workout_templates_select_own_or_public" on public.workout_templates;
create policy "workout_templates_select_visible" on public.workout_templates
for select to authenticated
using (
  owner_id = (select auth.uid())
  or owner_id is null
  or (is_public = true and public.are_friends((select auth.uid()), owner_id))
);

drop policy if exists "template_exercises_select" on public.template_exercises;
create policy "template_exercises_select" on public.template_exercises
for select to authenticated
using (
  exists (
    select 1 from public.workout_templates t
    where t.id = template_exercises.template_id
      and (
        t.owner_id = (select auth.uid())
        or t.owner_id is null
        or (t.is_public = true and public.are_friends((select auth.uid()), t.owner_id))
      )
  )
);

-- ---------------------------------------------------------------------------
-- Saved-from-friend attribution.
-- ---------------------------------------------------------------------------

alter table public.workout_templates
  add column if not exists saved_from_username text;

-- Backfill copies that carried the old " — from @user" title suffix.
update public.workout_templates
set saved_from_username = substring(title from ' — from @(.+)$'),
    title = regexp_replace(title, ' — from @.+$', '')
where title like '% — from @%';

-- ---------------------------------------------------------------------------
-- Friend profile stats (privacy-safe aggregates only).
-- ---------------------------------------------------------------------------

create or replace function public.friend_profile_stats(fid uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if auth.uid() <> fid and not public.are_friends(auth.uid(), fid) then
    raise exception 'you can only view stats of accepted friends';
  end if;

  select jsonb_build_object(
    'total_sessions', (
      select count(*) from public.sessions s
      where s.owner_id = fid and s.status = 'completed'
    ),
    'sessions_7d', (
      select count(*) from public.sessions s
      where s.owner_id = fid and s.status = 'completed'
        and s.started_at >= now() - interval '7 days'
    ),
    'sessions_28d', (
      select count(*) from public.sessions s
      where s.owner_id = fid and s.status = 'completed'
        and s.started_at >= now() - interval '28 days'
    ),
    'reps_28d', (
      select coalesce(sum(s.total_reps), 0) from public.sessions s
      where s.owner_id = fid and s.status = 'completed'
        and s.started_at >= now() - interval '28 days'
    ),
    'minutes_28d', (
      select coalesce(round(sum(s.active_seconds) / 60.0), 0) from public.sessions s
      where s.owner_id = fid and s.status = 'completed'
        and s.started_at >= now() - interval '28 days'
    ),
    'active_days_28d', (
      select count(distinct date_trunc('day', s.started_at)) from public.sessions s
      where s.owner_id = fid and s.status = 'completed'
        and s.started_at >= now() - interval '28 days'
    ),
    'last_trained_at', (
      select max(s.started_at) from public.sessions s
      where s.owner_id = fid and s.status = 'completed'
    ),
    'top_exercises', (
      select coalesce(jsonb_agg(jsonb_build_object('slug', x.slug, 'sets', x.sets)), '[]'::jsonb)
      from (
        select ss.exercise_slug as slug, count(*) as sets
        from public.session_sets ss
        join public.sessions s on s.id = ss.session_id
        where s.owner_id = fid and s.status = 'completed'
          and s.started_at >= now() - interval '28 days'
        group by ss.exercise_slug
        order by count(*) desc
        limit 3
      ) x
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.friend_profile_stats(uuid) from public;
grant execute on function public.friend_profile_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Multi-metric challenges.
-- ---------------------------------------------------------------------------

alter table public.challenges
  add column if not exists metrics text[] not null default array['sessions'];

-- Backfill: single legacy metric becomes the metrics array.
update public.challenges set metrics = array[metric] where metrics = array['sessions'] and metric <> 'sessions';

alter table public.challenges drop constraint if exists challenges_metrics_valid;
alter table public.challenges add constraint challenges_metrics_valid check (
  array_length(metrics, 1) between 1 and 4
  and metrics <@ array['sessions', 'total_reps', 'total_sets', 'active_minutes']
);

-- Per-participant aggregates for ALL metrics; the client ranks on the
-- challenge's chosen subset. Guarded exactly like challenge_leaderboard.
create or replace function public.challenge_scores(cid uuid)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  sessions numeric,
  total_reps numeric,
  total_sets numeric,
  active_minutes numeric
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  ch record;
begin
  select * into ch from public.challenges where id = cid;
  if ch is null then
    raise exception 'challenge not found';
  end if;
  if not exists (
    select 1 from public.challenge_participants cp
    where cp.challenge_id = cid and cp.user_id = auth.uid()
  ) and ch.creator_id <> auth.uid() then
    raise exception 'not a participant of this challenge';
  end if;

  return query
  select
    cp.user_id,
    p.display_name,
    p.username::text,
    p.avatar_url,
    coalesce(agg.cnt, 0)::numeric,
    coalesce(agg.reps, 0)::numeric,
    coalesce(agg.sets, 0)::numeric,
    coalesce(round(agg.secs / 60.0), 0)::numeric
  from public.challenge_participants cp
  left join public.profiles p on p.id = cp.user_id
  left join lateral (
    select count(*) as cnt, sum(s.total_reps) as reps, sum(s.total_sets) as sets, sum(s.active_seconds) as secs
    from public.sessions s
    where s.owner_id = cp.user_id and s.status = 'completed'
      and s.started_at >= ch.starts_at and s.started_at < ch.ends_at
  ) agg on true
  where cp.challenge_id = cid;
end;
$$;

revoke all on function public.challenge_scores(uuid) from public;
grant execute on function public.challenge_scores(uuid) to authenticated;
