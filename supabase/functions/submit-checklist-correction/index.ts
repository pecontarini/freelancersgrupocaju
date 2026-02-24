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

    const body = await req.json();
    const { action, response_id, access_token } = body;

    if (!access_token || !response_id) {
      return jsonResponse({ success: false, error: "access_token and response_id are required" }, 400);
    }

    // Validate access_token
    const { data: link, error: linkError } = await supabase
      .from("checklist_sector_links")
      .select("*, config_lojas:loja_id(nome)")
      .eq("access_token", access_token)
      .eq("is_active", true)
      .single();

    if (linkError || !link) {
      return jsonResponse({ success: false, error: "Link inválido ou inativo" }, 404);
    }

    // Validate response belongs to this link
    const { data: response, error: responseError } = await supabase
      .from("checklist_responses")
      .select("id, link_id, loja_id, sector_code, response_date, total_score, responded_by_name")
      .eq("id", response_id)
      .eq("link_id", link.id)
      .single();

    if (responseError || !response) {
      return jsonResponse({ success: false, error: "Resposta não encontrada ou não pertence a este link" }, 404);
    }

    // ==================== FETCH ====================
    if (action === "fetch") {
      const { data: ncItems, error: ncError } = await supabase
        .from("checklist_response_items")
        .select("id, is_conforming, observation, photo_url, checklist_template_items(item_text, weight)")
        .eq("response_id", response_id)
        .eq("is_conforming", false);

      if (ncError) {
        console.error("Error fetching NC items:", ncError);
        return jsonResponse({ success: false, error: "Erro ao buscar itens" }, 500);
      }

      const { data: corrections } = await supabase
        .from("checklist_corrections")
        .select("*")
        .eq("response_id", response_id);

      const correctionsMap: Record<string, any> = {};
      (corrections || []).forEach((c: any) => {
        correctionsMap[c.response_item_id] = c;
      });

      const itemsWithCorrections = (ncItems || []).map((item: any) => ({
        ...item,
        correction: correctionsMap[item.id] || null,
      }));

      return jsonResponse({
        success: true,
        data: {
          loja_name: link.config_lojas?.nome || "Unidade",
          sector_code: response.sector_code,
          response_date: response.response_date,
          total_score: response.total_score,
          responded_by_name: response.responded_by_name,
          nc_items: itemsWithCorrections,
          total_nc: itemsWithCorrections.length,
          corrected_count: itemsWithCorrections.filter((i: any) => i.correction).length,
        },
      });
    }

    // ==================== UPLOAD PHOTO ====================
    if (action === "upload-photo") {
      const { file_base64, file_name } = body;
      if (!file_base64 || !file_name) {
        return jsonResponse({ success: false, error: "file_base64 and file_name are required" }, 400);
      }

      const ext = (file_name as string).split(".").pop()?.toLowerCase() || "";
      if (!["jpg", "jpeg", "png", "webp", "heic"].includes(ext)) {
        return jsonResponse({ success: false, error: "Formato não suportado. Use JPG, PNG ou WebP." }, 400);
      }

      const binaryStr = atob(file_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      if (bytes.length > 5 * 1024 * 1024) {
        return jsonResponse({ success: false, error: "Arquivo muito grande. Máximo 5MB." }, 400);
      }

      const filePath = `corrections/${response_id}/${crypto.randomUUID()}.${ext}`;
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

    // ==================== SUBMIT ====================
    if (action === "submit") {
      const { response_item_id, corrected_by_name, correction_photo_url, correction_note } = body;

      if (!response_item_id) {
        return jsonResponse({ success: false, error: "response_item_id is required" }, 400);
      }
      if (!corrected_by_name || !corrected_by_name.trim()) {
        return jsonResponse({ success: false, error: "Nome de quem corrigiu é obrigatório" }, 400);
      }
      if (!correction_photo_url || !correction_photo_url.trim()) {
        return jsonResponse({ success: false, error: "Foto da correção é obrigatória" }, 400);
      }

      // Verify the item belongs to this response and is non-conforming
      const { data: item, error: itemError } = await supabase
        .from("checklist_response_items")
        .select("id, is_conforming")
        .eq("id", response_item_id)
        .eq("response_id", response_id)
        .eq("is_conforming", false)
        .single();

      if (itemError || !item) {
        return jsonResponse({ success: false, error: "Item não encontrado ou não é não conforme" }, 404);
      }

      // Check if already corrected
      const { data: existing } = await supabase
        .from("checklist_corrections")
        .select("id")
        .eq("response_item_id", response_item_id)
        .maybeSingle();

      if (existing) {
        return jsonResponse({ success: false, error: "Este item já foi corrigido" }, 409);
      }

      // Insert correction
      const { data: correction, error: corrError } = await supabase
        .from("checklist_corrections")
        .insert({
          response_item_id,
          response_id,
          loja_id: response.loja_id,
          corrected_by_name: corrected_by_name.trim(),
          correction_photo_url,
          correction_note: correction_note?.trim() || null,
          corrected_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (corrError) {
        console.error("Error inserting correction:", corrError);
        return jsonResponse({ success: false, error: "Erro ao salvar correção" }, 500);
      }

      return jsonResponse({
        success: true,
        data: correction,
      });
    }

    return jsonResponse({ success: false, error: "Invalid action. Use 'fetch', 'upload-photo', or 'submit'" }, 400);
  } catch (error) {
    console.error("Error in submit-checklist-correction:", error);
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
