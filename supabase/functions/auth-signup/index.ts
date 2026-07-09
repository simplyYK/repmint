// auth-signup — instant account creation with NO confirmation email.
//
// POST { email, password, display_name? } -> { ok: true }
//
// Why: Supabase's built-in confirmation email is rate-limited (~2/hour without
// custom SMTP) and adds a pointless step for a fitness app demo. This function
// creates the user via the service role with email_confirm: true, so the
// account is immediately usable — the client signs in with the password right
// after. Magic-link sign-in is untouched (it goes through supabase.auth
// directly and is the one flow that legitimately needs an email).
//
// Called with the anon key as the bearer (caller has no session yet);
// verify_jwt accepts it. All privileged work happens with the service role.

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing server configuration" }, 500);

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    display_name?: string;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const displayName = (body.display_name ?? "").trim().slice(0, 60);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no confirmation email — the account works right away
    user_metadata: { display_name: displayName || "RepMint athlete" },
  });

  if (error) {
    const msg = error.message ?? "";
    if (/already.*(registered|exists)/i.test(msg) || error.status === 422) {
      return json({ error: "That email already has an account — sign in instead." }, 409);
    }
    console.error("auth-signup createUser failed:", error.status, msg);
    return json({ error: "Could not create the account. Try again." }, 500);
  }

  return json({ ok: true });
});
