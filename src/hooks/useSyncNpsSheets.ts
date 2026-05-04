/**
 * Sincroniza NPS real a partir de planilhas Google públicas (gviz JSON).
 * Faz upsert em metas_snapshot (loja_codigo, mes_ref).
 *
 * NPS = faturamento_total / numero_reclamacoes
 */
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { currentMesRef } from "@/lib/metasUtils";

/** IDs das planilhas mensais (públicas — qualquer pessoa com link visualiza). */
const SHEET_IDS_BY_MONTH: Record<string, string> = {
  "2026-01": "16sCd_REPLACE_WITH_FULL_ID",
  "2026-02": "11ZCL_REPLACE_WITH_FULL_ID",
  "2026-03": "1eUfkonq-qHBcSXglphiZBCpn5_43EobaS6QkRzPvrZU",
  "2026-04": "1E1eJiNPVp5x-JWxgXd0KWRhhLpVUZd-VeoLKq52UFgQ",
  "2026-05": "1E1eJiNPVp5x-JWxgXd0KWRhhLpVUZd-VeoLKq52UFgQ",
};

/** Aliases de nome de loja → loja_codigo padrão usado em metas_snapshot. */
const LOJA_ALIAS: Record<string, string> = {
  // Caminito Parrilla
  "MULT 03": "CP_SG",
  "CAMINITO SIG": "CP_SG",
  "CPSG": "CP_SG",
  "MULT 05": "CP_AN",
  "CAMINITO ASA NORTE": "CP_AN",
  "CPAN": "CP_AN",
  "MULT 12": "CP_AC",
  "CAMINITO AGUAS CLARAS": "CP_AC",
  "CAMINITO ÁGUAS CLARAS": "CP_AC",
  "CPAC": "CP_AC",
  "MULT 14": "CP_AS",
  "CAMINITO ASA SUL": "CP_AS",
  "CPAS": "CP_AS",
  // Nazo
  "NFE 01": "NZ_AS",
  "NAZO ASA SUL": "NZ_AS",
  "NZAS": "NZ_AS",
  "NFE 03": "NZ_AC",
  "NAZO AGUAS CLARAS": "NZ_AC",
  "NAZO ÁGUAS CLARAS": "NZ_AC",
  "NZAC": "NZ_AC",
  "NFE 04": "NZ_SG",
  "NAZO SIG": "NZ_SG",
  "NZSG": "NZ_SG",
  "MULT 02": "NZ_GO",
  "NAZO GO": "NZ_GO",
  "NAZO GOIANIA": "NZ_GO",
  "NZGO": "NZ_GO",
  // Caju
  "CAJU 01": "CJ_AN",
  "CAJU ASA NORTE": "CJ_AN",
  "CJAN": "CJ_AN",
  "CAJU 03": "CJ_SG",
  "CAJU SIG": "CJ_SG",
  "CJSG": "CJ_SG",
};

function normalizeKey(s: string): string {
  return (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchLojaCodigo(raw: string): string | null {
  const norm = normalizeKey(raw);
  if (LOJA_ALIAS[norm]) return LOJA_ALIAS[norm];
  // tenta encontrar substring de alias
  for (const [alias, code] of Object.entries(LOJA_ALIAS)) {
    if (norm.includes(alias)) return code;
  }
  return null;
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

interface ParsedRow {
  loja_codigo: string;
  faturamento: number;
  reclamacoes: number;
  nps: number;
}

/**
 * Busca planilha pública via gviz e converte em linhas de NPS.
 * Heurística de colunas: procura headers contendo "loja"/"unidade",
 * "faturamento"/"vendas"/"receita", "reclamac"/"reclam".
 */
async function fetchSheetNps(sheetId: string): Promise<ParsedRow[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar planilha ${sheetId}`);
  const text = await res.text();
  // Resposta vem como: /*O_o*/google.visualization.Query.setResponse({...});
  const match = text.match(/setResponse\(([\s\S]+)\);?\s*$/);
  if (!match) throw new Error("Formato gviz inesperado");
  const json = JSON.parse(match[1]);
  const cols: Array<{ label?: string; type?: string }> = json.table?.cols ?? [];
  const rows: Array<{ c: Array<{ v?: unknown; f?: string } | null> }> = json.table?.rows ?? [];

  const labels = cols.map((c) => normalizeKey(c.label ?? ""));
  const findCol = (...keys: string[]) =>
    labels.findIndex((l) => keys.some((k) => l.includes(k)));

  const idxLoja = findCol("LOJA", "UNIDADE", "RESTAURANTE");
  const idxFat = findCol("FATURAMENTO", "VENDAS", "RECEITA", "FAT");
  const idxRecl = findCol("RECLAMAC", "RECLAM");

  if (idxLoja < 0 || idxFat < 0 || idxRecl < 0) {
    throw new Error(
      `Colunas não encontradas. Headers: ${labels.filter(Boolean).join(" | ") || "(vazio)"}`,
    );
  }

  const out: ParsedRow[] = [];
  for (const r of rows) {
    const lojaRaw = String(r.c?.[idxLoja]?.v ?? r.c?.[idxLoja]?.f ?? "");
    const code = matchLojaCodigo(lojaRaw);
    if (!code) continue;
    const fat = parseNumber(r.c?.[idxFat]?.v ?? r.c?.[idxFat]?.f);
    const recl = parseNumber(r.c?.[idxRecl]?.v ?? r.c?.[idxRecl]?.f);
    if (!fat || !recl || recl <= 0) continue;
    out.push({ loja_codigo: code, faturamento: fat, reclamacoes: recl, nps: fat / recl });
  }
  return out;
}

/** Mês anterior em formato "YYYY-MM". */
function prevMesRef(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface UseSyncReturn {
  syncing: boolean;
  lastSync: Date | null;
  error: string | null;
  triggerSync: () => Promise<void>;
}

export function useSyncNpsSheets(mesRef: string = currentMesRef()): UseSyncReturn {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const sheetId = SHEET_IDS_BY_MONTH[mesRef];
      if (!sheetId || sheetId.includes("REPLACE_WITH_FULL_ID")) {
        throw new Error(
          `Planilha do mês ${mesRef} não configurada. Atualize SHEET_IDS_BY_MONTH em useSyncNpsSheets.ts`,
        );
      }

      const rows = await fetchSheetNps(sheetId);
      if (rows.length === 0) throw new Error("Nenhuma loja reconhecida na planilha.");

      // Buscar valor anterior (mês passado) para preencher nps_anterior
      const prev = prevMesRef(mesRef);
      const { data: prevRows } = await supabase
        .from("metas_snapshot")
        .select("loja_codigo, nps")
        .eq("mes_ref", prev);
      const prevMap = new Map((prevRows ?? []).map((r) => [r.loja_codigo, r.nps as number | null]));

      const payload = rows.map((r) => ({
        loja_codigo: r.loja_codigo,
        mes_ref: mesRef,
        nps: Math.round(r.nps),
        nps_anterior: prevMap.get(r.loja_codigo) ?? null,
      }));

      const { error: upErr } = await supabase
        .from("metas_snapshot")
        .upsert(payload, { onConflict: "loja_codigo,mes_ref" });
      if (upErr) throw upErr;

      setLastSync(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao sincronizar NPS");
    } finally {
      setSyncing(false);
    }
  }, [mesRef]);

  return { syncing, lastSync, error, triggerSync };
}
