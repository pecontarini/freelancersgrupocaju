import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Employee {
  id: string;
  unit_id: string;
  name: string;
  gender: "M" | "F";
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmployees(unitId: string | null) {
  return useQuery({
    queryKey: ["employees", unitId],
    queryFn: async () => {
      if (!unitId) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("unit_id", unitId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Employee[];
    },
    enabled: !!unitId,
  });
}

export function useAddEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { unit_id: string; name: string; gender: "M" | "F" }) => {
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

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Funcionário removido!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
