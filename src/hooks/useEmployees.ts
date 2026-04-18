import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Employee {
  id: string;
  unit_id: string;
  name: string;
  gender: "M" | "F";
  phone: string | null;
  cpf: string | null;
  job_title: string | null;
  job_title_id: string | null;
  active: boolean;
  worker_type: "clt" | "freelancer";
  default_rate: number;
  created_at: string;
  updated_at: string;
}

export function useEmployees(unitId: string | null, additionalUnitIds?: string[]) {
  const allUnitIds = [unitId, ...(additionalUnitIds || [])].filter(Boolean) as string[];
  const sortedKey = [...allUnitIds].sort();
  return useQuery({
    queryKey: ["employees", sortedKey],
    queryFn: async () => {
      if (allUnitIds.length === 0) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .in("unit_id", allUnitIds)
        .eq("active", true)
        .order("name");
      if (error) throw error;

      // Deduplicate by CPF (when present) — keep the most recent record
      const rows = (data || []) as any[];
      const seen = new Map<string, any>();
      const result: any[] = [];
      for (const row of rows) {
        const cpfKey = row.cpf ? String(row.cpf).replace(/\D/g, "") : null;
        if (!cpfKey) {
          result.push(row);
          continue;
        }
        const existing = seen.get(cpfKey);
        if (!existing) {
          seen.set(cpfKey, row);
          result.push(row);
        } else {
          // Keep the more recently updated one
          const existingTs = new Date(existing.updated_at || existing.created_at || 0).getTime();
          const newTs = new Date(row.updated_at || row.created_at || 0).getTime();
          if (newTs > existingTs) {
            // Replace existing in result array
            const idx = result.findIndex((r) => r === existing);
            if (idx >= 0) result[idx] = row;
            seen.set(cpfKey, row);
          }
        }
      }
      return result as Employee[];
    },
    enabled: !!unitId,
  });
}

export function useAddEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      unit_id: string;
      name: string;
      gender: "M" | "F";
      phone?: string;
      job_title?: string;
      job_title_id?: string;
    }) => {
      const { error } = await supabase.from("employees").insert(params);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Funcionário adicionado!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      gender?: "M" | "F";
      phone?: string;
      job_title?: string;
      job_title_id?: string;
    }) => {
      const { id, ...updates } = params;
      const { error } = await supabase.from("employees").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Funcionário atualizado!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Funcionário desativado!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
