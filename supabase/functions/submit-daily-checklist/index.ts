import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, access_token, responses, responded_by_name, file_base64, file_name } = await req.json();

    if (!access_token) {
      return jsonResponse({ success: false, error: "Access token is required" }, 400);
    }

    // Validate the link
    const { data: link, error: linkError } = await supabase
      .from("checklist_sector_links")
      .select("*, config_lojas:loja_id(nome)")
      .eq("access_token", access_token)
      .eq("is_active", true)
      .single();

    if (linkError || !link) {
      return jsonResponse({ success: false, error: "Link inválido ou inativo" }, 404);
    }

    // ==================== UPLOAD PHOTO ====================
    if (action === "upload-photo") {
      if (!file_base64 || !file_name) {
        return jsonResponse({ success: false, error: "file_base64 and file_name are required" }, 400);
      }

      // Validate extension
      const ext = (file_name as string).split(".").pop()?.toLowerCase() || "";
      if (!["jpg", "jpeg", "png", "webp", "heic"].includes(ext)) {
        return jsonResponse({ success: false, error: "Formato de imagem não suportado. Use JPG, PNG ou WebP." }, 400);
      }

      // Decode base64
      const binaryStr = atob(file_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Validate size (5MB max)
      if (bytes.length > 5 * 1024 * 1024) {
        return jsonResponse({ success: false, error: "Arquivo muito grande. Máximo 5MB." }, 400);
      }

      const filePath = `${access_token}/${crypto.randomUUID()}.${ext}`;
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("checklist-photos")
        .upload(filePath, bytes, { contentType, upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return jsonResponse({ success: false, error: "Erro ao fazer upload da foto" }, 500);
      }

      const { data: publicData } = supabase.storage
        .from("checklist-photos")
        .getPublicUrl(uploadData.path);

      return jsonResponse({
        success: true,
        data: { public_url: publicData.publicUrl },
      });
    }

    // ==================== FETCH ====================
    if (action === "fetch") {
      let query = supabase
        .from("checklist_template_items")
        .select("id, item_text, item_order, weight, original_category, checklist_templates!inner(id, loja_id, is_active)")
        .eq("sector_code", link.sector_code)
        .eq("checklist_templates.loja_id", link.loja_id)
        .eq("checklist_templates.is_active", true);

      if (link.template_id) {
        query = query.eq("checklist_templates.id", link.template_id);
      }

      const { data: items, error: itemsError } = await query.order("item_order", { ascending: true });

      if (itemsError) {
        console.error("Error fetching items:", itemsError);
        return jsonResponse({ success: false, error: "Failed to fetch checklist items" }, 500);
      }

      let templateName = "";
      if (link.template_id) {
        const { data: tmpl } = await supabase
          .from("checklist_templates")
          .select("name")
          .eq("id", link.template_id)
          .single();
        templateName = tmpl?.name || "";
      }

      const today = new Date().toISOString().split("T")[0];
      let existingQuery = supabase
        .from("checklist_responses")
        .select("id, total_score, created_at")
        .eq("link_id", link.id)
        .eq("response_date", today);

      if (link.template_id) {
        existingQuery = existingQuery.eq("template_id", link.template_id);
      }

      const { data: existingResponse } = await existingQuery.maybeSingle();

      return jsonResponse({
        success: true,
        data: {
          link_id: link.id,
          loja_id: link.loja_id,
          loja_name: link.config_lojas?.nome || "Unidade",
          sector_code: link.sector_code,
          template_id: link.template_id || null,
          template_name: templateName,
          items: items || [],
          already_submitted: !!existingResponse,
          existing_score: existingResponse?.total_score || null,
        },
      });
    }

    // ==================== SUBMIT ====================
    if (action === "submit") {
      if (!responses || !Array.isArray(responses)) {
        return jsonResponse({ success: false, error: "Responses array is required" }, 400);
      }

      // Validate non-conforming items have observations
      const missingObs = responses.filter((r: any) => r.is_conforming === false && (!r.observation || !r.observation.trim()));
      if (missingObs.length > 0) {
        return jsonResponse({ success: false, error: `${missingObs.length} item(ns) não conforme(s) sem observação. Observação é obrigatória para itens marcados como NÃO.` }, 400);
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

      const { data: response, error: responseError } = await supabase
        .from("checklist_responses")
        .insert({
          link_id: link.id,
          loja_id: link.loja_id,
          sector_code: link.sector_code,
          template_id: link.template_id || null,
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
        return jsonResponse({ success: false, error: "Failed to save response" }, 500);
      }

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

      return jsonResponse({
        success: true,
        data: {
          response_id: response.id,
          total_score: response.total_score,
          total_items: response.total_items,
          conforming_items: response.conforming_items,
          sector_code: link.sector_code,
          loja_name: link.config_lojas?.nome || "Unidade",
        },
      });
    }

    return jsonResponse({ success: false, error: "Invalid action. Use 'fetch', 'submit', or 'upload-photo'" }, 400);
  } catch (error) {
    console.error("Error in submit-daily-checklist:", error);
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
