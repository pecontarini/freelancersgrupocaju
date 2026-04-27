// Callback do OAuth do Google. Recebe o `code`, valida o `state` assinado,
// troca por access_token + refresh_token, salva em user_google_tokens
// e redireciona o usuário de volta para a Agenda.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function base64urlDecodeToString(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

function base64urlDecodeToBytes(input: string): Uint8Array {
  const bin = base64urlDecodeToString(input);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyState(token: string, secret: string): Promise<{ uid: string; ret: string; ts: number } | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecodeToBytes(sig),
    enc.encode(body),
  );
  if (!ok) return null;
  try {
    return JSON.parse(base64urlDecodeToString(body));
  } catch {
    return null;
  }
}

function htmlRedirect(targetUrl: string, message: string): Response {
  // Redirect HTTP 302 verdadeiro: o navegador segue imediatamente o header
  // Location, sem renderizar HTML intermediário e sem depender de JavaScript.
  // Isso evita o caso em que Safari/Chrome param na página do Supabase.
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: targetUrl,
      "Cache-Control": "no-store",
      // Mantém um corpo mínimo de fallback caso algum proxy ignore o Location
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

  // Origem do app para construir o redirect final (passada pelo state ou fallback)
  const appOrigin = Deno.env.get("APP_PUBLIC_URL") ?? "https://freelancersgrupocaju.lovable.app";

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      return htmlRedirect(
        `${appOrigin}/agenda?google_oauth=error&reason=${encodeURIComponent(errorParam)}`,
        "Autorização recusada. Voltando para a Agenda...",
      );
    }
    if (!code || !stateRaw) {
      return htmlRedirect(
        `${appOrigin}/agenda?google_oauth=error&reason=missing_params`,
        "Parâmetros ausentes. Voltando para a Agenda...",
      );
    }
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return htmlRedirect(
        `${appOrigin}/agenda?google_oauth=error&reason=server_misconfigured`,
        "Servidor sem credenciais Google. Voltando para a Agenda...",
      );
    }

    const state = await verifyState(stateRaw, SERVICE_KEY);
    if (!state) {
      return htmlRedirect(
        `${appOrigin}/agenda?google_oauth=error&reason=invalid_state`,
        "State inválido. Voltando para a Agenda...",
      );
    }

    // Expira state após 10 minutos
    if (Date.now() - state.ts > 10 * 60 * 1000) {
      return htmlRedirect(
        `${appOrigin}/agenda?google_oauth=error&reason=state_expired`,
        "Tempo expirado. Voltando para a Agenda...",
      );
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

    // Troca code por tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("[google-oauth-callback] token exchange failed", tokenJson);
      return htmlRedirect(
        `${appOrigin}/agenda?google_oauth=error&reason=${encodeURIComponent(tokenJson.error || "token_exchange_failed")}`,
        "Falha ao trocar código por token. Voltando para a Agenda...",
      );
    }

    const { access_token, refresh_token, expires_in, scope, token_type } = tokenJson as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
      token_type: string;
    };

    const expiresAt = new Date(Date.now() + Number(expires_in ?? 3600) * 1000).toISOString();

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Preserva refresh_token anterior se Google não retornou um novo
    const { data: existing } = await supabase
      .from("user_google_tokens")
      .select("refresh_token")
      .eq("user_id", state.uid)
      .maybeSingle();

    const finalRefresh = refresh_token ?? existing?.refresh_token ?? null;

    const { error: upsertErr } = await supabase
      .from("user_google_tokens")
      .upsert(
        {
          user_id: state.uid,
          access_token,
          refresh_token: finalRefresh,
          expires_at: expiresAt,
          scope,
          token_type: token_type ?? "Bearer",
        },
        { onConflict: "user_id" },
      );

    if (upsertErr) {
      console.error("[google-oauth-callback] upsert error", upsertErr);
      return htmlRedirect(
        `${appOrigin}/agenda?google_oauth=error&reason=db_upsert`,
        "Falha ao salvar token. Voltando para a Agenda...",
      );
    }

    const ret = state.ret?.startsWith("/") ? state.ret : "/agenda";
    return htmlRedirect(
      `${appOrigin}${ret}?google_oauth=success`,
      "Conectado! Voltando para o app...",
    );
  } catch (err) {
    console.error("[google-oauth-callback] unexpected error", err);
    return htmlRedirect(
      `${appOrigin}/agenda?google_oauth=error&reason=unexpected`,
      "Erro inesperado. Voltando para a Agenda...",
    );
  }
});
