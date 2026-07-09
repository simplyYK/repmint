-- 0007 — per-user OpenAI TTS voice for the live coach.
--
-- `voice_provider` (0006) picks the engine; this picks WHICH natural voice
-- the tts edge function speaks with when the engine is "openai". Values
-- mirror the gpt-4o-mini-tts voice ids the tts function allows.

alter table public.user_settings
  add column if not exists tts_voice text not null default 'ash';

alter table public.user_settings
  add constraint user_settings_tts_voice_check
  check (tts_voice in ('ash', 'alloy', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'));
