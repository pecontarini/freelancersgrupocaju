import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Coleta um snapshot compacto dos dados de CMV Carnes da unidade
 * para enviar como contexto à IA. Foca em desvio + contagens diárias
 * + turnos câmara/praça da semana ativa + auditoria 7d e 30d.
 *
 * Mantemos esse payload em ~5-8 KB para resposta rápida e barata.
 */
export interface CMVAIContext {
  unitId: string;
  generatedAt: string;
  items: Array<{
    id: string;
    nome: string;
    unidade: string;
    categoria: string | null;
    preco_custo: number;
  }>;
  contagens14d: Array<{
    item_id: string;
    item_nome: string;
    data: string;
    quantidade: number;
  }>;
  semanaAtiva: {
    id: string;
    data_inicio: string;
    data_fim: string;
    status: string;
  } | null;
  camara: Array<{
    item_id: string;
    item_nome: string;
    dia: string;
    entrada: number | null;
    saida: number | null;
  }>;
  praca: Array<{
    item_id: string;
    item_nome: string;
    dia: string;
    t1_abertura: number | null;
    t2_almoco: number | null;
    t3_fechamento: number | null;
  }>;
  audit7d: Array<{
    item_nome: string;
    initial_stock: number;
    purchases_qty: number;
    sales_consumption: number;
    waste_qty: number;
    theoretical_final: number;
    real_final_stock: number;
    divergence: number;
    financial_loss: number;
  }>;
  audit30d: Array<{
    item_nome: string;
    divergence: number;
    financial_loss: number;
  }>;
}

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function useCMVAIContext(unitId: string | null | undefined) {
  return useQuery({
    queryKey: ["cmv-ai-context", unitId],
    queryFn: async (): Promise<CMVAIContext | null> => {
      if (!unitId) return null;

      const today = new Date();
      const d14 = new Date(today);
      d14.setDate(d14.getDate() - 14);
      const d7 = new Date(today);
      d7.setDate(d7.getDate() - 7);
      const d30 = new Date(today);
      d30.setDate(d30.getDate() - 30);

      // 1. Itens ativos (carnes)
      const { data: itemsRaw } = await supabase
        .from("cmv_items")
        .select("id, nome, unidade, categoria, preco_custo_atual")
        .eq("ativo", true)
        .order("nome");

      const items = (itemsRaw ?? []).map((i: any) => ({
        id: i.id,
        nome: i.nome,
        unidade: i.unidade,
        categoria: i.categoria,
        preco_custo: Number(i.preco_custo_atual ?? 0),
      }));
      const itemNameById = new Map(items.map((i) => [i.id, i.nome]));

      // 2. Contagens diárias últimos 14 dias
      const { data: contagensRaw } = await supabase
        .from("cmv_contagens")
        .select("cmv_item_id, data_contagem, quantidade")
        .eq("loja_id", unitId)
        .gte("data_contagem", ymd(d14))
        .order("data_contagem", { ascending: true });

      const contagens14d = (contagensRaw ?? []).map((c: any) => ({
        item_id: c.cmv_item_id,
        item_nome: itemNameById.get(c.cmv_item_id) ?? "(item)",
        data: c.data_contagem,
        quantidade: Number(c.quantidade ?? 0),
      }));

      // 3. Semana ativa (status aberta) + turnos câmara/praça
      const { data: semanas } = await supabase
        .from("semanas_cmv")
        .select("id, data_inicio, data_fim, status")
        .eq("loja_id", unitId)
        .order("data_inicio", { ascending: false })
        .limit(1);

      const semanaAtiva = (semanas?.[0] as any) ?? null;
      let camara: CMVAIContext["camara"] = [];
      let praca: CMVAIContext["praca"] = [];

      if (semanaAtiva) {
        const [{ data: cam }, { data: pra }] = await Promise.all([
          supabase
            .from("cmv_camara")
            .select("cmv_item_id, dia, entrada, saida")
            .eq("semana_id", semanaAtiva.id),
          supabase
            .from("cmv_praca")
            .select("cmv_item_id, dia, t1_abertura, t2_almoco, t3_fechamento")
            .eq("semana_id", semanaAtiva.id),
        ]);
        camara = (cam ?? []).map((c: any) => ({
          item_id: c.cmv_item_id,
          item_nome: itemNameById.get(c.cmv_item_id) ?? "(item)",
          dia: c.dia,
          entrada: c.entrada,
          saida: c.saida,
        }));
        praca = (pra ?? []).map((p: any) => ({
          item_id: p.cmv_item_id,
          item_nome: itemNameById.get(p.cmv_item_id) ?? "(item)",
          dia: p.dia,
          t1_abertura: p.t1_abertura,
          t2_almoco: p.t2_almoco,
          t3_fechamento: p.t3_fechamento,
        }));
      }

      // 4. Auditoria 7d e 30d
      const [{ data: a7 }, { data: a30 }] = await Promise.all([
        supabase.rpc("calculate_audit_period", {
          p_loja_id: unitId,
          p_start_date: ymd(d7),
          p_end_date: ymd(today),
        }),
        supabase.rpc("calculate_audit_period", {
          p_loja_id: unitId,
          p_start_date: ymd(d30),
          p_end_date: ymd(today),
        }),
      ]);

      const audit7d = ((a7 ?? []) as any[]).map((r) => ({
        item_nome: r.item_name,
        initial_stock: Number(r.initial_stock ?? 0),
        purchases_qty: Number(r.purchases_qty ?? 0),
        sales_consumption: Number(r.sales_consumption ?? 0),
        waste_qty: Number(r.waste_qty ?? 0),
        theoretical_final: Number(r.theoretical_final ?? 0),
        real_final_stock: Number(r.real_final_stock ?? 0),
        divergence: Number(r.divergence ?? 0),
        financial_loss: Number(r.financial_loss ?? 0),
      }));

      const audit30d = ((a30 ?? []) as any[]).map((r) => ({
        item_nome: r.item_name,
        divergence: Number(r.divergence ?? 0),
        financial_loss: Number(r.financial_loss ?? 0),
      }));

      return {
        unitId,
        generatedAt: new Date().toISOString(),
        items,
        contagens14d,
        semanaAtiva: semanaAtiva
          ? {
              id: semanaAtiva.id,
              data_inicio: semanaAtiva.data_inicio,
              data_fim: semanaAtiva.data_fim,
              status: semanaAtiva.status,
            }
          : null,
        camara,
        praca,
        audit7d,
        audit30d,
      };
    },
    enabled: !!unitId,
    staleTime: 60 * 1000,
  });
}
