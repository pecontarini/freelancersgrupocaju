/**
 * Wrapper que injeta o bloco "Sua Loja · Últimos 6 meses" abaixo de qualquer view.
 * Limita-se à `effectiveUnidadeId` do usuário (ou seletor local p/ admin).
 */
import { useUnidade } from "@/contexts/UnidadeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SixMonthsCard } from "./SixMonthsCard";
import { useSixMonthsSeries } from "./useSixMonthsSeries";
import type { MetaKey } from "./types";

interface SixMonthsForUserUnitProps {
  metaKey: MetaKey;
  mes: string;
}

export function SixMonthsForUserUnit({ metaKey, mes }: SixMonthsForUserUnitProps) {
  const { effectiveUnidadeId } = useUnidade();

  const lojaQ = useQuery({
    enabled: !!effectiveUnidadeId,
    queryKey: ["painel-six-months-loja", effectiveUnidadeId],
    queryFn: async () => {
      if (!effectiveUnidadeId) return null;
      const { data, error } = await supabase
        .from("config_lojas")
        .select("nome")
        .eq("id", effectiveUnidadeId)
        .maybeSingle();
      if (error) throw error;
      return (data?.nome as string | undefined) ?? null;
    },
  });

  const seriesQ = useSixMonthsSeries({ metaKey, unidadeId: effectiveUnidadeId, mes });

  if (!effectiveUnidadeId) {
    return null;
  }

  return (
    <SixMonthsCard
      metaKey={metaKey}
      series={seriesQ.data ?? []}
      loading={seriesQ.isLoading}
      unitName={lojaQ.data ?? null}
    />
  );
}
