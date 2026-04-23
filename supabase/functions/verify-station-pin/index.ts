import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action: string = body.action;
    const lojaId: string | undefined = body.loja_id;
    const pin: string | undefined = body.pin;
    const stationName: string | undefined = body.station_name;

    if (!action || !lojaId) {
      return new Response(
        JSON.stringify({ error: "action and loja_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pin || !/^\d{4,8}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "PIN inválido (4 a 8 dígitos)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const pinHash = await sha256Hex(pin);

    if (action === "create") {
      const { data: existing } = await admin
        .from("checkin_stations")
        .select("id")
        .eq("loja_id", lojaId)
        .maybeSingle();

      let stationId: string;
      if (existing) {
        const { error } = await admin
          .from("checkin_stations")
          .update({
            pin_hash: pinHash,
            station_name: stationName ?? "Estação Principal",
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
        stationId = existing.id;
      } else {
        const { data, error } = await admin
          .from("checkin_stations")
          .insert({
            loja_id: lojaId,
            station_name: stationName ?? "Estação Principal",
            pin_hash: pinHash,
            last_seen_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        stationId = data.id;
      }

      return new Response(
        JSON.stringify({ ok: true, station_id: stationId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      const { data: station, error } = await admin
        .from("checkin_stations")
        .select("id, pin_hash")
        .eq("loja_id", lojaId)
        .maybeSingle();

      if (error) throw error;
      if (!station) {
        return new Response(
          JSON.stringify({ ok: false, error: "Estação não configurada para esta unidade." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (station.pin_hash !== pinHash) {
        return new Response(
          JSON.stringify({ ok: false, error: "PIN incorreto." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await admin
        .from("checkin_stations")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", station.id);

      return new Response(
        JSON.stringify({ ok: true, station_id: station.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("verify-station-pin error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
