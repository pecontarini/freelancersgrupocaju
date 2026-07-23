import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useUnidade } from "@/contexts/UnidadeContext";

/**
 * Retorna quantas solicitações de freelancer estão pendentes para o tenant
 * e (opcionalmente) para a unidade ativa. Faz refetch periódico e escuta
 * inserts em tempo real para disparar um toast quando uma nova solicitação
 * chega enquanto o gestor está com o portal aberto.
 */
export function usePendingSolicitacoes() {
  const { tenantId } = useTenant();
  const { effectiveUnidadeId } = useUnidade();
  const queryClient = useQueryClient();
  const knownCount = useRef<number | null>(null);

  const query = useQuery({
    queryKey: ["pending-solicitacoes", tenantId, effectiveUnidadeId],
    queryFn: async () => {
      if (!tenantId) return 0;
      let q = supabase
        .from("freelancer_entries")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "pendente");
      if (effectiveUnidadeId) q = q.eq("loja_id", effectiveUnidadeId);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`pending-solicitacoes-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "freelancer_entries",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (row?.status !== "pendente") return;
          if (effectiveUnidadeId && row?.loja_id !== effectiveUnidadeId) return;
          toast.info("Nova solicitação de freelancer", {
            description: `${row.loja ?? ""} · ${row.setor ?? ""} · ${row.funcao ?? ""}`.trim(),
          });
          queryClient.invalidateQueries({ queryKey: ["pending-solicitacoes"] });
          queryClient.invalidateQueries({ queryKey: ["freelancer-entries"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, effectiveUnidadeId, queryClient]);

  useEffect(() => {
    if (query.data != null) knownCount.current = query.data;
  }, [query.data]);

  return query;
}
