-- RepMint — 0006_coach_conversations.sql
-- (applied remotely as voice_provider_setting + coach_conversations_and_memories)
--
-- 1. Voice engine preference for the live trainer.
-- 2. Per-agent AI model overrides (null = fall back to ai_model).
-- 3. Multiple coach conversations + long-term cross-chat memories.
--    Memories are extracted server-side by the ai-coach function (MEMORY
--    protocol) and are included in every chat's context, so the coach's
--    grounding compounds over time. Inserts happen via the service role
--    only — clients can read/delete their own but never fabricate them.

alter table public.user_settings
  add column if not exists voice_provider text not null default 'browser'
  check (voice_provider in ('browser', 'openai'));

alter table public.user_settings
  add column if not exists ai_model_coach text,
  add column if not exists ai_model_planner text;

create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_coach_conversations_owner on public.coach_conversations(owner_id, updated_at desc);

alter table public.coach_messages
  add column if not exists conversation_id uuid references public.coach_conversations(id) on delete cascade;
create index if not exists idx_coach_messages_conversation on public.coach_messages(conversation_id, created_at);

create table if not exists public.coach_memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists idx_coach_memories_owner on public.coach_memories(owner_id, created_at desc);

alter table public.coach_conversations enable row level security;
alter table public.coach_memories enable row level security;

create policy coach_conversations_all_own on public.coach_conversations
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy coach_memories_select_own on public.coach_memories
  for select using (owner_id = (select auth.uid()));
create policy coach_memories_delete_own on public.coach_memories
  for delete using (owner_id = (select auth.uid()));
