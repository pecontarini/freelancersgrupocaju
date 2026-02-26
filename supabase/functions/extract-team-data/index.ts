// Excel/CSV files are sent as base64 to AI for extraction (no SheetJS needed server-side)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em extração de dados de RH. Sua tarefa é analisar este documento (imagem ou planilha bruta) e extrair uma lista de funcionários.

Retorne APENAS um JSON estrito no formato:
{ "employees": [{ "full_name": "string", "job_title": "string", "phone": "string" }] }

Regras de Limpeza:
1. Ignore cabeçalhos, rodapés, logos e linhas de totais.
2. Normalize nomes (Capitalize Cada Palavra). Exemplo: "JOAO DA SILVA" → "João Da Silva".
3. Normalize telefones para o formato brasileiro: (XX) XXXXX-XXXX. Se não houver DDD, deixe em branco.
4. Se o cargo não for claro, infira pelo contexto ou use "Staff".
5. Se a linha estiver incompleta, riscada, ou ilegível, ignore-a.
6. Se não encontrar nenhum funcionário, retorne { "employees": [] }.
7. Retorne APENAS o JSON, sem explicações ou markdown.`;

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function toBase64(buffer: ArrayBuffer): string {
  return btoa(
    new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAI(userContent: unknown[]): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      max_tokens: 8192,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("AI gateway error:", res.status, errText);

    if (res.status === 429) {
      throw new Error("RATE_LIMIT: Muitas requisições. Tente novamente em alguns segundos.");
    }
    if (res.status === 402) {
      throw new Error("PAYMENT_REQUIRED: Créditos de IA esgotados.");
    }
    throw new Error(`AI processing failed (${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function extractJSON(raw: string): { employees: { full_name: string; job_title: string; phone: string }[] } {
  let jsonStr = raw;

  // Strip markdown code fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  // Find outermost JSON object
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objMatch) throw new Error("AI did not return valid JSON.");

  const parsed = JSON.parse(objMatch[0]);

  if (!Array.isArray(parsed.employees)) {
    throw new Error("AI response missing employees array.");
  }

  return parsed;
}

async function processSpreadsheet(buffer: ArrayBuffer, mimeType: string, fileName: string) {
  console.log(`Processing spreadsheet: ${fileName}`);

  // For CSV files, decode as text and send directly
  if (fileName.endsWith(".csv")) {
    const text = new TextDecoder().decode(buffer);
    const preview = text.slice(0, 15000);
    console.log(`Sending CSV text to AI (${preview.length} chars)`);

    const content = await callAI([
      {
        type: "text",
        text: `Analise esta planilha CSV e extraia os funcionários conforme as regras.\n\nDados CSV:\n${preview}`,
      },
    ]);

    console.log("AI CSV response:", content.substring(0, 300));
    return extractJSON(content);
  }

  // For Excel files (.xls/.xlsx): read with a simple text extraction approach
  // Convert binary to base64 and try to extract readable text for AI processing
  const uint8 = new Uint8Array(buffer);
  
  // Try to extract readable strings from the binary Excel file
  const extractedText = extractReadableText(uint8);
  
  if (extractedText.length > 50) {
    console.log(`Extracted ${extractedText.length} chars of text from Excel, sending to AI as text`);
    const content = await callAI([
      {
        type: "text",
        text: `Analise este conteúdo extraído de uma planilha Excel e extraia os funcionários conforme as regras.\n\nConteúdo da planilha:\n${extractedText.slice(0, 15000)}`,
      },
    ]);
    console.log("AI Excel-text response:", content.substring(0, 300));
    return extractJSON(content);
  }

  // Fallback: send as base64 image (works for .xlsx but not .xls)
  const base64 = toBase64(buffer);
  const detectedMime = mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  
  // Skip if it's old .xls format (not supported by vision API)
  if (detectedMime === "application/vnd.ms-excel" || fileName.endsWith(".xls")) {
    throw new Error("Não foi possível extrair texto do arquivo .xls. Tente salvar como .xlsx ou .csv e enviar novamente.");
  }
  
  console.log(`Sending Excel as base64 to AI (${(buffer.byteLength / 1024).toFixed(0)}KB)`);

  const content = await callAI([
    {
      type: "text",
      text: "Analise este arquivo Excel e extraia a lista de funcionários conforme as regras.",
    },
    {
      type: "image_url",
      image_url: { url: `data:${detectedMime};base64,${base64}` },
    },
  ]);

  console.log("AI Excel response:", content.substring(0, 300));
  return extractJSON(content);
}

/**
 * Extract readable text strings from a binary file (works for .xls BIFF format).
 * Scans for sequences of printable characters separated by nulls or control chars.
 */
function extractReadableText(data: Uint8Array): string {
  const chunks: string[] = [];
  let current = "";
  
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    // Printable ASCII or common Latin-1 (accented chars)
    if ((byte >= 32 && byte <= 126) || (byte >= 192 && byte <= 255)) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= 3) {
        chunks.push(current.trim());
      }
      current = "";
    }
  }
  if (current.length >= 3) {
    chunks.push(current.trim());
  }
  
  // Deduplicate and filter noise
  const seen = new Set<string>();
  const meaningful: string[] = [];
  for (const chunk of chunks) {
    // Skip very short or purely numeric noise
    if (chunk.length < 2) continue;
    if (/^[\d\s.,-]+$/.test(chunk) && chunk.length < 5) continue;
    const key = chunk.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      meaningful.push(chunk);
    }
  }
  
  return meaningful.join(" | ");
}

