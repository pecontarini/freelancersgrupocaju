import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fetchAllRows } from "@/lib/fetchAllRows";

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
  // New fields for detailed failure info
  detalhes_falha: string | null;
  url_foto_evidencia: string | null;
}

export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export function useSupervisionAudits(
  lojaId?: string | null, 
  monthYear?: string,
  dateRange?: DateRangeFilter
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: audits = [], isLoading: isLoadingAudits } = useQuery({
    queryKey: ["supervision-audits", lojaId, monthYear, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      return fetchAllRows<SupervisionAudit>(() => {
        let query = supabase.from("supervision_audits").select("*");
        
        if (lojaId) {
          query = query.eq("loja_id", lojaId);
        }
        
        if (dateRange?.from) {
          const startDate = dateRange.from.toISOString().split("T")[0];
          query = query.gte("audit_date", startDate);
          
          if (dateRange.to) {
            const endDate = dateRange.to.toISOString().split("T")[0];
            query = query.lte("audit_date", endDate);
          }
        } else if (monthYear) {
          const [year, month] = monthYear.split("-");
          const startDate = `${year}-${month}-01`;
          const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];
          query = query.gte("audit_date", startDate).lte("audit_date", endDate);
        }
        
        return query.order("audit_date", { ascending: false });
      });
    },
    enabled: true,
  });

  // Fetch failures - use date range if provided, otherwise 60-day window for recurrence
  const { data: failures = [], isLoading: isLoadingFailures } = useQuery({
    queryKey: ["supervision-failures", lojaId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      return fetchAllRows<SupervisionFailure>(() => {
        let query = supabase
          .from("supervision_failures")
          .select("*");
        
        if (dateRange?.from) {
          const startDate = dateRange.from.toISOString();
          query = query.gte("created_at", startDate);
          
          if (dateRange.to) {
            const endDate = new Date(dateRange.to);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt("created_at", endDate.toISOString());
          }
        } else {
          const sixtyDaysAgo = new Date();
          sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
          query = query.gte("created_at", sixtyDaysAgo.toISOString());
        }
        
        if (lojaId) {
          query = query.eq("loja_id", lojaId);
        }
        
        return query.order("created_at", { ascending: false });
      });
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

  // Fetch audit sector scores for checklist type info
  const auditIds = audits.map((a) => a.id);
  const { data: auditSectorScores = [], isLoading: isLoadingScores } = useQuery({
    queryKey: ["audit-sector-scores-by-audits", auditIds],
    queryFn: async () => {
      if (auditIds.length === 0) return [];
      // Fetch in batches of 50 to avoid query size limits
      const results: Array<{ audit_id: string; checklist_type: string }> = [];
      for (let i = 0; i < auditIds.length; i += 50) {
        const batch = auditIds.slice(i, i + 50);
        const { data, error } = await supabase
          .from("audit_sector_scores")
          .select("audit_id, checklist_type")
          .in("audit_id", batch);
        if (error) throw error;
        if (data) results.push(...data);
      }
      return results;
    },
    enabled: auditIds.length > 0,
  });

  // Build a map: audit_id -> unique checklist types
  const auditChecklistTypes = useMemo(() => {
    const map: Record<string, string[]> = {};
    auditSectorScores.forEach((s) => {
      if (!map[s.audit_id]) map[s.audit_id] = [];
      if (!map[s.audit_id].includes(s.checklist_type)) {
        map[s.audit_id].push(s.checklist_type);
      }
    });
    return map;
  }, [auditSectorScores]);

  // Delete audit mutation (cascade)
  const deleteAuditMutation = useMutation({
    mutationFn: async (auditId: string) => {
      // Delete in order: failures -> sector scores -> audit
      const { error: e1 } = await supabase
        .from("supervision_failures")
        .delete()
        .eq("audit_id", auditId);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("audit_sector_scores")
        .delete()
        .eq("audit_id", auditId);
      if (e2) throw e2;

      const { error: e3 } = await supabase
        .from("supervision_audits")
        .delete()
        .eq("id", auditId);
      if (e3) throw e3;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervision-audits"] });
      queryClient.invalidateQueries({ queryKey: ["supervision-failures"] });
      queryClient.invalidateQueries({ queryKey: ["audit-sector-scores-by-audits"] });
      toast({ title: "Auditoria excluída com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir auditoria", description: error.message, variant: "destructive" });
    },
  });

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
    auditChecklistTypes,
    deleteAudit: deleteAuditMutation.mutateAsync,
    isDeletingAudit: deleteAuditMutation.isPending,
  };
}
