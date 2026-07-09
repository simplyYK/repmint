-- 0009 — consolidate the two permissive SELECT policies on profiles (0002 +
-- 0008) into one, per the Supabase performance linter: multiple permissive
-- policies each execute on every query. Semantics are unchanged:
-- own OR public OR accepted-friend OR pending-requester-visible-to-recipient.

drop policy "profiles_select_own_or_public" on public.profiles;
drop policy "profiles_select_friends_or_requesters" on public.profiles;

create policy "profiles_select_visible" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or is_public = true
  or exists (
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
