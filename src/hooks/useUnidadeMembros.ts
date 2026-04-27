import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnidadeMembro {
  user_id: string;
  nome: string;
  cargo: string | null;
  unidade_id: string | null;
  unidade_nome: string | null;
}

interface Options {
  /**
   * Quando true, inclui usuários com role 'admin' mesmo sem vínculo direto à unidade.
   * Default: false — para evitar que IA/forms atribuam tarefas a admins de outras lojas.
   */
  includeAdmins?: boolean;
}

/**
 * Lista usuários candidatos a serem responsáveis/co-responsáveis de uma missão.
 * - Se unidadeId for fornecido, retorna ESTRITAMENTE quem está vinculado à loja
 *   (via profiles.unidade_id OU user_stores). Sem fallback "todos os usuários" —
 *   isso evita que líderes/IA marquem funcionários de outras unidades.
 * - Sem unidadeId, retorna todos.
 */
export function useUnidadeMembros(unidadeId: string | null, opts?: Options) {
  const includeAdmins = !!opts?.includeAdmins;

  return useQuery({
    queryKey: ["unidade-membros", unidadeId, includeAdmins],
    queryFn: async (): Promise<UnidadeMembro[]> => {
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

      // Filtro estrito: só quem está vinculado à unidade selecionada.
      // Sem fallback — uma loja sem membros vinculados deve mostrar lista vazia,
      // forçando o admin a vincular pessoas em vez de a IA inventar responsáveis.
      const filtered = all.filter((m) => {
        if (m.unidade_id === unidadeId) return true;
        const userStores = storesByUser.get(m.user_id) ?? [];
        if (userStores.includes(unidadeId)) return true;
        if (includeAdmins) {
          const userRoles = rolesByUser.get(m.user_id) ?? [];
          if (userRoles.includes("admin")) return true;
        }
        return false;
      });
      return filtered;
    },
  });
}
