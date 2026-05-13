import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_KEYS = [
  "payout_consolidated",
  "payout_registry",
  "payout_rules",
  "payout_target_by_role",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let mesRef: string | undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        mesRef = body?.mes_ref;
      } catch (_) {
        // ignore
      }
    } else {
      const url = new URL(req.url);
      mesRef = url.searchParams.get("mes_ref") ?? undefined;
    }

    // Fetch latest snapshot for each meta_key
    const result: Record<string, unknown> = {};
    let latestUpdate: string | null = null;
    let pickedMesRef: string | null = null;

    for (const key of META_KEYS) {
      let q = supabase
        .from("sheets_blocks_snapshot")
        .select("payload, mes_ref, updated_at")
        .eq("meta_key", key)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (mesRef) q = q.eq("mes_ref", mesRef);

      const { data, error } = await q;
      if (error) throw error;
      const row = data?.[0];
      result[key] = row?.payload ?? null;
      if (row?.updated_at && (!latestUpdate || row.updated_at > latestUpdate)) {
        latestUpdate = row.updated_at;
      }
      if (row?.mes_ref && !pickedMesRef) pickedMesRef = row.mes_ref;
    }

    // Last sync from sheets_sources
    const { data: srcRows } = await supabase
      .from("sheets_sources")
      .select("meta_key, ultima_sincronizacao, ultimo_status, id, url, nome")
      .in("meta_key", META_KEYS as unknown as string[]);

    const sources = (srcRows ?? []).reduce<Record<string, unknown>>((acc, s) => {
      if (s.meta_key) acc[s.meta_key] = s;
      return acc;
    }, {});

    const lastSync = (srcRows ?? [])
      .map((s) => s.ultima_sincronizacao)
      .filter(Boolean)
      .sort()
      .pop() ?? latestUpdate;

    return new Response(
      JSON.stringify({
        consolidated: result.payout_consolidated,
        registry: result.payout_registry,
        rules: result.payout_rules,
        target_by_role: result.payout_target_by_role,
        last_sync: lastSync,
        mes_ref: pickedMesRef ?? mesRef ?? null,
        sources,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("get-payout-snapshot error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
