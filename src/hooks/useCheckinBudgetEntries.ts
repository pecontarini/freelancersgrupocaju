import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export interface CheckinBudgetEntry {
  id: string;
  checkin_id: string;
  loja_id: string;
  freelancer_name: string;
  cpf: string;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  data_servico: string;
  checkin_at: string;
  checkout_at: string | null;
  valor: number;
  signed_by: string;
  signed_at: string;
  approval_id: string | null;
  created_at: string;
}

export function useCheckinBudgetEntries(lojaId?: string | null, monthYear?: string) {
  const { tenantId } = useTenant();
  const query = useQuery({
    queryKey: ["checkin-budget-entries", tenantId, lojaId, monthYear],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("checkin_budget_entries")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("data_servico", { ascending: false });

      if (lojaId) q = q.eq("loja_id", lojaId);

      if (monthYear) {
        const [year, month] = monthYear.split("-").map(Number);
        const start = `${monthYear}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const end = `${monthYear}-${String(lastDay).padStart(2, "0")}`;
        q = q.gte("data_servico", start).lte("data_servico", end);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as CheckinBudgetEntry[];
    },
    enabled: !!lojaId,
  });

  const total = (query.data ?? []).reduce((sum, e) => sum + e.valor, 0);

  return {
    entries: query.data ?? [],
    total,
    isLoading: query.isLoading,
  };
}
