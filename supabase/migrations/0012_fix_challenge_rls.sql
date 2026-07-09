-- 0012 — fix infinite recursion in challenge RLS (0011).
--
-- challenges_select_visible queried challenge_participants while
-- challenge_participants_select_member queried challenges — Postgres detects
-- the policy cycle and errors (500 on every read). Break the cycle with
-- SECURITY DEFINER helpers: inside them RLS doesn't apply, so policies can
-- reference the other table without re-entering its policy.

create or replace function public.can_see_challenge(cid uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = cid
      and (
        c.creator_id = uid
        or exists (
          select 1 from public.challenge_participants cp
          where cp.challenge_id = cid and cp.user_id = uid
        )
        or exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and (
              (f.user_id = uid and f.friend_id = c.creator_id)
              or (f.friend_id = uid and f.user_id = c.creator_id)
            )
        )
      )
  );
$$;

create or replace function public.challenge_is_open(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.challenges c where c.id = cid and now() < c.ends_at);
$$;

revoke all on function public.can_see_challenge(uuid, uuid) from public;
revoke all on function public.challenge_is_open(uuid) from public;
grant execute on function public.can_see_challenge(uuid, uuid) to authenticated;
grant execute on function public.challenge_is_open(uuid) to authenticated;

drop policy "challenges_select_visible" on public.challenges;
create policy "challenges_select_visible" on public.challenges
for select to authenticated
using (public.can_see_challenge(id, (select auth.uid())));

drop policy "challenge_participants_select_member" on public.challenge_participants;
create policy "challenge_participants_select_member" on public.challenge_participants
for select to authenticated
using (public.can_see_challenge(challenge_id, (select auth.uid())));

drop policy "challenge_participants_insert_self" on public.challenge_participants;
create policy "challenge_participants_insert_self" on public.challenge_participants
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.can_see_challenge(challenge_id, (select auth.uid()))
  and public.challenge_is_open(challenge_id)
);
