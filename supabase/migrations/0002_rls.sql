-- RepMint rebuild — 0002_rls.sql
-- Enable RLS on every table. Owner-only pattern using (select auth.uid()) for
-- performance (avoids per-row re-evaluation). Public/system rows readable by
-- any authenticated user where noted in BUILD_SPEC.

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.plans enable row level security;
alter table public.plan_days enable row level security;
alter table public.sessions enable row level security;
alter table public.session_sets enable row level security;
alter table public.coach_messages enable row level security;
alter table public.user_settings enable row level security;
alter table public.friendships enable row level security;
alter table public.shared_workouts enable row level security;

-- ---------------------------------------------------------------------------
-- profiles — owner full access; public rows readable by any authenticated
-- user (social-ready).
-- ---------------------------------------------------------------------------

create policy "profiles_select_own_or_public" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or is_public = true);

create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "profiles_delete_own" on public.profiles
for delete to authenticated
using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- exercises — global read-only bank. SELECT for anon + authenticated;
-- no client writes (writes happen via migrations / service role only).
-- ---------------------------------------------------------------------------

create policy "exercises_select_all" on public.exercises
for select to anon, authenticated
using (true);

-- ---------------------------------------------------------------------------
-- workout_templates — owner CRUD; public/system templates readable by any
-- authenticated user.
-- ---------------------------------------------------------------------------

create policy "workout_templates_select_own_or_public" on public.workout_templates
for select to authenticated
using (owner_id = (select auth.uid()) or is_public = true or owner_id is null);

create policy "workout_templates_insert_own" on public.workout_templates
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "workout_templates_update_own" on public.workout_templates
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "workout_templates_delete_own" on public.workout_templates
for delete to authenticated
using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- template_exercises — follow the parent template's visibility/ownership.
-- ---------------------------------------------------------------------------

create policy "template_exercises_select" on public.template_exercises
for select to authenticated
using (
  exists (
    select 1 from public.workout_templates t
    where t.id = template_exercises.template_id
      and (t.owner_id = (select auth.uid()) or t.is_public = true or t.owner_id is null)
  )
);

create policy "template_exercises_insert_own" on public.template_exercises
for insert to authenticated
with check (
  exists (
    select 1 from public.workout_templates t
    where t.id = template_exercises.template_id
      and t.owner_id = (select auth.uid())
  )
);

create policy "template_exercises_update_own" on public.template_exercises
for update to authenticated
using (
  exists (
    select 1 from public.workout_templates t
    where t.id = template_exercises.template_id
      and t.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.workout_templates t
    where t.id = template_exercises.template_id
      and t.owner_id = (select auth.uid())
  )
);

create policy "template_exercises_delete_own" on public.template_exercises
for delete to authenticated
using (
  exists (
    select 1 from public.workout_templates t
    where t.id = template_exercises.template_id
      and t.owner_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- plans — owner only.
-- ---------------------------------------------------------------------------

create policy "plans_select_own" on public.plans
for select to authenticated
using (owner_id = (select auth.uid()));

create policy "plans_insert_own" on public.plans
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "plans_update_own" on public.plans
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "plans_delete_own" on public.plans
for delete to authenticated
using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- plan_days — follow the parent plan's ownership.
-- ---------------------------------------------------------------------------

create policy "plan_days_select_own" on public.plan_days
for select to authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_days.plan_id and p.owner_id = (select auth.uid())
  )
);

create policy "plan_days_insert_own" on public.plan_days
for insert to authenticated
with check (
  exists (
    select 1 from public.plans p
    where p.id = plan_days.plan_id and p.owner_id = (select auth.uid())
  )
);

create policy "plan_days_update_own" on public.plan_days
for update to authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_days.plan_id and p.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.plans p
    where p.id = plan_days.plan_id and p.owner_id = (select auth.uid())
  )
);

create policy "plan_days_delete_own" on public.plan_days
for delete to authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_days.plan_id and p.owner_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- sessions — owner only (this is the calendar).
-- ---------------------------------------------------------------------------

create policy "sessions_select_own" on public.sessions
for select to authenticated
using (owner_id = (select auth.uid()));

create policy "sessions_insert_own" on public.sessions
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "sessions_update_own" on public.sessions
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "sessions_delete_own" on public.sessions
for delete to authenticated
using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- session_sets — owner_id is denormalized for direct RLS (fast path).
-- ---------------------------------------------------------------------------

create policy "session_sets_select_own" on public.session_sets
for select to authenticated
using (owner_id = (select auth.uid()));

create policy "session_sets_insert_own" on public.session_sets
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "session_sets_update_own" on public.session_sets
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "session_sets_delete_own" on public.session_sets
for delete to authenticated
using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- coach_messages — owner only.
-- ---------------------------------------------------------------------------

create policy "coach_messages_select_own" on public.coach_messages
for select to authenticated
using (owner_id = (select auth.uid()));

create policy "coach_messages_insert_own" on public.coach_messages
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "coach_messages_update_own" on public.coach_messages
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "coach_messages_delete_own" on public.coach_messages
for delete to authenticated
using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- user_settings — owner only (PK = owner_id).
-- ---------------------------------------------------------------------------

create policy "user_settings_select_own" on public.user_settings
for select to authenticated
using (owner_id = (select auth.uid()));

create policy "user_settings_insert_own" on public.user_settings
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "user_settings_update_own" on public.user_settings
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "user_settings_delete_own" on public.user_settings
for delete to authenticated
using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- friendships — either party reads; requester inserts; recipient updates
-- (e.g. to accept).
-- ---------------------------------------------------------------------------

create policy "friendships_select_either_party" on public.friendships
for select to authenticated
using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));

create policy "friendships_insert_requester" on public.friendships
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "friendships_update_recipient" on public.friendships
for update to authenticated
using (friend_id = (select auth.uid()) or user_id = (select auth.uid()))
with check (friend_id = (select auth.uid()) or user_id = (select auth.uid()));

create policy "friendships_delete_either_party" on public.friendships
for delete to authenticated
using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- shared_workouts — owner CRUD; visibility rules enforced at query time by
-- joining friendships (kept simple here: owner manages the share row).
-- ---------------------------------------------------------------------------

create policy "shared_workouts_select_visible" on public.shared_workouts
for select to authenticated
using (
  owner_id = (select auth.uid())
  or visibility = 'public'
  or (
    visibility = 'friends'
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.user_id = (select auth.uid()) and f.friend_id = shared_workouts.owner_id)
          or (f.friend_id = (select auth.uid()) and f.user_id = shared_workouts.owner_id)
        )
    )
  )
);

create policy "shared_workouts_insert_own" on public.shared_workouts
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "shared_workouts_update_own" on public.shared_workouts
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "shared_workouts_delete_own" on public.shared_workouts
for delete to authenticated
using (owner_id = (select auth.uid()));
