-- 0010 — allow the OpenAI Realtime engine as a voice provider.
-- 'realtime' streams cues over a persistent WebRTC session (fast, most
-- natural); 'openai' is per-cue TTS over HTTP; 'browser' is on-device.

alter table public.user_settings
  drop constraint if exists user_settings_voice_provider_check;

alter table public.user_settings
  add constraint user_settings_voice_provider_check
  check (voice_provider in ('browser', 'openai', 'realtime'));
