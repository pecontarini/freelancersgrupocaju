import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SupervisionAudit {
  id: string;
  loja_id: string;
  audit_date: string;
  global_score: number;
  pdf_url: string | null;
  processed_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupervisionFailure {
  id: string;
  audit_id: string;
  loja_id: string;
  item_name: string;
  category: string | null;
  status: "pending" | "resolved" | "validated";
  is_recurring: boolean;
  resolution_photo_url: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  validated_at: string | null;
  validated_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useSupervisionAudits(lojaId?: string | null, monthYear?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: audits = [], isLoading: isLoadingAudits } = useQuery({
    queryKey: ["supervision-audits", lojaId, monthYear],
    queryFn: async () => {
      let query = supabase.from("supervision_audits").select("*");
      
      if (lojaId) {
        query = query.eq("loja_id", lojaId);
      }
      
      if (monthYear) {
        const [year, month] = monthYear.split("-");
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];
        query = query.gte("audit_date", startDate).lte("audit_date", endDate);
      }
      
      const { data, error } = await query.order("audit_date", { ascending: false });
      
      if (error) throw error;
      return data as SupervisionAudit[];
    },
    enabled: true,
  });

  const { data: failures = [], isLoading: isLoadingFailures } = useQuery({
    queryKey: ["supervision-failures", lojaId],
    queryFn: async () => {
      let query = supabase.from("supervision_failures").select("*");
      
      if (lojaId) {
        query = query.eq("loja_id", lojaId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as SupervisionFailure[];
    },
    enabled: true,
  });

  const createAuditMutation = useMutation({
    mutationFn: async (audit: Omit<SupervisionAudit, "id" | "created_at" | "updated_at" | "processed_at">) => {
      const { data, error } = await supabase
        .from("supervision_audits")
        .insert(audit)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervision-audits"] });
      toast({ title: "Auditoria registrada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar auditoria", description: error.message, variant: "destructive" });
    },
  });

  const createFailuresMutation = useMutation({
    mutationFn: async (failures: Omit<SupervisionFailure, "id" | "created_at" | "updated_at">[]) => {
      const { data, error } = await supabase
        .from("supervision_failures")
        .insert(failures)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervision-failures"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar falhas", description: error.message, variant: "destructive" });
    },
  });

  const resolveFailureMutation = useMutation({
    mutationFn: async ({ 
      failureId, 
      photoUrl 
    }: { 
      failureId: string; 
      photoUrl?: string;
    }) => {
      const { data, error } = await supabase
        .from("supervision_failures")
        .update({
          status: "resolved",
          resolution_photo_url: photoUrl || null,
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", failureId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervision-failures"] });
      toast({ title: "Item marcado como corrigido" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar item", description: error.message, variant: "destructive" });
    },
  });

  const validateFailureMutation = useMutation({
    mutationFn: async (failureId: string) => {
      const { data, error } = await supabase
        .from("supervision_failures")
        .update({
          status: "validated",
          validated_at: new Date().toISOString(),
          validated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", failureId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervision-failures"] });
      toast({ title: "Item validado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao validar item", description: error.message, variant: "destructive" });
    },
  });

  // Get pending failures (not resolved or validated)
  const pendingFailures = failures.filter((f) => f.status === "pending");
  
  // Get resolved failures awaiting validation
  const awaitingValidation = failures.filter((f) => f.status === "resolved");

  // Detect recurring failures (appeared in multiple audits)
  const recurringFailureItems = failures.reduce((acc, failure) => {
    const key = `${failure.loja_id}-${failure.item_name}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const isRecurring = (failure: SupervisionFailure) => {
    const key = `${failure.loja_id}-${failure.item_name}`;
    return recurringFailureItems[key] > 1;
  };

  return {
    audits,
    failures,
    pendingFailures,
    awaitingValidation,
    isLoadingAudits,
    isLoadingFailures,
    createAudit: createAuditMutation.mutateAsync,
    createFailures: createFailuresMutation.mutateAsync,
    resolveFailure: resolveFailureMutation.mutateAsync,
    validateFailure: validateFailureMutation.mutateAsync,
    isRecurring,
  };
}
