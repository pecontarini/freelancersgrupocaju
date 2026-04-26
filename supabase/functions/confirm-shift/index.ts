import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { schedule_id, action, denial_reason } = await req.json();

    if (!schedule_id || !action) {
      return new Response(
        JSON.stringify({ error: "schedule_id and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the schedule with joins
    const { data: schedule, error: fetchErr } = await supabase
      .from("schedules")
      .select(`
        id, schedule_date, status, confirmation_status, confirmation_responded_at,
        employee_id, start_time, end_time,
        employees!schedules_employee_id_fkey ( name ),
        shifts!schedules_shift_id_fkey ( name, start_time, end_time ),
        sectors!schedules_sector_id_fkey ( name )
      `)
      .eq("id", schedule_id)
      .maybeSingle();

    if (fetchErr || !schedule) {
      return new Response(
        JSON.stringify({ error: "Escala não encontrada.", code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already responded
    if (schedule.confirmation_status && schedule.confirmation_status !== "pending") {
      return new Response(
        JSON.stringify({
          error: "already_responded",
          confirmation_status: schedule.confirmation_status,
          confirmation_responded_at: schedule.confirmation_responded_at,
          schedule,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if schedule date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const schedDate = new Date(schedule.schedule_date + "T00:00:00");
    if (schedDate < today) {
      return new Response(
        JSON.stringify({ error: "Link expirado.", code: "EXPIRED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if cancelled
    if (schedule.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Escala cancelada.", code: "CANCELLED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    if (action === "confirm") {
      const { error: upErr } = await supabase
        .from("schedules")
        .update({
          confirmation_status: "confirmed",
          confirmation_responded_at: now,
          status: "confirmed",
        })
        .eq("id", schedule_id);

      if (upErr) throw upErr;

      return new Response(
        JSON.stringify({ success: true, action: "confirmed", schedule }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "deny") {
      const { error: upErr } = await supabase
        .from("schedules")
        .update({
          confirmation_status: "denied",
          confirmation_responded_at: now,
          denial_reason: denial_reason || null,
        })
        .eq("id", schedule_id);

      if (upErr) throw upErr;

      return new Response(
        JSON.stringify({ success: true, action: "denied", schedule }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // action = "fetch" — just return schedule data
    return new Response(
      JSON.stringify({ success: true, schedule }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[confirm-shift] Error:", error);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
