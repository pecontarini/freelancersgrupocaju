import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QuadroStatus = "PRESENTE" | "ATRASO" | "AGUARDANDO" | "AUSENTE";

export interface QuadroDetalhadoRow {
  schedule_id: string;
  employee_id: string;
  employee_name: string;
  sector_id: string;
  sector_name: string;
  unit_id: string;
  shift_id: string;
  shift_name: string;
  refeicao: "ALMOCO" | "JANTAR" | string;
  effective_start_time: string;
  effective_end_time: string;
  scheduled_start_ts: string;
  scheduled_end_ts: string;
  punch_in_ts: string | null;
  punch_in_hora: string | null;
  scheduled_inicio_hora: string;
  scheduled_fim_hora: string;
  status: QuadroStatus;
  atraso_minutos: number | null;
}

export function useQuadroDetalhado(data: string, unitId: string | null) {
  return useQuery<QuadroDetalhadoRow[]>({
    queryKey: ["quadro-detalhado", data, unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc("pop_quadro_detalhado" as any, {
        p_data: data,
        p_unit_id: unitId,
      });
      if (error) throw error;
      return (rows as unknown as QuadroDetalhadoRow[]) || [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
