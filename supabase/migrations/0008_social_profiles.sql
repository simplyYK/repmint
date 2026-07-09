-- 0008 — profile visibility for the social feature.
--
-- Base policy (0002) shows a profile only to its owner or when is_public.
-- Social needs two more read paths (policies OR together):
--   1. Accepted friends can always see each other's profiles, even if one
--      side later turns discovery off.
--   2. The RECIPIENT of a pending request can see the requester's profile
--      (you must know who's asking before you accept). The reverse is
--      deliberately NOT granted — sending a request must not unlock reading
--      a private profile.

create policy "profiles_select_friends_or_requesters" on public.profiles
for select to authenticated
using (
  exists (
    select 1 from public.friendships f
    where
      (
        f.status = 'accepted'
        and (
          (f.user_id = (select auth.uid()) and f.friend_id = profiles.id)
          or (f.friend_id = (select auth.uid()) and f.user_id = profiles.id)
        )
      )
      or (
        f.status = 'pending'
        and f.friend_id = (select auth.uid())
        and f.user_id = profiles.id
      )
  )
);
