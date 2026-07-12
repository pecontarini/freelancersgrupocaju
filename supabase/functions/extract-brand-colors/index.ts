import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Extrai as cores da marca (em HSL) de uma imagem de logo usando Lovable AI (Gemini vision).
// Input: { imageDataUrl: "data:image/png;base64,..." } OU { imageUrl: "https://..." }
// Output: { primary, primaryStrong, accent } — strings HSL no formato "H S% L%".

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const imageUrl: string | undefined = body?.imageDataUrl || body?.imageUrl;
    if (!imageUrl || typeof imageUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageDataUrl ou imageUrl é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      "Você é um designer de marca. Analise a logo enviada e identifique as cores principais da identidade visual. " +
      "Retorne SEMPRE um JSON com exatamente 3 campos: primary, primaryStrong, accent. " +
      "Cada valor deve ser uma string HSL no formato 'H S% L%' (sem 'hsl()', sem vírgulas, apenas números com o símbolo de porcentagem). " +
      "Exemplo: '20 74% 48%'. " +
      "- primary: a cor de marca mais dominante e reconhecível (ignore preto/branco/cinza puros salvo se for a única cor da marca).\n" +
      "- primaryStrong: a mesma cor primária ~10-15% mais escura (para hover/press).\n" +
      "- accent: uma cor secundária ou de destaque presente na logo; se não houver, retorne a mesma primary.";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia as cores principais desta logo e devolva o JSON." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error(`AI gateway error [${aiRes.status}]:`, errText);
      return new Response(
        JSON.stringify({ error: "AI request failed", status: aiRes.status, details: errText }),
        { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      // Alguns modelos podem envolver em texto — tenta extrair primeiro objeto JSON
      const match = content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    const hslRe = /^\s*\d{1,3}\s+\d{1,3}%\s+\d{1,3}%\s*$/;
    const primary = typeof parsed.primary === "string" && hslRe.test(parsed.primary) ? parsed.primary.trim() : null;
    const primaryStrong =
      typeof parsed.primaryStrong === "string" && hslRe.test(parsed.primaryStrong)
        ? parsed.primaryStrong.trim()
        : null;
    const accent = typeof parsed.accent === "string" && hslRe.test(parsed.accent) ? parsed.accent.trim() : null;

    if (!primary) {
      return new Response(
        JSON.stringify({ error: "AI não retornou cores válidas", raw: content }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        primary,
        primaryStrong: primaryStrong ?? primary,
        accent: accent ?? primary,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("extract-brand-colors error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
