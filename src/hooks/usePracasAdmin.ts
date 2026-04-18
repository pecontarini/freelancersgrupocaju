import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DiaSemanaPraca, TurnoPraca } from "./usePracas";

const DIAS: DiaSemanaPraca[] = [
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
  "DOMINGO",
];

const TURNOS: TurnoPraca[] = ["ALMOCO", "JANTAR", "TARDE"];

/** Default seed for stores that have no praças yet (mirrors the initial network seed). */
const SEED_TEMPLATE: Array<{
  setor: string;
  nome_praca: string;
  turno: TurnoPraca;
  qtd: Record<DiaSemanaPraca, number>;
}> = [
  // SUBCHEFE DE SALÃO
  { setor: "Subchefe de Salão", nome_praca: "Subchefe Almoço", turno: "ALMOCO", qtd: { SEGUNDA: 2, TERCA: 2, QUARTA: 2, QUINTA: 3, SEXTA: 3, SABADO: 3, DOMINGO: 3 } },
  { setor: "Subchefe de Salão", nome_praca: "Subchefe Jantar", turno: "JANTAR", qtd: { SEGUNDA: 2, TERCA: 3, QUARTA: 3, QUINTA: 3, SEXTA: 3, SABADO: 3, DOMINGO: 2 } },
  // GARÇOM
  { setor: "Garçom", nome_praca: "Garçom Almoço", turno: "ALMOCO", qtd: { SEGUNDA: 8, TERCA: 8, QUARTA: 10, QUINTA: 12, SEXTA: 20, SABADO: 20, DOMINGO: 20 } },
  { setor: "Garçom", nome_praca: "Garçom Jantar", turno: "JANTAR", qtd: { SEGUNDA: 15, TERCA: 16, QUARTA: 19, QUINTA: 20, SEXTA: 20, SABADO: 20, DOMINGO: 17 } },
  // CUMIN
  { setor: "Cumin", nome_praca: "Cumin Almoço", turno: "ALMOCO", qtd: { SEGUNDA: 8, TERCA: 9, QUARTA: 10, QUINTA: 11, SEXTA: 13, SABADO: 13, DOMINGO: 13 } },
  { setor: "Cumin", nome_praca: "Cumin Jantar", turno: "JANTAR", qtd: { SEGUNDA: 10, TERCA: 11, QUARTA: 11, QUINTA: 11, SEXTA: 14, SABADO: 13, DOMINGO: 11 } },
  // HOSTESS
  { setor: "Hostess", nome_praca: "Hostess Almoço", turno: "ALMOCO", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 1, QUINTA: 2, SEXTA: 3, SABADO: 3, DOMINGO: 3 } },
  { setor: "Hostess", nome_praca: "Hostess Jantar", turno: "JANTAR", qtd: { SEGUNDA: 2, TERCA: 2, QUARTA: 2, QUINTA: 3, SEXTA: 3, SABADO: 3, DOMINGO: 2 } },
  // CAIXA/DELIVERY
  { setor: "Caixa/Delivery", nome_praca: "Caixa Almoço", turno: "ALMOCO", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 1, QUINTA: 2, SEXTA: 2, SABADO: 2, DOMINGO: 3 } },
  { setor: "Caixa/Delivery", nome_praca: "Caixa Jantar", turno: "JANTAR", qtd: { SEGUNDA: 2, TERCA: 2, QUARTA: 2, QUINTA: 2, SEXTA: 2, SABADO: 2, DOMINGO: 1 } },
  // PARRILLA
  { setor: "Parrilla", nome_praca: "Parrilla Almoço", turno: "ALMOCO", qtd: { SEGUNDA: 2, TERCA: 2, QUARTA: 2, QUINTA: 2, SEXTA: 2, SABADO: 2, DOMINGO: 2 } },
  { setor: "Parrilla", nome_praca: "Parrilla Jantar", turno: "JANTAR", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 1, QUINTA: 2, SEXTA: 2, SABADO: 2, DOMINGO: 2 } },
  // COZINHA
  { setor: "Cozinha", nome_praca: "Fogão", turno: "ALMOCO", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 2, QUINTA: 2, SEXTA: 2, SABADO: 2, DOMINGO: 2 } },
  { setor: "Cozinha", nome_praca: "Fritadeira", turno: "ALMOCO", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 1, QUINTA: 1, SEXTA: 1, SABADO: 1, DOMINGO: 1 } },
  { setor: "Cozinha", nome_praca: "Sobremesa", turno: "ALMOCO", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 1, QUINTA: 1, SEXTA: 1, SABADO: 1, DOMINGO: 1 } },
  { setor: "Cozinha", nome_praca: "Subchefe Plantão", turno: "ALMOCO", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 1, QUINTA: 1, SEXTA: 1, SABADO: 1, DOMINGO: 1 } },
  { setor: "Cozinha", nome_praca: "Fogão", turno: "JANTAR", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 1, QUINTA: 1, SEXTA: 2, SABADO: 2, DOMINGO: 1 } },
  { setor: "Cozinha", nome_praca: "Fritadeira", turno: "JANTAR", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 1, QUINTA: 1, SEXTA: 1, SABADO: 1, DOMINGO: 1 } },
  { setor: "Cozinha", nome_praca: "Sobremesa", turno: "JANTAR", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 1, QUINTA: 1, SEXTA: 1, SABADO: 1, DOMINGO: 1 } },
  { setor: "Cozinha", nome_praca: "Subchefe Plantão", turno: "JANTAR", qtd: { SEGUNDA: 1, TERCA: 1, QUARTA: 1, QUINTA: 1, SEXTA: 1, SABADO: 1, DOMINGO: 1 } },
  // BAR
  { setor: "Bar", nome_praca: "Bar Almoço", turno: "ALMOCO", qtd: { SEGUNDA: 4, TERCA: 4, QUARTA: 4, QUINTA: 5, SEXTA: 9, SABADO: 8, DOMINGO: 6 } },
  { setor: "Bar", nome_praca: "Bar Jantar", turno: "JANTAR", qtd: { SEGUNDA: 5, TERCA: 5, QUARTA: 5, QUINTA: 7, SEXTA: 9, SABADO: 8, DOMINGO: 6 } },
  // SERVIÇOS GERAIS
  { setor: "Serviços Gerais", nome_praca: "Serv. Gerais Almoço", turno: "ALMOCO", qtd: { SEGUNDA: 3, TERCA: 3, QUARTA: 3, QUINTA: 4, SEXTA: 4, SABADO: 4, DOMINGO: 4 } },
  { setor: "Serviços Gerais", nome_praca: "Serv. Gerais Jantar", turno: "JANTAR", qtd: { SEGUNDA: 3, TERCA: 3, QUARTA: 3, QUINTA: 4, SEXTA: 4, SABADO: 4, DOMINGO: 4 } },
  // PRODUÇÃO
  { setor: "Produção", nome_praca: "Produção Almoço", turno: "ALMOCO", qtd: { SEGUNDA: 6, TERCA: 6, QUARTA: 6, QUINTA: 6, SEXTA: 6, SABADO: 6, DOMINGO: 5 } },
  { setor: "Produção", nome_praca: "Produção Tarde", turno: "TARDE", qtd: { SEGUNDA: 5, TERCA: 5, QUARTA: 5, QUINTA: 5, SEXTA: 5, SABADO: 0, DOMINGO: 0 } },
];

