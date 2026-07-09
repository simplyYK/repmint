-- 0013 — make INSERT ... RETURNING work on challenges/participants.
--
-- can_see_challenge() is STABLE, so inside INSERT..RETURNING it evaluates
-- against the statement-start snapshot and cannot see the row being inserted —
-- the SELECT policy denied the RETURNING and the API returned 403. Check the
-- row's own columns first (visible during RETURNING), and only fall back to
-- the helper for rows the user didn't author.

drop policy "challenges_select_visible" on public.challenges;
create policy "challenges_select_visible" on public.challenges
for select to authenticated
using (
  creator_id = (select auth.uid())
  or public.can_see_challenge(id, (select auth.uid()))
);

drop policy "challenge_participants_select_member" on public.challenge_participants;
create policy "challenge_participants_select_member" on public.challenge_participants
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.can_see_challenge(challenge_id, (select auth.uid()))
);
