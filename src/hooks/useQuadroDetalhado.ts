import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePopDiario } from "./usePopDiario";

/**
 * SHIM — preserva a API legada de `useQuadroDetalhado` mas alimenta
 * tudo a partir de `vw_pop_diario`.
 *
 * Etapa A': a view passou a expor `punch_in` e `atraso_min` dentro
 * de `escalados_lista`, então `punch_in_hora`, `punch_in_ts` e
 * `atraso_minutos` voltam a ser populados e o status "ATRASO" funciona.
 */

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

function useSectorNames(sectorIds: string[]) {
  const key = [...new Set(sectorIds)].sort().join(",");
  return useQuery({
    queryKey: ["sectors-names", key],
    enabled: sectorIds.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors")
        .select("id, name")
        .in("id", [...new Set(sectorIds)]);
      if (error) throw error;
      const m = new Map<string, string>();
      for (const r of (data as any[]) || []) m.set(r.id, r.name);
      return m;
    },
  });
}

function hhmm(t: string | null | undefined): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

const ATRASO_THRESHOLD_MIN = 15;

export function useQuadroDetalhado(data: string, unitId: string | null) {
  const pop = usePopDiario({
    date: data,
    unitId: unitId ?? undefined,
    enabled: !!unitId,
  });

  const sectorIds = pop.rows.map((r) => r.sector_id);
  const sectors = useSectorNames(sectorIds);

  const rows: QuadroDetalhadoRow[] = [];

  if (!pop.isLoading && pop.rows.length > 0) {
    for (const row of pop.rows) {
      // Indexa presentes pelo punch_in (vem da view)
      const presentesMap = new Map<string, string | null>();
      for (const p of row.presentes_lista) {
        presentesMap.set(p.employee_id, p.punch_in ?? null);
      }
      const sectorName = sectors.data?.get(row.sector_id) ?? "";

      for (const esc of row.escalados_lista) {
        const isPresente = presentesMap.has(esc.employee_id);
        const punchIn = isPresente
          ? presentesMap.get(esc.employee_id) ?? esc.punch_in ?? null
          : esc.punch_in ?? null;
        const atraso = esc.atraso_min ?? null;

        let status: QuadroStatus;
        if (isPresente) {
          status =
            atraso !== null && atraso > ATRASO_THRESHOLD_MIN ? "ATRASO" : "PRESENTE";
        } else if (!row.janela_iniciada) {
          status = "AGUARDANDO";
        } else {
          status = "AUSENTE";
        }

        rows.push({
          schedule_id: `${esc.employee_id}-${row.sector_id}-${row.turno}-${row.schedule_date}`,
          employee_id: esc.employee_id,
          employee_name: esc.name,
          sector_id: row.sector_id,
          sector_name: sectorName,
          unit_id: row.unit_id,
          shift_id: "",
          shift_name: row.turno === "ALMOCO" ? "Almoço" : "Jantar",
          refeicao: row.turno,
          effective_start_time: esc.start ?? "",
          effective_end_time: esc.end ?? "",
          scheduled_start_ts: `${row.schedule_date}T${esc.start ?? "00:00:00"}`,
          scheduled_end_ts: `${row.schedule_date}T${esc.end ?? "00:00:00"}`,
          punch_in_ts: punchIn ? `${row.schedule_date}T${punchIn}` : null,
          punch_in_hora: hhmm(punchIn),
          scheduled_inicio_hora: hhmm(esc.start),
          scheduled_fim_hora: hhmm(esc.end),
          status,
          atraso_minutos: atraso,
        });
      }
    }
  }

  return {
    data: rows,
    isLoading: pop.isLoading || sectors.isLoading,
    isFetching: pop.isFetching || sectors.isFetching,
    error: pop.error ?? sectors.error,
    refetch: pop.refetch,
  };
}
