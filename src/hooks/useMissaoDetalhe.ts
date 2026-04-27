import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { MissaoMembro, MissaoPapel, MissaoTarefa } from "./useMissoes";

export interface MissaoComentario {
  id: string;
  missao_id: string;
  user_id: string;
  texto: string;
  created_at: string;
}

export interface MissaoAnexo {
  id: string;
  missao_id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
}

export function useMissaoDetalhe(missaoId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const membrosQ = useQuery({
    queryKey: ["missao-membros", missaoId],
    queryFn: async (): Promise<MissaoMembro[]> => {
      if (!missaoId) return [];
      const { data, error } = await supabase
        .from("missao_membros" as any)
        .select("*")
        .eq("missao_id", missaoId);
      if (error) throw error;
      return (data ?? []) as unknown as MissaoMembro[];
    },
    enabled: !!missaoId,
  });

  const tarefasQ = useQuery({
    queryKey: ["missao-tarefas", missaoId],
    queryFn: async (): Promise<MissaoTarefa[]> => {
      if (!missaoId) return [];
      const { data, error } = await supabase
        .from("missao_tarefas" as any)
        .select("*")
        .eq("missao_id", missaoId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MissaoTarefa[];
    },
    enabled: !!missaoId,
  });

  const comentariosQ = useQuery({
    queryKey: ["missao-comentarios", missaoId],
    queryFn: async (): Promise<MissaoComentario[]> => {
      if (!missaoId) return [];
      const { data, error } = await supabase
        .from("missao_comentarios" as any)
        .select("*")
        .eq("missao_id", missaoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MissaoComentario[];
    },
    enabled: !!missaoId,
  });

  const anexosQ = useQuery({
    queryKey: ["missao-anexos", missaoId],
    queryFn: async (): Promise<MissaoAnexo[]> => {
      if (!missaoId) return [];
      const { data, error } = await supabase
        .from("missao_anexos" as any)
        .select("*")
        .eq("missao_id", missaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MissaoAnexo[];
    },
    enabled: !!missaoId,
  });

  const addMembro = useMutation({
    mutationFn: async (params: { user_id: string; papel: MissaoPapel }) => {
      if (!missaoId) throw new Error("missaoId nulo");
      const { error } = await supabase
        .from("missao_membros" as any)
        .insert({ missao_id: missaoId, user_id: params.user_id, papel: params.papel } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missao-membros", missaoId] });
      qc.invalidateQueries({ queryKey: ["missoes"] });
    },
  });

  const removeMembro = useMutation({
    mutationFn: async (params: { user_id: string }) => {
      if (!missaoId) throw new Error("missaoId nulo");
      const { error } = await supabase
        .from("missao_membros" as any)
        .delete()
        .eq("missao_id", missaoId)
        .eq("user_id", params.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missao-membros", missaoId] });
      qc.invalidateQueries({ queryKey: ["missoes"] });
    },
  });

  const addTarefa = useMutation({
    mutationFn: async (params: { descricao: string; dia_semana?: string | null }) => {
      if (!missaoId) throw new Error("missaoId nulo");
      const ordem = (tarefasQ.data?.length ?? 0);
      const { error } = await supabase.from("missao_tarefas" as any).insert({
        missao_id: missaoId,
        descricao: params.descricao,
        dia_semana: params.dia_semana ?? null,
        ordem,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missao-tarefas", missaoId] }),
  });

  const toggleTarefa = useMutation({
    mutationFn: async (params: { id: string; concluido: boolean }) => {
      const { error } = await supabase
        .from("missao_tarefas" as any)
        .update({
          concluido: params.concluido,
          concluido_por: params.concluido ? user?.id ?? null : null,
          concluido_em: params.concluido ? new Date().toISOString() : null,
        } as any)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missao-tarefas", missaoId] }),
  });

  const removeTarefa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("missao_tarefas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missao-tarefas", missaoId] }),
  });

  const addComentario = useMutation({
    mutationFn: async (texto: string) => {
      if (!missaoId || !user) throw new Error("Faltam dados.");
      const { error } = await supabase
        .from("missao_comentarios" as any)
        .insert({ missao_id: missaoId, user_id: user.id, texto } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missao-comentarios", missaoId] }),
  });

  const addAnexo = useMutation({
    mutationFn: async (file: File) => {
      if (!missaoId || !user) throw new Error("Faltam dados.");
      const path = `${user.id}/${missaoId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("missao-anexos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("missao-anexos")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      const url = signed?.signedUrl ?? path;
      const { error } = await supabase.from("missao_anexos" as any).insert({
        missao_id: missaoId,
        user_id: user.id,
        file_url: url,
        file_name: file.name,
        mime_type: file.type,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missao-anexos", missaoId] }),
  });

  // Realtime para esta missão específica
  useEffect(() => {
    if (!missaoId) return;
    const channel = supabase
      .channel(`missao-${missaoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "missao_tarefas", filter: `missao_id=eq.${missaoId}` },
        () => qc.invalidateQueries({ queryKey: ["missao-tarefas", missaoId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "missao_comentarios", filter: `missao_id=eq.${missaoId}` },
        () => qc.invalidateQueries({ queryKey: ["missao-comentarios", missaoId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "missao_membros", filter: `missao_id=eq.${missaoId}` },
        () => qc.invalidateQueries({ queryKey: ["missao-membros", missaoId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [missaoId, qc]);

  return {
    membros: membrosQ.data ?? [],
    tarefas: tarefasQ.data ?? [],
    comentarios: comentariosQ.data ?? [],
    anexos: anexosQ.data ?? [],
    isLoading:
      membrosQ.isLoading || tarefasQ.isLoading || comentariosQ.isLoading || anexosQ.isLoading,
    addMembro,
    removeMembro,
    addTarefa,
    toggleTarefa,
    removeTarefa,
    addComentario,
    addAnexo,
  };
}
