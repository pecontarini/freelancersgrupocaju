import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ImportJob = {
  id: string;
  origem: string;
  tipo_destino: string | null;
  status: string;
  ai_confianca: number | null;
  ai_model: string | null;
  total_linhas: number;
  linhas_validas: number;
  linhas_importadas: number;
  lojas_nao_mapeadas: any;
  preview_data: any;
  mapeamento_colunas: any;
  file_name: string | null;
  file_mime: string | null;
  source_url: string | null;
  erro: string | null;
  created_at: string;
  confirmed_at: string | null;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function useImportJobs() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["import_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 49);
      if (error) throw error;
      return (data || []) as ImportJob[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as ImportJob[] | undefined;
      const hasPending = data?.some((j) =>
        ["extracting", "preview_ready"].includes(j.status)
      );
      return hasPending ? 4000 : false;
    },
  });

  const extract = useMutation({
    mutationFn: async (params: {
      file: File;
      hintDestino?: "store_performance" | "store_performance_entries" | "reclamacoes";
    }) => {
      const fileBase64 = await fileToBase64(params.file);
      const { data, error } = await supabase.functions.invoke("ai-import-extract", {
        body: {
          fileBase64,
          fileName: params.file.name,
          mimeType: params.file.type || "application/octet-stream",
          hintDestino: params.hintDestino,
          origem: "manual_upload",
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na extração");
      return data as { jobId: string; confianca: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["import_jobs"] });
      toast.success("Extração concluída — revise o preview");
    },
    onError: (err: any) => toast.error(err.message || "Erro na extração"),
  });

  const confirm = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("ai-import-confirm", {
        body: { jobId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao confirmar");
      return data as { linhas_importadas: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["import_jobs"] });
      qc.invalidateQueries({ queryKey: ["store_performance"] });
      qc.invalidateQueries({ queryKey: ["store_performance_entries"] });
      qc.invalidateQueries({ queryKey: ["reclamacoes"] });
      toast.success(`${data.linhas_importadas} linhas importadas`);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao confirmar"),
  });

  const cancel = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("ai-import-cancel", {
        body: { jobId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao cancelar");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["import_jobs"] });
      toast.success("Importação cancelada");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao cancelar"),
  });

  return { list, extract, confirm, cancel };
}
