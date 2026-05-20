import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Traduz erros conhecidos da tabela employees em mensagens claras para o usuário.
 * Inclui mapeamentos do trigger guardião Secullum (P0001).
 */
export function friendlyEmployeeError(err: any): string {
  const raw = String(err?.message || err || "");
  const msg = raw.toLowerCase();
  const code = err?.code;

  // Trigger guardião Secullum (P0001) — mapeamentos por substring
  if (msg.includes("aguardando_secullum")) {
    return "Cadastro CLT só pode ser criado via 'Solicitar cadastro urgente'. O fluxo normal é pelo Secullum.";
  }
  if (msg.includes("banco_id") || msg.includes("secullum_id")) {
    return "Funcionário CLT precisa estar sincronizado com o Secullum antes de ser usado.";
  }
  if (msg.includes("default_rate")) {
    return "Valor da diária obrigatório para freelancer (deve ser maior que zero).";
  }
  if (msg.includes("cpf") && (msg.includes("invalid") || msg.includes("inválido") || msg.includes("digit"))) {
    return "CPF inválido. Verifique os 11 dígitos.";
  }
  if (msg.includes("phone") && msg.includes("required")) {
    return "Telefone obrigatório para freelancer.";
  }

  // Constraints únicas existentes
  if (raw.includes("unique_active_employee_no_cpf")) {
    return "Já existe um funcionário com este nome e cargo nesta unidade. Adicione um sobrenome ou informe o CPF para diferenciar.";
  }
  if (raw.includes("unique_freelancer_cpf_unit")) {
    return "Este CPF já está cadastrado como freelancer nesta unidade.";
  }
  if (code === "23505") {
    return "Já existe um cadastro com estes dados. Verifique nome, cargo ou CPF.";
  }
  return raw || "Erro desconhecido. Tente novamente.";
}

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
  banco_id: number | null;
  secullum_id: number | null;
  aguardando_secullum: boolean | null;
  created_at: string;
  updated_at: string;
}

function dedupByCpf(rows: any[]): any[] {
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
      const existingTs = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const newTs = new Date(row.updated_at || row.created_at || 0).getTime();
      if (newTs > existingTs) {
        const idx = result.findIndex((r) => r === existing);
        if (idx >= 0) result[idx] = row;
        seen.set(cpfKey, row);
      }
    }
  }
  return result;
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
      return dedupByCpf((data || []) as any[]) as Employee[];
    },
    enabled: !!unitId,
  });
}

/**
 * Funcionários elegíveis para ESCALA — apenas CLTs sincronizados com Secullum.
 * Exclui freelancers, inativos e CLTs em urgência (aguardando_secullum=true).
 */
export function useSchedulableEmployees(
  unitId: string | null,
  additionalUnitIds?: string[]
) {
  const allUnitIds = [unitId, ...(additionalUnitIds || [])].filter(Boolean) as string[];
  const sortedKey = [...allUnitIds].sort();
  return useQuery({
    queryKey: ["employees-schedulable", sortedKey],
    queryFn: async () => {
      if (allUnitIds.length === 0) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .in("unit_id", allUnitIds)
        .eq("active", true)
        .eq("worker_type", "clt")
        .not("banco_id", "is", null)
        .not("secullum_id", "is", null)
        .or("aguardando_secullum.is.null,aguardando_secullum.eq.false")
        .order("name");
      if (error) throw error;
      return dedupByCpf((data || []) as any[]) as Employee[];
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
      cpf?: string;
      worker_type?: "clt" | "freelancer";
      default_rate?: number;
      aguardando_secullum?: boolean;
    }) => {
      const payload: any = {
        ...params,
        worker_type: params.worker_type ?? "freelancer",
        cpf: params.cpf ? params.cpf.replace(/\D/g, "") : undefined,
      };
      const { error } = await supabase.from("employees").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-schedulable"] });
    },
    onError: (err: any) => toast.error(friendlyEmployeeError(err)),
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
      qc.invalidateQueries({ queryKey: ["employees-schedulable"] });
      toast.success("Funcionário atualizado!");
    },
    onError: (err: any) => toast.error(friendlyEmployeeError(err)),
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
      qc.invalidateQueries({ queryKey: ["employees-schedulable"] });
      toast.success("Funcionário desativado!");
    },
    onError: (err: any) => toast.error(friendlyEmployeeError(err)),
  });
}
