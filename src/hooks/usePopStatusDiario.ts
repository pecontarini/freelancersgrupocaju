import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PopStatus = "VERMELHO" | "AMARELO" | "VERDE_RESSALVA" | "VERDE_PURO";

export interface PopStatusRow {
  data_referencia: string;
  unit_id: string;
  unit_nome: string;
  brand: string | null;
  sector_id: string;
  sector_name: string;
  dia_semana: "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB" | "DOM" | string;
  refeicao: "ALMOCO" | "JANTAR" | string;
  pop_clt: number;
  pop_free: number;
  pop_total: number;
  escalados_clt: number;
  ponto_clt: number;
  checkin_free: number;
  total_real: number;
  status: PopStatus;
  status_detalhe: string | null;
}

// Worst → best ordering. Lower index = worse.
const STATUS_ORDER: PopStatus[] = ["VERMELHO", "AMARELO", "VERDE_RESSALVA", "VERDE_PURO"];

export function aggregateStatus(rows: { status: PopStatus }[]): PopStatus | null {
  if (rows.length === 0) return null;
  let worstIdx = STATUS_ORDER.length - 1;
  for (const r of rows) {
    const idx = STATUS_ORDER.indexOf(r.status);
    if (idx >= 0 && idx < worstIdx) worstIdx = idx;
  }
  return STATUS_ORDER[worstIdx];
}

export function usePopStatusDiario(data: string) {
  return useQuery<PopStatusRow[]>({
    queryKey: ["pop-status-diario", data],
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc("pop_status_diario" as any, {
        p_data: data,
      });
      if (error) throw error;
      return (rows as unknown as PopStatusRow[]) || [];
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
