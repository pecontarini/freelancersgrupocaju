const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert file to base64 for the AI API
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const mimeType = file.type || "application/octet-stream";
    const isPdf = mimeType === "application/pdf";
    const isImage = mimeType.startsWith("image/");

    if (!isPdf && !isImage) {
      return new Response(
        JSON.stringify({ error: "Unsupported file type. Send PDF or image." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${file.name} (${mimeType}, ${Math.round(arrayBuffer.byteLength / 1024)}KB)`);

    // Use Lovable AI (Gemini) for extraction - no API key needed
    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY") || ""}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise este documento. Extraia uma lista estruturada JSON contendo todos os funcionários/pessoas encontrados.

O formato deve ser EXATAMENTE:
{ "employees": [{ "name": "Nome Completo", "role": "Cargo", "phone": "Telefone" }] }

Regras:
- Ignore cabeçalhos, rodapés, títulos de tabela
- Se não encontrar telefone, use string vazia
- Se não encontrar cargo, use string vazia
- Retorne APENAS o JSON, sem explicações
- Se não encontrar nenhuma pessoa, retorne { "employees": [] }`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `AI processing failed (${aiResponse.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    console.log("AI raw response:", content.substring(0, 500));

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON object in the text
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objMatch) {
      console.error("No JSON found in AI response");
      return new Response(
        JSON.stringify({ error: "A IA não retornou dados válidos.", employees: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(objMatch[0]);

    console.log(`Extracted ${parsed.employees?.length || 0} employees`);

    return new Response(
      JSON.stringify({ employees: parsed.employees || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing staff list:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
