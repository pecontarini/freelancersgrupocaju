import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RegistryItem {
  cargo: string;
  periodo?: string;
  indicador: string;
  loja_code: string;
  loja_nome: string;
  resultado: number | null;
  payout_brl: number | null;
  breakpoint_desc: string | null;
}
export interface ConsolidatedItem {
  cargo: string;
  loja_code: string;
  loja_nome: string;
  payout_total_brl: number | null;
}
export interface TargetItem {
  cargo: string;
  remuneracao_total: number | null;
  metas: { meta: string; valor: number | null }[];
}
export interface RulesItem {
  cargo?: string;
  meta?: string;
  breakpoint?: string;
  descricao?: string;
  payout?: number | null;
}

export interface PayoutSnapshot {
  consolidated: ConsolidatedItem[];
  registry: RegistryItem[];
  rules: RulesItem[];
  target_by_role: TargetItem[];
  last_sync: string | null;
  mes_ref: string | null;
  sources: Record<string, { id: string; ultima_sincronizacao: string | null; ultimo_status: string | null; nome: string; url: string }>;
}

function unwrapItems<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as { items?: T[] };
  return Array.isArray(obj.items) ? obj.items : [];
}

export function usePayoutSnapshot() {
  const [data, setData] = useState<PayoutSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("get-payout-snapshot", {
        body: {},
      });
      if (error) throw error;
      setData({
        consolidated: unwrapItems<ConsolidatedItem>(res?.consolidated),
        registry: unwrapItems<RegistryItem>(res?.registry),
        rules: unwrapItems<RulesItem>(res?.rules),
        target_by_role: unwrapItems<TargetItem>(res?.target_by_role),
        last_sync: res?.last_sync ?? null,
        mes_ref: res?.mes_ref ?? null,
        sources: res?.sources ?? {},
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncAll = useCallback(async () => {
    if (!data) return;
    setSyncing(true);
    setError(null);
    try {
      const ids = Object.values(data.sources).map((s) => s.id).filter(Boolean);
      const results = await Promise.allSettled(
        ids.map((sourceId) =>
          supabase.functions.invoke("sync-sheets-staging", { body: { sourceId } })
        )
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length) {
        throw new Error(`${failures.length} fonte(s) falharam`);
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      throw e;
    } finally {
      setSyncing(false);
    }
  }, [data, load]);

  return { data, loading, error, syncing, reload: load, syncAll };
}

export function normalizeLojaCode(s: string | null | undefined): string {
  return (s ?? "")
    .toString()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "_")
    .trim();
}
