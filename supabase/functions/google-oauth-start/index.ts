// Inicia o fluxo OAuth do Google Calendar.
// Verifica o JWT do usuário, monta a URL de consent com access_type=offline
// (para receber refresh_token), assina o user_id no parâmetro `state` e
// redireciona o navegador para a tela de autorização do Google.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "openid",
  "email",
  "profile",
].join(" ");

function base64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signState(payload: object, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const body = base64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${base64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");

    if (!CLIENT_ID) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_OAUTH_CLIENT_ID não configurado." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const returnTo = url.searchParams.get("return_to") || "/agenda";

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;
    const state = await signState(
      {
        uid: userRes.user.id,
        ret: returnTo,
        ts: Date.now(),
      },
      SERVICE_KEY,
    );

    const consentUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    consentUrl.searchParams.set("client_id", CLIENT_ID);
    consentUrl.searchParams.set("redirect_uri", redirectUri);
    consentUrl.searchParams.set("response_type", "code");
    consentUrl.searchParams.set("scope", SCOPES);
    consentUrl.searchParams.set("access_type", "offline");
    consentUrl.searchParams.set("prompt", "consent");
    consentUrl.searchParams.set("include_granted_scopes", "true");
    consentUrl.searchParams.set("state", state);

    return new Response(
      JSON.stringify({ url: consentUrl.toString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[google-oauth-start] error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
