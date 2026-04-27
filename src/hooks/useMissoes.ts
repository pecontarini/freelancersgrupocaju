import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MissaoStatus = "a_fazer" | "em_andamento" | "aguardando" | "concluido";
export type MissaoPrioridade = "alta" | "media" | "baixa";
export type MissaoPapel = "responsavel" | "co_responsavel";

export interface Missao {
  id: string;
  titulo: string;
  descricao: string | null;
  status: MissaoStatus;
  prioridade: MissaoPrioridade;
  unidade_id: string | null;
  criado_por: string;
  prazo: string | null;
  semana_referencia: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissaoMembro {
  missao_id: string;
  user_id: string;
  papel: MissaoPapel;
}

export interface MissaoTarefa {
  id: string;
  missao_id: string;
  descricao: string;
  dia_semana: string | null;
  ordem: number;
  concluido: boolean;
  concluido_por: string | null;
  concluido_em: string | null;
}

export interface MissaoUpsert {
  id?: string;
  titulo?: string;
  descricao?: string | null;
  status?: MissaoStatus;
  prioridade?: MissaoPrioridade;
  unidade_id?: string | null;
  prazo?: string | null;
  semana_referencia?: string | null;
}

export function useMissoes(opts?: { unidadeId?: string | null; onlyMine?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const unidadeId = opts?.unidadeId ?? null;
  const onlyMine = !!opts?.onlyMine;

  const query = useQuery({
    queryKey: ["missoes", unidadeId, onlyMine, user?.id],
    queryFn: async (): Promise<Missao[]> => {
      if (!user) return [];
      let q = supabase.from("missoes" as any).select("*").order("created_at", { ascending: false });
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as Missao[];

      if (onlyMine) {
        const { data: memb } = await supabase
          .from("missao_membros" as any)
          .select("missao_id")
          .eq("user_id", user.id);
        const ids = new Set(((memb ?? []) as any[]).map((m) => m.missao_id));
        rows = rows.filter((r) => ids.has(r.id) || r.criado_por === user.id);
      }
      return rows;
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (input: MissaoUpsert & { membros?: { user_id: string; papel: MissaoPapel }[]; tarefas?: { descricao: string; dia_semana?: string | null; ordem?: number; concluido?: boolean }[] }) => {
      if (!user) throw new Error("Sem usuário.");
      if (!input.titulo) throw new Error("Título obrigatório.");
      const { data: created, error } = await supabase
        .from("missoes" as any)
        .insert({
          titulo: input.titulo,
          descricao: input.descricao ?? null,
          status: input.status ?? "a_fazer",
          prioridade: input.prioridade ?? "media",
          unidade_id: input.unidade_id ?? null,
          prazo: input.prazo ?? null,
          semana_referencia: input.semana_referencia ?? null,
          criado_por: user.id,
        } as any)
        .select("*")
        .single();
      if (error) throw error;
      const newMissao = created as unknown as Missao;

      const membros = input.membros ?? [];
      const hasResponsavel = membros.some((m) => m.papel === "responsavel");
      const fullMembros = hasResponsavel
        ? membros
        : [{ user_id: user.id, papel: "responsavel" as MissaoPapel }, ...membros];

      if (fullMembros.length > 0) {
        const seen = new Set<string>();
        const dedup = fullMembros.filter((m) => {
          if (seen.has(m.user_id)) return false;
          seen.add(m.user_id);
          return true;
        });
        const { error: e2 } = await supabase
          .from("missao_membros" as any)
          .insert(dedup.map((m) => ({ ...m, missao_id: newMissao.id })) as any);
        if (e2) console.warn("Falha ao inserir membros:", e2);
      }

      if ((input.tarefas?.length ?? 0) > 0) {
        const { error: e3 } = await supabase
          .from("missao_tarefas" as any)
          .insert(
            input.tarefas!.map((t, i) => ({
              missao_id: newMissao.id,
              descricao: t.descricao,
              dia_semana: t.dia_semana ?? null,
              ordem: t.ordem ?? i,
              concluido: t.concluido ?? false,
            })) as any,
          );
        if (e3) console.warn("Falha ao inserir tarefas:", e3);
      }

      return newMissao;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missoes"] }),
  });

  const update = useMutation({
    mutationFn: async (input: MissaoUpsert & { id: string }) => {
      const patch: any = {};
      if (input.titulo !== undefined) patch.titulo = input.titulo;
      if (input.descricao !== undefined) patch.descricao = input.descricao;
      if (input.status !== undefined) patch.status = input.status;
      if (input.prioridade !== undefined) patch.prioridade = input.prioridade;
      if (input.unidade_id !== undefined) patch.unidade_id = input.unidade_id;
      if (input.prazo !== undefined) patch.prazo = input.prazo;
      if (input.semana_referencia !== undefined) patch.semana_referencia = input.semana_referencia;
      const { error } = await supabase.from("missoes" as any).update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missoes"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("missoes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missoes"] }),
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("missoes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "missoes" }, () => {
        qc.invalidateQueries({ queryKey: ["missoes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "missao_membros" }, () => {
        qc.invalidateQueries({ queryKey: ["missoes"] });
        qc.invalidateQueries({ queryKey: ["missao-membros"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return { ...query, create, update, remove };
}
