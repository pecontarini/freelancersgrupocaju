import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const alertsToInsert: any[] = [];

    // 1. Check for low-score audits in last 24h
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentAudits } = await supabase
      .from("supervision_audits")
      .select("id, loja_id, global_score, audit_date")
      .gte("created_at", oneDayAgo)
      .lt("global_score", 70);

    if (recentAudits) {
      for (const audit of recentAudits) {
        // Check if alert already exists for this audit
        const { data: existing } = await supabase
          .from("audit_alerts")
          .select("id")
          .eq("reference_id", audit.id)
          .eq("alert_type", "low_score")
          .limit(1);

        if (!existing || existing.length === 0) {
          alertsToInsert.push({
            loja_id: audit.loja_id,
            alert_type: "low_score",
            severity: "critical",
            title: `Auditoria abaixo de 70%`,
            description: `Nota ${audit.global_score.toFixed(1)}% registrada em ${audit.audit_date}`,
            reference_id: audit.id,
          });
        }
      }
    }

    // 2. Check for recurring items (3+ in 60 days)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentFailures } = await supabase
      .from("supervision_failures")
      .select("item_name, loja_id")
      .gte("created_at", sixtyDaysAgo);

    if (recentFailures) {
      const itemsByStore: Record<string, Record<string, number>> = {};
      for (const f of recentFailures) {
        if (!itemsByStore[f.loja_id]) itemsByStore[f.loja_id] = {};
        itemsByStore[f.loja_id][f.item_name] = (itemsByStore[f.loja_id][f.item_name] || 0) + 1;
      }

      for (const [lojaId, items] of Object.entries(itemsByStore)) {
        for (const [itemName, count] of Object.entries(items)) {
          if (count >= 3) {
            const refId = `recurring_${lojaId}_${itemName.substring(0, 30)}`;
            const { data: existing } = await supabase
              .from("audit_alerts")
              .select("id")
              .eq("reference_id", refId)
              .eq("alert_type", "recurring_item")
              .gte("created_at", sixtyDaysAgo)
              .limit(1);

            if (!existing || existing.length === 0) {
              alertsToInsert.push({
                loja_id: lojaId,
                alert_type: "recurring_item",
                severity: "warning",
                title: `Item recorrente: ${itemName.substring(0, 60)}`,
                description: `${count} ocorrências nos últimos 60 dias`,
                reference_id: refId,
              });
            }
          }
        }
      }
    }

    // 3. Check for overdue action plans
    const { data: overduePlans } = await supabase
      .from("action_plans")
      .select("id, loja_id, pain_tag, deadline_at")
      .neq("status", "resolved")
      .neq("status", "validated")
      .lt("deadline_at", now.toISOString());

    if (overduePlans) {
      for (const plan of overduePlans) {
        const { data: existing } = await supabase
          .from("audit_alerts")
          .select("id")
          .eq("reference_id", plan.id)
          .eq("alert_type", "overdue_plan")
          .limit(1);

        if (!existing || existing.length === 0) {
          alertsToInsert.push({
            loja_id: plan.loja_id,
            alert_type: "overdue_plan",
            severity: "warning",
            title: `Plano de ação vencido`,
            description: `"${plan.pain_tag}" venceu em ${new Date(plan.deadline_at).toLocaleDateString("pt-BR")}`,
            reference_id: plan.id,
          });
        }
      }
    }

    // Insert all alerts
    let inserted = 0;
    if (alertsToInsert.length > 0) {
      const { error } = await supabase.from("audit_alerts").insert(alertsToInsert);
      if (error) {
        console.error("Error inserting alerts:", error);
        throw error;
      }
      inserted = alertsToInsert.length;
    }

    return new Response(
      JSON.stringify({ success: true, alerts_created: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-audit-alerts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
