const SHEETS: Record<string, string> = {
  checklist_geral: "https://docs.google.com/spreadsheets/d/1tXHt7Frhy0WBr0Eu2qomeT0fboUY5auVTvSZhcSwhOI/gviz/tq?tqx=out:csv&sheet=GERAL%20E%20GERENTES",
  checklist_chefias: "https://docs.google.com/spreadsheets/d/1tXHt7Frhy0WBr0Eu2qomeT0fboUY5auVTvSZhcSwhOI/gviz/tq?tqx=out:csv&sheet=CHEFIAS",
  nps_dashboard: "https://docs.google.com/spreadsheets/d/138MkoGLwTM10q8I_9hQCyOpeVQy2UhcB/export?format=csv&gid=217378318",
  nps_fechamento: "https://docs.google.com/spreadsheets/d/138MkoGLwTM10q8I_9hQCyOpeVQy2UhcB/export?format=csv&gid=214546988",
  avaliacoes_fat: "https://docs.google.com/spreadsheets/d/1E1eJiNPVp5x-JWxgXd0KWRhhLpVUZd-VeoLKq52UFgQ/gviz/tq?tqx=out:csv&sheet=01%2F04%20-%2030%2F04",
  base_avaliacoes: "https://docs.google.com/spreadsheets/d/1uLYveHZ1iNkbIo0z6r-zS6iWIk7qSuc-/export?format=csv&gid=1923524717",
  nps_base: "https://docs.google.com/spreadsheets/d/138MkoGLwTM10q8I_9hQCyOpeVQy2UhcB/export?format=csv&gid=899334411",
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const sheet = url.searchParams.get("sheet");

  if (!sheet || !(sheet in SHEETS)) {
    return new Response(JSON.stringify({ error: "sheet inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(SHEETS[sheet], {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "falha ao buscar planilha" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csv = await res.text();
    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "falha ao buscar planilha" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
