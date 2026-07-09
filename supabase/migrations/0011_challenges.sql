-- 0011 — weekly community competitions.
--
-- A challenge is a metric race over at most 8 days among the creator and
-- their friends. Raw sessions stay owner-private (RLS untouched); the ONLY
-- cross-user surface is challenge_leaderboard(), a security-definer function
-- that returns per-participant aggregates and refuses callers who aren't in
-- the challenge.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 80),
  metric text not null check (metric in ('sessions', 'total_reps', 'total_sets', 'active_minutes')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint challenges_max_week check (ends_at > starts_at and ends_at <= starts_at + interval '8 days')
);

create table public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create index idx_challenges_creator on public.challenges(creator_id, ends_at desc);
create index idx_challenge_participants_user on public.challenge_participants(user_id);

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;

-- Visible to the creator, participants, and the creator's accepted friends
-- (so friends can discover + join).
create policy "challenges_select_visible" on public.challenges
for select to authenticated
using (
  creator_id = (select auth.uid())
  or exists (
    select 1 from public.challenge_participants cp
    where cp.challenge_id = challenges.id and cp.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.user_id = (select auth.uid()) and f.friend_id = challenges.creator_id)
        or (f.friend_id = (select auth.uid()) and f.user_id = challenges.creator_id)
      )
  )
);

create policy "challenges_insert_own" on public.challenges
for insert to authenticated
with check (creator_id = (select auth.uid()));

create policy "challenges_delete_own" on public.challenges
for delete to authenticated
using (creator_id = (select auth.uid()));

-- Participants: rows visible to anyone who can see the challenge is enforced
-- via join to challenges (RLS on challenges applies inside the subquery).
create policy "challenge_participants_select_member" on public.challenge_participants
for select to authenticated
using (
  exists (select 1 from public.challenges c where c.id = challenge_participants.challenge_id)
);

-- Join yourself, only while the challenge is running, only if you can see it
-- (creator or friend-of-creator via the challenges RLS).
create policy "challenge_participants_insert_self" on public.challenge_participants
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.challenges c
    where c.id = challenge_participants.challenge_id and now() < c.ends_at
  )
);

create policy "challenge_participants_delete_self" on public.challenge_participants
for delete to authenticated
using (user_id = (select auth.uid()));

-- Leaderboard: aggregates only, participants only. SECURITY DEFINER bypasses
-- sessions RLS deliberately — the guard at the top is the access control.
create or replace function public.challenge_leaderboard(cid uuid)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  value numeric
)
language plpgsql
security definer
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
    coalesce(
      case ch.metric
        when 'sessions' then (
          select count(*)::numeric from public.sessions s
          where s.owner_id = cp.user_id and s.status = 'completed'
            and s.started_at >= ch.starts_at and s.started_at < ch.ends_at
        )
        when 'total_reps' then (
          select coalesce(sum(s.total_reps), 0)::numeric from public.sessions s
          where s.owner_id = cp.user_id and s.status = 'completed'
            and s.started_at >= ch.starts_at and s.started_at < ch.ends_at
        )
        when 'total_sets' then (
          select coalesce(sum(s.total_sets), 0)::numeric from public.sessions s
          where s.owner_id = cp.user_id and s.status = 'completed'
            and s.started_at >= ch.starts_at and s.started_at < ch.ends_at
        )
        when 'active_minutes' then (
          select coalesce(round(sum(s.active_seconds) / 60.0), 0)::numeric from public.sessions s
          where s.owner_id = cp.user_id and s.status = 'completed'
            and s.started_at >= ch.starts_at and s.started_at < ch.ends_at
        )
      end, 0)
  from public.challenge_participants cp
  left join public.profiles p on p.id = cp.user_id
  where cp.challenge_id = cid
  order by 5 desc;
end;
$$;

revoke all on function public.challenge_leaderboard(uuid) from public;
grant execute on function public.challenge_leaderboard(uuid) to authenticated;
