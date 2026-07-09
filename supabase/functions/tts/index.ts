// tts — natural coach voice via OpenAI text-to-speech.
//
// POST { text, voice? } -> audio/mpeg bytes. The client (voice coach in the
// live trainer) plays these for cues/milestones when the user picks the
// "OpenAI realtime voice" engine in Settings; it falls back to on-device
// Web Speech when this returns an error (no key, rate limit, offline).
//
// Key resolution mirrors ai-coach: OPENAI_API_KEY env first, then the vault
// secret `openai_api_key` via the service-role-only get_secret() RPC.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_VOICES = new Set(["ash", "alloy", "echo", "coral", "sage", "verse"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Missing server configuration" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization header" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Invalid user session" }, 401);

  const body = (await req.json().catch(() => ({}))) as { text?: string; voice?: string };
  const text = (body.text ?? "").trim().slice(0, 300); // cues are short sentences
  if (!text) return json({ error: "text is required" }, 400);
  const voice = ALLOWED_VOICES.has(body.voice ?? "") ? (body.voice as string) : "ash";

  let apiKey = Deno.env.get("OPENAI_API_KEY") || null;
  if (!apiKey) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await adminClient.rpc("get_secret", { secret_name: "openai_api_key" });
    if (typeof data === "string" && data.trim()) apiKey = data.trim();
  }
  if (!apiKey) {
    return json({ error: "OpenAI voice isn't set up yet — add an OpenAI API key." }, 503);
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      instructions:
        "You are an encouraging, calm personal trainer speaking mid-workout. Energetic but never shouty. Very brief.",
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    // Never echo upstream error bodies verbatim (may include request details).
    return json({ error: `Voice generation failed (${response.status})` }, 502);
  }

  return new Response(response.body, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
});