async function processVisualDocument(buffer: ArrayBuffer, mimeType: string, fileName: string) {
  console.log(`Processing visual document: ${fileName} (${mimeType})`);

  const base64 = toBase64(buffer);
  const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(1);
  console.log(`File size: ${sizeMB}MB`);

  const content = await callAI([
    {
      type: "text",
      text: "Analise este documento e extraia a lista de funcionários conforme as regras.",
    },
    {
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64}` },
    },
  ]);

  console.log("AI vision response:", content.substring(0, 300));
  return extractJSON(content);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return jsonResponse({ error: "Nenhum arquivo enviado." }, 400);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = file.type || "application/octet-stream";
    const buffer = await file.arrayBuffer();

    console.log(`Received: ${file.name} (${ext}, ${mimeType}, ${Math.round(buffer.byteLength / 1024)}KB)`);

    let result: { employees: { full_name: string; job_title: string; phone: string }[] };

    if (["xlsx", "xls", "csv"].includes(ext)) {
      result = await processSpreadsheet(buffer, mimeType, file.name);
    } else if (ext === "pdf" || mimeType === "application/pdf") {
      result = await processVisualDocument(buffer, "application/pdf", file.name);
    } else if (["png", "jpg", "jpeg", "webp"].includes(ext) || mimeType.startsWith("image/")) {
      result = await processVisualDocument(buffer, mimeType, file.name);
    } else {
      return jsonResponse(
        { error: `Formato não suportado: .${ext}. Use Excel, CSV, PDF ou imagem.` },
        400
      );
    }

    console.log(`Extracted ${result.employees.length} employees`);

    return jsonResponse({ employees: result.employees });
  } catch (error) {
    console.error("extract-team-data error:", error);

    const message = error instanceof Error ? error.message : "Erro ao processar arquivo.";

    if (message.startsWith("RATE_LIMIT:")) {
      return jsonResponse({ error: message.replace("RATE_LIMIT: ", "") }, 429);
    }
    if (message.startsWith("PAYMENT_REQUIRED:")) {
      return jsonResponse({ error: message.replace("PAYMENT_REQUIRED: ", "") }, 402);
    }

    return jsonResponse({ error: message }, 500);
  }
});