export { DIAS, TURNOS, SEED_TEMPLATE };

function invalidate(qc: ReturnType<typeof useQueryClient>, unitId: string) {
  qc.invalidateQueries({ queryKey: ["pracas-unit", unitId] });
}

/** Update qtd_necessaria for a single (sector, name, shift, day) row. Creates if missing. */
export function useUpdatePracaQtd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      unit_id: string;
      setor: string;
      nome_praca: string;
      turno: TurnoPraca;
      dia_semana: DiaSemanaPraca;
      qtd_necessaria: number;
    }) => {
      const { error } = await supabase
        .from("pracas_plano_chao" as any)
        .upsert(params, { onConflict: "unit_id,setor,nome_praca,turno,dia_semana" });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidate(qc, vars.unit_id),
    onError: (e: any) => toast.error(`Erro ao salvar: ${e.message}`),
  });
}

/** Create a new praça (creates 7 rows Mon→Sun with qtd=1). */
export function useCreatePraca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      unit_id: string;
      setor: string;
      nome_praca: string;
      turno: TurnoPraca;
      qtd_default?: number;
    }) => {
      const rows = DIAS.map((dia) => ({
        unit_id: params.unit_id,
        setor: params.setor,
        nome_praca: params.nome_praca,
        turno: params.turno,
        dia_semana: dia,
        qtd_necessaria: params.qtd_default ?? 1,
      }));
      const { error } = await supabase
        .from("pracas_plano_chao" as any)
        .upsert(rows, { onConflict: "unit_id,setor,nome_praca,turno,dia_semana" });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      invalidate(qc, vars.unit_id);
      toast.success("Praça criada com sucesso");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

/** Delete the entire praça group (all 7 days for sector+name+shift). */
export function useDeletePracaGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      unit_id: string;
      setor: string;
      nome_praca: string;
      turno: TurnoPraca;
    }) => {
      const { error } = await supabase
        .from("pracas_plano_chao" as any)
        .delete()
        .eq("unit_id", params.unit_id)
        .eq("setor", params.setor)
        .eq("nome_praca", params.nome_praca)
        .eq("turno", params.turno);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      invalidate(qc, vars.unit_id);
      toast.success("Praça removida");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

/** Replicate all praças from a source unit to a target unit. */
export function useReplicarPracas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { source_unit_id: string; target_unit_id: string }) => {
      const { data, error } = await supabase
        .from("pracas_plano_chao" as any)
        .select("setor,nome_praca,turno,dia_semana,qtd_necessaria")
        .eq("unit_id", params.source_unit_id);
      if (error) throw error;
      const rows = ((data as any[]) || []).map((r) => ({
        ...r,
        unit_id: params.target_unit_id,
      }));
      if (rows.length === 0) {
        throw new Error("A loja de origem não possui praças cadastradas.");
      }
      const { error: insertError } = await supabase
        .from("pracas_plano_chao" as any)
        .upsert(rows, { onConflict: "unit_id,setor,nome_praca,turno,dia_semana" });
      if (insertError) throw insertError;
      return rows.length;
    },
    onSuccess: (count, vars) => {
      invalidate(qc, vars.target_unit_id);
      toast.success(`${count} praças replicadas`);
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

/** Apply the default seed template to a unit. */
export function useApplySeedPracas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unit_id: string) => {
      const rows: any[] = [];
      for (const item of SEED_TEMPLATE) {
        for (const dia of DIAS) {
          rows.push({
            unit_id,
            setor: item.setor,
            nome_praca: item.nome_praca,
            turno: item.turno,
            dia_semana: dia,
            qtd_necessaria: item.qtd[dia],
          });
        }
      }
      const { error } = await supabase
        .from("pracas_plano_chao" as any)
        .upsert(rows, { onConflict: "unit_id,setor,nome_praca,turno,dia_semana" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count, unit_id) => {
      invalidate(qc, unit_id);
      toast.success(`Seed padrão aplicado (${count} linhas)`);
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}
