import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseScore(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

interface PDFExtractionResult {
  score: number | null;
  auditDate: string | null;
  checklistType: string;
  author: string | null;
}

async function extractFromPdfWithAI(pdfUrl: string, apiKey: string): Promise<PDFExtractionResult> {
  // Download PDF and convert to base64
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
  
  const pdfBuffer = await pdfResponse.arrayBuffer();
  const pdfBytes = new Uint8Array(pdfBuffer);
  
  // Use Deno's built-in base64 encoding
  const encoder = new TextEncoder();
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < pdfBytes.length; i += chunkSize) {
    const chunk = pdfBytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const pdfBase64 = btoa(binary);

  const prompt = `Analise este PDF de checklist e extraia APENAS em JSON:
{"score": <nota decimal>, "audit_date": "YYYY-MM-DD", "checklist_type": "SUPERVISOR|FISCAL|AUDITORIA_DE_ALIMENTOS", "author": "nome"}
Regras: SUPERVISOR DE BACK/FRONT→SUPERVISOR, FISCAL→FISCAL, Alimentos→AUDITORIA_DE_ALIMENTOS.
Nota: campo "Nota do checklist" ou percentual em destaque. Vírgula→ponto.
Data: "Sincronizado em DD/MM/YYYY"→YYYY-MM-DD. Retorne APENAS JSON.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia dados deste PDF de auditoria." },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI error ${response.status}: ${errText.substring(0, 200)}`);
  }

  const aiResult = await response.json();
  const content = aiResult.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    score: typeof parsed.score === 'number' ? parsed.score : parseScore(String(parsed.score || '')),
    auditDate: parsed.audit_date || null,
    checklistType: parsed.checklist_type || 'SUPERVISOR',
    author: parsed.author || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();
    const { action = 'process_single', audit_id, pdf_url, old_score, dry_run = false, loja_id, month_year } = body;

    // ACTION: list - Return all audits with PDFs for client-side orchestration
    if (action === 'list') {
      let query = supabase
        .from('supervision_audits')
        .select('id, loja_id, audit_date, global_score, pdf_url')
        .not('pdf_url', 'is', null);

      if (loja_id) query = query.eq('loja_id', loja_id);
      if (month_year) {
        const [year, month] = month_year.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        query = query.gte('audit_date', startDate).lte('audit_date', `${year}-${month}-${lastDay}`);
      }

      const { data: audits, error } = await query.order('audit_date', { ascending: true });
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, audits: audits || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: process_single - Process ONE PDF
    if (action === 'process_single') {
      if (!audit_id || !pdf_url) {
        return new Response(
          JSON.stringify({ success: false, error: "audit_id and pdf_url required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fileName = pdf_url.split('/').pop() || 'unknown.pdf';
      console.log(`[scan] Processing: ${fileName}`);

      const extraction = await extractFromPdfWithAI(pdf_url, apiKey);

      if (extraction.score === null) {
        return new Response(
          JSON.stringify({
            success: true,
            status: 'skipped',
            file_name: fileName,
            message: 'Nota não encontrada no PDF',
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const scoreChanged = Math.abs(extraction.score - (old_score || 0)) > 0.01;

      if (!dry_run && scoreChanged) {
        const { error: updateError } = await supabase
          .from('supervision_audits')
          .update({ global_score: extraction.score })
          .eq('id', audit_id);
        if (updateError) throw updateError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: scoreChanged ? (dry_run ? 'would_update' : 'updated') : 'unchanged',
          file_name: fileName,
          old_score: old_score || 0,
          new_score: extraction.score,
          checklist_type: extraction.checklistType,
          author: extraction.author,
          message: scoreChanged
            ? `${(old_score || 0).toFixed(1)} → ${extraction.score.toFixed(1)} (${extraction.checklistType})`
            : `Nota correta: ${extraction.score.toFixed(1)} (${extraction.checklistType})`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: recalculate - Trigger leadership recalculation
    if (action === 'recalculate') {
      const recalcBody: Record<string, string> = { action: 'backfill', trigger_type: 'pdf_miner' };
      if (loja_id) recalcBody.loja_id = loja_id;
      if (month_year) recalcBody.month_year = month_year;

      const { data: recalc, error: recalcError } = await supabase.functions.invoke(
        'calculate-leadership-performance',
        { body: recalcBody }
      );

      if (recalcError) throw recalcError;

      return new Response(
        JSON.stringify({ success: true, recalculation: recalc }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[scan] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
