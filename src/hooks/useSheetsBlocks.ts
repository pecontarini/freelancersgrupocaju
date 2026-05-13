import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SheetsBlock {
  block_key: string;
  block_type: string;
  payload: any;
  ordem: number | null;
}

/**
 * Fetches all blocks for a given sheets_sources.meta_key.
 * Returns blocks ordered by `ordem` then `block_key`.
 */
export function useSheetsBlocks(metaKey: string | null) {
  const [blocks, setBlocks] = useState<SheetsBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!metaKey) {
      setBlocks([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: src, error: e1 } = await supabase
          .from("sheets_sources")
          .select("id")
          .eq("meta_key", metaKey)
          .maybeSingle();
        if (e1) throw e1;
        if (!src?.id) {
          if (!cancelled) setBlocks([]);
          return;
        }
        const { data, error: e2 } = await supabase
          .from("sheets_blocks_snapshot")
          .select("block_key, block_type, payload, ordem")
          .eq("source_id", src.id)
          .order("ordem", { ascending: true, nullsFirst: false })
          .order("block_key", { ascending: true });
        if (e2) throw e2;
        if (!cancelled) setBlocks((data ?? []) as SheetsBlock[]);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Falha ao carregar blocos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [metaKey]);

  return { blocks, loading, error };
}
