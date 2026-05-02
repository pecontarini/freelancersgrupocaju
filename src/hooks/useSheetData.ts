import { useState, useEffect, useCallback, useRef } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";

type SheetKey =
  | "checklist_geral"
  | "checklist_chefias"
  | "nps_dashboard"
  | "nps_fechamento"
  | "avaliacoes_fat"
  | "base_avaliacoes"
  | "nps_base";

interface UseSheetDataResult {
  data: Record<string, string>[];
  raw: string;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

export function useSheetData(sheetKey: SheetKey, autoRefreshMinutes = 5): UseSheetDataResult {
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-sheets-data`;

      const res = await fetch(`${baseUrl}?sheet=${sheetKey}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);

      const csvText = await res.text();
      if (["nps_base", "base_avaliacoes", "nps_dashboard"].includes(sheetKey)) {
        console.log(`\n=== RAW CSV [${sheetKey}] primeiras 20 linhas ===`);
        console.log(csvText.split("\n").slice(0, 20).join("\n"));
      }
      setRaw(csvText);

      const parsed = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });

      setData(parsed.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [sheetKey]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, autoRefreshMinutes * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, autoRefreshMinutes]);

  return { data, raw, loading, error, lastUpdated, refetch: fetchData };
}
