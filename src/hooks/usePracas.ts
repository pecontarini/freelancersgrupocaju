import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TurnoPraca = "ALMOCO" | "JANTAR" | "TARDE";
export type DiaSemanaPraca =
  | "SEGUNDA"
  | "TERCA"
  | "QUARTA"
  | "QUINTA"
  | "SEXTA"
  | "SABADO"
  | "DOMINGO";

export interface Praca {
  id: string;
  unit_id: string;
  setor: string;
  nome_praca: string;
  turno: TurnoPraca;
  dia_semana: DiaSemanaPraca;
  qtd_necessaria: number;
}

const DIA_MAP: Record<number, DiaSemanaPraca> = {
  0: "DOMINGO",
  1: "SEGUNDA",
  2: "TERCA",
  3: "QUARTA",
  4: "QUINTA",
  5: "SEXTA",
  6: "SABADO",
};

/** Convert a JS Date.getDay() (0=Sun..6=Sat) to DiaSemanaPraca enum used by pracas. */
export function jsDayToDiaPraca(jsDow: number): DiaSemanaPraca {
  return DIA_MAP[jsDow] ?? "SEGUNDA";
}

/** Convert a YYYY-MM-DD date string to DiaSemanaPraca. */
export function dateStrToDiaPraca(dateStr: string): DiaSemanaPraca {
  const d = new Date(dateStr + "T12:00:00");
  return jsDayToDiaPraca(d.getDay());
}

/** Infer turno from a start_time HH:mm string (used on the schedule). */
export function inferTurnoFromTime(startTime?: string | null): TurnoPraca {
  if (!startTime) return "ALMOCO";
  const [h] = startTime.split(":").map(Number);
  if (h >= 4 && h < 14) return "ALMOCO";
  if (h >= 14 && h < 17) return "TARDE";
  return "JANTAR";
}

/** Normalize sector name for fuzzy matching against pracas.setor. */
function normalizeSetor(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Fetch ALL pracas of a given unit (cached) — filtering happens client-side per cell. */
export function usePracasByUnit(unitId: string | null) {
  return useQuery({
    queryKey: ["pracas-unit", unitId],
    queryFn: async () => {
      if (!unitId) return [] as Praca[];
      const { data, error } = await supabase
        .from("pracas_plano_chao" as any)
        .select("*")
        .eq("unit_id", unitId);
      if (error) throw error;
      return ((data as any[]) || []) as Praca[];
    },
    enabled: !!unitId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Filter pracas matching a sector name (fuzzy), turno and day. */
export function filterPracas(
  pracas: Praca[],
  sectorName: string | null | undefined,
  turno: TurnoPraca,
  dia: DiaSemanaPraca,
): Praca[] {
  if (!sectorName) return [];
  const target = normalizeSetor(sectorName);
  return pracas.filter(
    (p) =>
      p.turno === turno &&
      p.dia_semana === dia &&
      (normalizeSetor(p.setor) === target ||
        normalizeSetor(p.setor).includes(target) ||
        target.includes(normalizeSetor(p.setor))),
  );
}
