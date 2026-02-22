import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, access_token, responses, responded_by_name } = await req.json();

    if (!access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Access token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the link
    const { data: link, error: linkError } = await supabase
      .from("checklist_sector_links")
      .select("*, config_lojas:loja_id(nome)")
      .eq("access_token", access_token)
      .eq("is_active", true)
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ success: false, error: "Link inválido ou inativo" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fetch") {
      // Get all active template items for this sector and store
      const { data: items, error: itemsError } = await supabase
        .from("checklist_template_items")
        .select("id, item_text, item_order, weight, original_category, checklist_templates!inner(loja_id, is_active)")
        .eq("sector_code", link.sector_code)
        .eq("checklist_templates.loja_id", link.loja_id)
        .eq("checklist_templates.is_active", true)
        .order("item_order", { ascending: true });

      if (itemsError) {
        console.error("Error fetching items:", itemsError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to fetch checklist items" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already submitted today
      const today = new Date().toISOString().split("T")[0];
      const { data: existingResponse } = await supabase
        .from("checklist_responses")
        .select("id, total_score, created_at")
        .eq("link_id", link.id)
        .eq("response_date", today)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            link_id: link.id,
            loja_id: link.loja_id,
            loja_name: link.config_lojas?.nome || "Unidade",
            sector_code: link.sector_code,
            items: items || [],
            already_submitted: !!existingResponse,
            existing_score: existingResponse?.total_score || null,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "submit") {
      if (!responses || !Array.isArray(responses)) {
        return new Response(
          JSON.stringify({ success: false, error: "Responses array is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get item weights for score calculation
      const itemIds = responses.map((r: any) => r.template_item_id);
      const { data: items } = await supabase
        .from("checklist_template_items")
        .select("id, weight")
        .in("id", itemIds);

      const weightMap: Record<string, number> = {};
      (items || []).forEach((item: any) => {
        weightMap[item.id] = item.weight || 1;
      });

      // Calculate score
      let totalWeight = 0;
      let conformingWeight = 0;
      let conformingCount = 0;

      responses.forEach((r: any) => {
        const weight = weightMap[r.template_item_id] || 1;
        totalWeight += weight;
        if (r.is_conforming) {
          conformingWeight += weight;
          conformingCount++;
        }
      });

      const score = totalWeight > 0 ? (conformingWeight / totalWeight) * 100 : 0;
      const today = new Date().toISOString().split("T")[0];

      // Insert response
      const { data: response, error: responseError } = await supabase
        .from("checklist_responses")
        .insert({
          link_id: link.id,
          loja_id: link.loja_id,
          sector_code: link.sector_code,
          response_date: today,
          total_score: Math.round(score * 100) / 100,
          total_items: responses.length,
          conforming_items: conformingCount,
          responded_by_name: responded_by_name || "Anônimo",
        })
        .select()
        .single();

      if (responseError) {
        console.error("Error inserting response:", responseError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to save response" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert response items
      const responseItems = responses.map((r: any) => ({
        response_id: response.id,
        template_item_id: r.template_item_id,
        is_conforming: r.is_conforming,
        observation: r.observation || null,
        photo_url: r.photo_url || null,
      }));

      const { error: itemsError } = await supabase
        .from("checklist_response_items")
        .insert(responseItems);

      if (itemsError) {
        console.error("Error inserting response items:", itemsError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            response_id: response.id,
            total_score: response.total_score,
            total_items: response.total_items,
            conforming_items: response.conforming_items,
            sector_code: link.sector_code,
            loja_name: link.config_lojas?.nome || "Unidade",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action. Use 'fetch' or 'submit'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in submit-daily-checklist:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
