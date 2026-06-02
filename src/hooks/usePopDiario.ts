import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Hook canônico do POP Diário.
 * Lê diretamente de `public.vw_pop_diario` (criada na Etapa A).
 * Todas as métricas de POP/escala/presença devem passar por aqui.
 */

export type PopDiarioTurno = "ALMOCO" | "JANTAR";
export type PopDiarioStatus = "conforme" | "inconforme" | "aguardando" | "sem_pop";

export interface PopDiarioPessoa {
  employee_id: string;
  name: string;
  phone?: string | null;
  start?: string | null;
  end?: string | null;
  /** Hora da primeira batida do dia (HH:MM:SS) ou null. Etapa A'. */
  punch_in?: string | null;
  /** Minutos de atraso vs. start_time. null se não houver batida. Etapa A'. */
  atraso_min?: number | null;
}

export interface PopDiarioRow {
  unit_id: string;
  sector_id: string;
  schedule_date: string; // YYYY-MM-DD
  turno: PopDiarioTurno;
  pop_minimo: number;
  /** true = setor sem POP cadastrado (tem escala mas não tem mínimo). Etapa A'. */
  sem_pop: boolean;
  escalados: number;
  pop_chegou: number;
  presentes: number;
  faltantes: number;
  extras_freelancer: number;
  extras_dobra: number;
  saldo_final: number;
  status: PopDiarioStatus;
  janela_iniciada: boolean;
  janela_encerrada: boolean;
  computed_at: string;
  escalados_lista: PopDiarioPessoa[];
  pop_chegou_lista: PopDiarioPessoa[];
  presentes_lista: PopDiarioPessoa[];
  faltantes_lista: PopDiarioPessoa[];
  extras_lista: PopDiarioPessoa[];
}

export interface PopDiarioFiltros {
  /** string = uma unidade; string[] = várias; undefined = todas (admin global) */
  unitId?: string | string[];
  sectorId?: string;
  /** Date única ou intervalo. Sempre normalizado para YYYY-MM-DD (sem timezone). */
  date: Date | string | { from: Date | string; to: Date | string };
  turno?: PopDiarioTurno | "TODOS";
  enabled?: boolean;
}

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d;
  return format(d, "yyyy-MM-dd");
}

function normaliseList(raw: unknown): PopDiarioPessoa[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      employee_id: String(p.employee_id ?? ""),
      name: String(p.name ?? ""),
      phone: (p.phone as string | null | undefined) ?? null,
      start: (p.start as string | null | undefined) ?? null,
      end: (p.end as string | null | undefined) ?? null,
    }))
    .filter((p) => p.employee_id);
}

function mapRow(raw: any): PopDiarioRow {
  return {
    unit_id: raw.unit_id,
    sector_id: raw.sector_id,
    schedule_date: raw.schedule_date,
    turno: raw.turno,
    pop_minimo: Number(raw.pop_minimo ?? 0),
    escalados: Number(raw.escalados ?? 0),
    pop_chegou: Number(raw.pop_chegou ?? 0),
    presentes: Number(raw.presentes ?? 0),
    faltantes: Number(raw.faltantes ?? 0),
    extras_freelancer: Number(raw.extras_freelancer ?? 0),
    extras_dobra: Number(raw.extras_dobra ?? 0),
    saldo_final: Number(raw.saldo_final ?? 0),
    status: raw.status,
    janela_iniciada: !!raw.janela_iniciada,
    janela_encerrada: !!raw.janela_encerrada,
    computed_at: raw.computed_at,
    escalados_lista: normaliseList(raw.escalados_lista),
    pop_chegou_lista: normaliseList(raw.pop_chegou_lista),
    presentes_lista: normaliseList(raw.presentes_lista),
    faltantes_lista: normaliseList(raw.faltantes_lista),
    extras_lista: normaliseList(raw.extras_lista),
  };
}

export interface PopDiarioAgg {
  pop_minimo: number;
  escalados: number;
  pop_chegou: number;
  presentes: number;
  faltantes: number;
  extras_freelancer: number;
  saldo_final: number;
  setores_conforme: number;
  setores_inconforme: number;
  setores_aguardando: number;
}

function emptyAgg(): PopDiarioAgg {
  return {
    pop_minimo: 0,
    escalados: 0,
    pop_chegou: 0,
    presentes: 0,
    faltantes: 0,
    extras_freelancer: 0,
    saldo_final: 0,
    setores_conforme: 0,
    setores_inconforme: 0,
    setores_aguardando: 0,
  };
}

function accumulate(agg: PopDiarioAgg, row: PopDiarioRow) {
  agg.pop_minimo += row.pop_minimo;
  agg.escalados += row.escalados;
  agg.pop_chegou += row.pop_chegou;
  agg.presentes += row.presentes;
  agg.faltantes += row.faltantes;
  agg.extras_freelancer += row.extras_freelancer;
  agg.saldo_final += row.saldo_final;
  if (row.status === "conforme") agg.setores_conforme += 1;
  else if (row.status === "inconforme") agg.setores_inconforme += 1;
  else if (row.status === "aguardando") agg.setores_aguardando += 1;
}

export interface UsePopDiarioResult {
  rows: PopDiarioRow[];
  byUnit: Record<string, PopDiarioAgg>;
  byDate: Record<string, PopDiarioAgg>;
  bySectorTurno: Record<string, PopDiarioRow>;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

export function usePopDiario(filtros: PopDiarioFiltros): UsePopDiarioResult {
  const { unitId, sectorId, date, turno, enabled = true } = filtros;

  let from: string;
  let to: string;
  if (typeof date === "object" && date !== null && "from" in date && "to" in date) {
    from = toDateStr(date.from);
    to = toDateStr(date.to);
  } else {
    from = toDateStr(date as Date | string);
    to = from;
  }

  const unitIds = Array.isArray(unitId)
    ? [...unitId].sort()
    : unitId
    ? [unitId]
    : null;

  const query = useQuery({
    queryKey: [
      "pop-diario",
      from,
      to,
      unitIds ? unitIds.join(",") : "ALL",
      sectorId ?? "ALL",
      turno ?? "TODOS",
    ],
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      let q = supabase
        .from("vw_pop_diario" as any)
        .select("*")
        .gte("schedule_date", from)
        .lte("schedule_date", to);

      if (unitIds && unitIds.length === 1) q = q.eq("unit_id", unitIds[0]);
      else if (unitIds && unitIds.length > 1) q = q.in("unit_id", unitIds);

      if (sectorId) q = q.eq("sector_id", sectorId);

      if (turno && turno !== "TODOS") q = q.eq("turno", turno);

      const { data, error } = await q;
      if (error) throw error;
      return ((data as any[]) || []).map(mapRow);
    },
  });

  const rows = query.data ?? [];

  const byUnit: Record<string, PopDiarioAgg> = {};
  const byDate: Record<string, PopDiarioAgg> = {};
  const bySectorTurno: Record<string, PopDiarioRow> = {};
  for (const row of rows) {
    if (!byUnit[row.unit_id]) byUnit[row.unit_id] = emptyAgg();
    accumulate(byUnit[row.unit_id], row);
    if (!byDate[row.schedule_date]) byDate[row.schedule_date] = emptyAgg();
    accumulate(byDate[row.schedule_date], row);
    bySectorTurno[`${row.sector_id}__${row.schedule_date}__${row.turno}`] = row;
  }

  return {
    rows,
    byUnit,
    byDate,
    bySectorTurno,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
