import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type N8nEndpoint = {
  id: string;
  nome: string;
  slug: string;
  secret_token: string;
  tipo_dado: string;
  ativo: boolean;
  loja_id_default: string | null;
  ultima_execucao_at: string | null;
  total_recebido: number;
  created_at: string;
  updated_at: string;
};

export type N8nExecution = {
  id: string;
  endpoint_id: string;
  status: "success" | "partial" | "error";
  payload_recebido: any;
  linhas_processadas: number;
  linhas_inseridas: number;
  linhas_duplicadas: number;
  linhas_invalidas: number;
  erros: any;
  created_at: string;
};

function genSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function genToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function useN8nWebhooks() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["n8n_webhook_endpoints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("n8n_webhook_endpoints")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 49);
      if (error) throw error;
      return (data || []) as N8nEndpoint[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: {
      nome: string;
      slug?: string;
      loja_id_default?: string | null;
      ativo?: boolean;
    }) => {
      const slug = input.slug?.trim() || genSlug(input.nome);
      const secret_token = genToken();
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("n8n_webhook_endpoints")
        .insert({
          nome: input.nome,
          slug,
          secret_token,
          tipo_dado: "reclamacoes",
          ativo: input.ativo ?? true,
          loja_id_default: input.loja_id_default || null,
          created_by: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as N8nEndpoint;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["n8n_webhook_endpoints"] });
      toast.success("Endpoint criado com sucesso");
    },
    onError: (err: any) =>
      toast.error(err.message?.includes("duplicate") ? "Slug já existe" : err.message || "Erro ao criar endpoint"),
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; nome?: string; ativo?: boolean; loja_id_default?: string | null }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from("n8n_webhook_endpoints").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["n8n_webhook_endpoints"] });
      toast.success("Endpoint atualizado");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar"),
  });

  const regenerateToken = useMutation({
    mutationFn: async (id: string) => {
      const secret_token = genToken();
      const { error } = await supabase
        .from("n8n_webhook_endpoints")
        .update({ secret_token })
        .eq("id", id);
      if (error) throw error;
      return secret_token;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["n8n_webhook_endpoints"] });
      toast.success("Novo token gerado");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao gerar token"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("n8n_webhook_endpoints").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["n8n_webhook_endpoints"] });
      toast.success("Endpoint removido");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao remover"),
  });

  return { list, create, update, regenerateToken, remove };
}

export function useN8nExecutions(endpointId: string | null) {
  return useQuery({
    queryKey: ["n8n_webhook_executions", endpointId],
    queryFn: async () => {
      if (!endpointId) return [];
      const { data, error } = await supabase
        .from("n8n_webhook_executions")
        .select("*")
        .eq("endpoint_id", endpointId)
        .order("created_at", { ascending: false })
        .range(0, 49);
      if (error) throw error;
      return (data || []) as N8nExecution[];
    },
    enabled: !!endpointId,
  });
}

export function buildWebhookUrl(slug: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1/ingest-reclamacoes/${slug}`;
}
