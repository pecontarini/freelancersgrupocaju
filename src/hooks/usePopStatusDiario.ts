import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePopDiario } from "./usePopDiario";

/**
 * SHIM — preserva a API legada de `usePopStatusDiario` mas alimenta
 * tudo a partir de `vw_pop_diario` (Etapa B do POP Diário Unificado).
 *
 * Não criar novos consumidores deste hook. Para código novo, use `usePopDiario`.
 */

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

const DOW_TO_ENUM: Record<number, PopStatusRow["dia_semana"]> = {
  0: "DOM",
  1: "SEG",
  2: "TER",
  3: "QUA",
  4: "QUI",
  5: "SEX",
  6: "SAB",
};

function deriveStatus(
  saldo: number,
  escalados: number,
  status: "conforme" | "inconforme" | "aguardando",
): PopStatus {
  if (status === "aguardando") return "AMARELO";
  if (escalados === 0 && saldo > 0) return "AMARELO";
  if (saldo <= -2) return "VERMELHO";
  if (saldo < 0) return "AMARELO";
  if (saldo === 0) return "VERDE_PURO";
  return "VERDE_RESSALVA";
}

interface LookupBundle {
  units: Map<string, { nome: string; brand: string | null }>;
  sectors: Map<string, string>;
}

function usePopLookups() {
  return useQuery<LookupBundle>({
    queryKey: ["pop-lookups"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [{ data: units }, { data: sectors }] = await Promise.all([
        supabase.from("config_lojas").select("id, nome, brand"),
        supabase.from("sectors").select("id, name"),
      ]);
      const u = new Map<string, { nome: string; brand: string | null }>();
      for (const row of (units as any[]) || []) {
        u.set(row.id, { nome: row.nome, brand: row.brand ?? null });
      }
      const s = new Map<string, string>();
      for (const row of (sectors as any[]) || []) {
        s.set(row.id, row.name);
      }
      return { units: u, sectors: s };
    },
  });
}

export function usePopStatusDiario(data: string) {
  const pop = usePopDiario({ date: data });
  const lookups = usePopLookups();

  const ready = !pop.isLoading && !lookups.isLoading && !!lookups.data;
  const rows: PopStatusRow[] = !ready
    ? []
    : pop.rows.map((r) => {
        const unit = lookups.data!.units.get(r.unit_id);
        const sector = lookups.data!.sectors.get(r.sector_id);
        const dow = new Date(`${r.schedule_date}T00:00:00`).getDay();
        const popStatus = deriveStatus(r.saldo_final, r.escalados, r.status);
        return {
          data_referencia: r.schedule_date,
          unit_id: r.unit_id,
          unit_nome: unit?.nome ?? "",
          brand: unit?.brand ?? null,
          sector_id: r.sector_id,
          sector_name: sector ?? "",
          dia_semana: DOW_TO_ENUM[dow],
          refeicao: r.turno,
          pop_clt: r.pop_minimo,
          pop_free: 0,
          pop_total: r.pop_minimo,
          escalados_clt: r.escalados,
          ponto_clt: r.pop_chegou,
          checkin_free: r.extras_freelancer,
          total_real: r.pop_chegou + r.extras_freelancer,
          status: popStatus,
          status_detalhe: r.status,
        };
      });

  return {
    data: rows,
    isLoading: pop.isLoading || lookups.isLoading,
    isFetching: pop.isFetching || lookups.isFetching,
    error: pop.error ?? lookups.error,
    refetch: pop.refetch,
  };
}
