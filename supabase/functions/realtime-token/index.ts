// realtime-token — mints an ephemeral OpenAI Realtime client secret for the
// live voice coach.
//
// POST { voice? } -> { value, expiresAt, model, voice }. The browser uses the
// secret to open a WebRTC session directly with OpenAI (POST /v1/realtime/calls)
// and then drives speech with explicit response.create events — the agent
// instructions below make it a cue-reader, not a chatterbox: it speaks ONLY
// when the app sends a cue, one short line at a time, and never initiates.
//
// Key resolution mirrors tts: OPENAI_API_KEY env first, then the vault
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

const REALTIME_MODEL = "gpt-realtime-2.1";

// Voices the Realtime API serves. tts-only picks map to the closest match so
// one saved tts_voice setting works for both engines.
const REALTIME_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"]);
const VOICE_FALLBACK: Record<string, string> = { fable: "marin", nova: "shimmer", onyx: "cedar" };

const COACH_INSTRUCTIONS = `You are the RepMint live voice coach — the voice in the room while someone trains.

You never speak on your own. The training app sends you short cue texts mid-workout (form corrections, encouragement, milestones). For each cue:
- Say the cue naturally, as a real personal trainer standing next to the athlete would: warm, grounded, a little breathy from moving around the gym floor, energetic but never shouty.
- One to two short sentences maximum. Then STOP and stay silent until the next cue.
- Never ask questions, never add advice beyond the cue, never introduce yourself, never fill silence.
- Match the moment: form cues are calm and precise; milestone cues carry a smile; final-rep pushes have intensity.`;

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

  const body = (await req.json().catch(() => ({}))) as { voice?: string };
  const requested = (body.voice ?? "").trim();
  const voice = REALTIME_VOICES.has(requested) ? requested : VOICE_FALLBACK[requested] ?? "marin";

  let apiKey = Deno.env.get("OPENAI_API_KEY") || null;
  if (!apiKey) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await adminClient.rpc("get_secret", { secret_name: "openai_api_key" });
    if (typeof data === "string" && data.trim()) apiKey = data.trim();
  }
  if (!apiKey) {
    return json({ error: "OpenAI voice isn't set up yet — add an OpenAI API key." }, 503);
  }

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Stable per-user hash for OpenAI abuse monitoring; never the raw id.
      "OpenAI-Safety-Identifier": await sha256Hex(authData.user.id),
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions: COACH_INSTRUCTIONS,
        output_modalities: ["audio"],
        audio: {
          // No mic is ever attached client-side; disabling turn detection makes
          // "only speaks when cued" a server-enforced guarantee, not a hope.
          input: { turn_detection: null },
          output: { voice },
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    // Never echo upstream error bodies verbatim (may include request details).
    console.error("realtime client_secrets failed", response.status, JSON.stringify(payload)?.slice(0, 500));
    return json({ error: `Could not start the realtime voice session (${response.status})` }, 502);
  }

  return json({
    value: payload?.value,
    expiresAt: payload?.expires_at ?? null,
    model: REALTIME_MODEL,
    voice,
  });
});

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
