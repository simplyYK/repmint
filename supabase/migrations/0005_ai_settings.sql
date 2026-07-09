-- RepMint — 0005_ai_settings.sql
-- Per-agent AI settings.
--
-- user_settings gains one nullable override column per agent role. Null means
-- "use the built-in default prompt" (which is also how revert-to-original
-- works: the Settings UI simply nulls the column).
--
-- Also (re)creates the service-role-only vault accessor the edge functions
-- use to read AI provider keys when the function env vars aren't set:
-- OPENROUTER_API_KEY / GEMINI_API_KEY env take precedence, then vault
-- secrets named openrouter_api_key / gemini_api_key.

alter table public.user_settings
  add column if not exists ai_prompt_coach text,
  add column if not exists ai_prompt_planner text;

create or replace function public.get_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name;
$$;

revoke all on function public.get_secret(text) from public;
revoke all on function public.get_secret(text) from anon;
revoke all on function public.get_secret(text) from authenticated;
grant execute on function public.get_secret(text) to service_role;
