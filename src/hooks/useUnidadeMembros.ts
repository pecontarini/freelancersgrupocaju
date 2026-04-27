import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnidadeMembro {
  user_id: string;
  nome: string;
  cargo: string | null;
  unidade_id: string | null;
  unidade_nome: string | null;
}

/**
 * Lista usuários candidatos a serem responsáveis/co-responsáveis de uma missão.
 * - Se unidadeId for fornecido, prioriza usuários daquela unidade.
 * - Caso contrário, retorna todos os usuários do tenant (limite razoável).
 */
export function useUnidadeMembros(unidadeId: string | null) {
  return useQuery({
    queryKey: ["unidade-membros", unidadeId],
    queryFn: async (): Promise<UnidadeMembro[]> => {
      // Lista de profiles + cargos via user_roles e config_lojas
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, unidade_id")
        .order("full_name", { ascending: true });
      if (error) throw error;

      const userIds = (profiles ?? []).map((p) => p.user_id);
      if (userIds.length === 0) return [];

      const [{ data: roles }, { data: lojas }, { data: stores }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        supabase.from("config_lojas").select("id, nome"),
        supabase.from("user_stores").select("user_id, loja_id").in("user_id", userIds),
      ]);

      const lojaById = new Map((lojas ?? []).map((l: any) => [l.id, l.nome]));
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      const storesByUser = new Map<string, string[]>();
      (stores ?? []).forEach((s: any) => {
        const arr = storesByUser.get(s.user_id) ?? [];
        arr.push(s.loja_id);
        storesByUser.set(s.user_id, arr);
      });

      const all: UnidadeMembro[] = (profiles ?? []).map((p: any) => {
        const rs = rolesByUser.get(p.user_id) ?? [];
        const cargo = rs[0] ?? null;
        return {
          user_id: p.user_id,
          nome: p.full_name ?? "(Sem nome)",
          cargo,
          unidade_id: p.unidade_id ?? null,
          unidade_nome: p.unidade_id ? lojaById.get(p.unidade_id) ?? null : null,
        };
      });

      if (!unidadeId) return all;

      // Se unidade selecionada, prioriza membros daquela unidade
      const filtered = all.filter((m) => {
        if (m.unidade_id === unidadeId) return true;
        const stores = storesByUser.get(m.user_id) ?? [];
        return stores.includes(unidadeId);
      });
      return filtered.length > 0 ? filtered : all;
    },
  });
}
