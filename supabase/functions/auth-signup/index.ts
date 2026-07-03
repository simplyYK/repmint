// Server-side signup that creates an already-confirmed user via the service
// role — no confirmation email is sent, so it never hits Supabase's built-in
// email rate limit. The client then signs in normally with the password.
//
// verify_jwt is disabled for this function because sign-up happens before the
// user has a session. It only ever creates a user (email_confirm: true); it
// returns no data and cannot read anyone else's data.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Missing server configuration" }, 500);

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    display_name?: string;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const displayName = (body.display_name ?? "RepMint athlete").slice(0, 80);

  if (!email || !password) return json({ error: "Email and password are required." }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);

  const admin = createClient(url, serviceRole);
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) {
    const msg = /registered|already|exists|duplicate/i.test(error.message)
      ? "That email already has an account — try signing in instead."
      : error.message;
    return json({ error: msg }, 400);
  }

  return json({ ok: true });
});
