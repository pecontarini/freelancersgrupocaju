import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

export type SemanaCMV = {
  id: string;
  loja_id: string;
  data_inicio: string;
  data_fim: string;
  responsavel: string | null;
  status: string;
  saldo_anterior_json: Record<string, number>;
  encerrada_por: string | null;
  encerrada_em: string | null;
  created_at: string;
};

export type CamaraEntry = {
  id: string;
  semana_id: string;
  cmv_item_id: string;
  dia: string;
  entrada: number | null;
  saida: number | null;
};

export type PracaEntry = {
  id: string;
  semana_id: string;
  cmv_item_id: string;
  dia: string;
  t1_abertura: number | null;
  t2_almoco: number | null;
  t3_fechamento: number | null;
  turno_encerrado_em: string | null;
};

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
export type DiaSemana = typeof DIAS[number];
export { DIAS };

export function useSemanasCMV() {
  const { effectiveUnidadeId } = useUnidade();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["semanas_cmv", effectiveUnidadeId],
    queryFn: async () => {
      if (!effectiveUnidadeId) return [];
      const { data, error } = await supabase
        .from("semanas_cmv")
        .select("*")
        .eq("loja_id", effectiveUnidadeId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        saldo_anterior_json: d.saldo_anterior_json || {},
      })) as SemanaCMV[];
    },
    enabled: !!effectiveUnidadeId,
  });

  const createSemana = useMutation({
    mutationFn: async (params: { data_inicio: string; data_fim: string; responsavel?: string }) => {
      if (!effectiveUnidadeId) throw new Error("Unidade não selecionada");
      // Get saldo from last closed week
      const { data: lastClosed } = await supabase
        .from("semanas_cmv")
        .select("saldo_anterior_json, id")
        .eq("loja_id", effectiveUnidadeId)
        .eq("status", "encerrada")
        .order("data_fim", { ascending: false })
        .limit(1)
        .single();

      const { data, error } = await supabase
        .from("semanas_cmv")
        .insert({
          loja_id: effectiveUnidadeId,
          data_inicio: params.data_inicio,
          data_fim: params.data_fim,
          responsavel: params.responsavel || null,
          saldo_anterior_json: lastClosed?.saldo_anterior_json || {},
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["semanas_cmv"] });
      toast.success("Semana criada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const encerrarSemana = useMutation({
    mutationFn: async (params: { semanaId: string; saldoFinalJson: Record<string, number> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      // Update current week as closed
      const { error } = await supabase
        .from("semanas_cmv")
        .update({
          status: "encerrada",
          encerrada_por: user?.id,
          encerrada_em: new Date().toISOString(),
        })
        .eq("id", params.semanaId);
      if (error) throw error;

      // Store the final balance to be carried over: update the NEXT week or store in current
      // We store it in the current week's saldo_anterior_json as "saldo_final"
      // The next week creation will pick it up
      const { error: e2 } = await supabase
        .from("semanas_cmv")
        .update({ saldo_anterior_json: params.saldoFinalJson })
        .eq("id", params.semanaId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["semanas_cmv"] });
      toast.success("Semana encerrada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, semanas: query.data || [], createSemana, encerrarSemana };
}

export function useCamaraData(semanaId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["cmv_camara", semanaId],
    queryFn: async () => {
      if (!semanaId) return [];
      const { data, error } = await supabase
        .from("cmv_camara")
        .select("*")
        .eq("semana_id", semanaId);
      if (error) throw error;
      return (data || []) as CamaraEntry[];
    },
    enabled: !!semanaId,
  });

  const upsert = useMutation({
    mutationFn: async (params: { semana_id: string; cmv_item_id: string; dia: string; entrada?: number | null; saida?: number | null }) => {
      const { data, error } = await supabase
        .from("cmv_camara")
        .upsert(
          {
            semana_id: params.semana_id,
            cmv_item_id: params.cmv_item_id,
            dia: params.dia,
            entrada: params.entrada,
            saida: params.saida,
          },
          { onConflict: "semana_id,cmv_item_id,dia" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cmv_camara", semanaId] }),
  });

  return { ...query, entries: query.data || [], upsert };
}

export function usePracaData(semanaId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["cmv_praca", semanaId],
    queryFn: async () => {
      if (!semanaId) return [];
      const { data, error } = await supabase
        .from("cmv_praca")
        .select("*")
        .eq("semana_id", semanaId);
      if (error) throw error;
      return (data || []) as PracaEntry[];
    },
    enabled: !!semanaId,
  });

  const upsert = useMutation({
    mutationFn: async (params: {
      semana_id: string;
      cmv_item_id: string;
      dia: string;
      t1_abertura?: number | null;
      t2_almoco?: number | null;
      t3_fechamento?: number | null;
      turno_encerrado_em?: string | null;
    }) => {
      // Get existing entry first to merge
      const { data: existing } = await supabase
        .from("cmv_praca")
        .select("*")
        .eq("semana_id", params.semana_id)
        .eq("cmv_item_id", params.cmv_item_id)
        .eq("dia", params.dia)
        .maybeSingle();

      const merged = {
        semana_id: params.semana_id,
        cmv_item_id: params.cmv_item_id,
        dia: params.dia,
        t1_abertura: params.t1_abertura !== undefined ? params.t1_abertura : existing?.t1_abertura ?? null,
        t2_almoco: params.t2_almoco !== undefined ? params.t2_almoco : existing?.t2_almoco ?? null,
        t3_fechamento: params.t3_fechamento !== undefined ? params.t3_fechamento : existing?.t3_fechamento ?? null,
        turno_encerrado_em: params.turno_encerrado_em !== undefined ? params.turno_encerrado_em : existing?.turno_encerrado_em ?? null,
      };

      const { data, error } = await supabase
        .from("cmv_praca")
        .upsert(merged, { onConflict: "semana_id,cmv_item_id,dia" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cmv_praca", semanaId] }),
  });

  return { ...query, entries: query.data || [], upsert };
}
