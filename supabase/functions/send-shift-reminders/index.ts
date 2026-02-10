import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================
// WhatsApp sender (placeholder — swap for Z-API / Evolution API)
// ============================================

interface WhatsAppPayload {
  phone: string;
  message: string;
}

async function sendWhatsApp(payload: WhatsAppPayload): Promise<boolean> {
  // ----- PLACEHOLDER -----
  // Replace this block with a real fetch to your WhatsApp gateway:
  //
  // const res = await fetch("https://api.z-api.io/instances/.../send-text", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     "Client-Token": Deno.env.get("ZAPI_TOKEN")!,
  //   },
  //   body: JSON.stringify({ phone: payload.phone, message: payload.message }),
  // });
  // return res.ok;

  console.log(`[WhatsApp SIMULATED] To: ${payload.phone}`);
  console.log(`  Message: ${payload.message}`);
  return true;
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Tomorrow's date in ISO format
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    console.log(`[send-shift-reminders] Processing reminders for ${tomorrowStr}`);

    // 1. Fetch tomorrow's active schedules with employee + sector info
    const { data: schedules, error: schedError } = await supabase
      .from("schedules")
      .select(`
        id,
        schedule_date,
        shift_id,
        sector_id,
        employee_id,
        employees!schedules_employee_id_fkey ( id, name ),
        sectors!schedules_sector_id_fkey ( name ),
        shifts!schedules_shift_id_fkey ( name, start_time, end_time )
      `)
      .eq("schedule_date", tomorrowStr)
      .eq("status", "scheduled");

    if (schedError) throw schedError;

    if (!schedules || schedules.length === 0) {
      console.log("[send-shift-reminders] No schedules found for tomorrow.");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No schedules for tomorrow" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check which ones already received a notification today
    const scheduleIds = schedules.map((s) => s.id);
    const today = new Date().toISOString().split("T")[0];

    const { data: existingLogs } = await supabase
      .from("notification_logs")
      .select("schedule_id")
      .in("schedule_id", scheduleIds)
      .eq("channel", "whatsapp")
      .eq("notification_date", today);

    const alreadySent = new Set((existingLogs || []).map((l) => l.schedule_id));

    // 3. Build & send messages
    const appUrl = Deno.env.get("APP_URL") || "https://freelancersgrupocaju.lovable.app";
    let sentCount = 0;
    const errors: string[] = [];

    for (const sched of schedules) {
      if (alreadySent.has(sched.id)) {
        console.log(`[skip] Already notified schedule ${sched.id}`);
        continue;
      }

      const employeeName = (sched.employees as any)?.name || "Colaborador";
      const sectorName = (sched.sectors as any)?.name || "Setor";
      const shiftName = (sched.shifts as any)?.name || "Turno";
      const dateFormatted = tomorrowStr.split("-").reverse().join("/");

      const message =
        `Olá ${employeeName}! Confirme sua escala de amanhã (${dateFormatted}) ` +
        `no setor ${sectorName} - ${shiftName}. ` +
        `✅ Confirmar: ${appUrl}/confirm-shift/${sched.id}?action=confirm ` +
        `❌ Não posso: ${appUrl}/confirm-shift/${sched.id}?action=deny`;

      // Placeholder phone — in production, join with a profiles/contacts table
      const phone = "5500000000000";

      const ok = await sendWhatsApp({ phone, message });

      // 4. Log the notification
      const { error: logError } = await supabase
        .from("notification_logs")
        .insert({
          schedule_id: sched.id,
          employee_id: (sched.employees as any)?.id || sched.employee_id,
          channel: "whatsapp",
          status: ok ? "sent" : "failed",
          message_body: message,
          notification_date: today,
        });

      if (logError) {
        console.error(`[log error] schedule ${sched.id}:`, logError.message);
        errors.push(logError.message);
      }

      if (ok) sentCount++;
    }

    console.log(`[send-shift-reminders] Done. Sent: ${sentCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: schedules.length,
        skipped: alreadySent.size,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-shift-reminders] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
