import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export type ActionPlanStatus = "pending" | "in_analysis" | "resolved";

export interface ActionPlan {
  id: string;
  loja_id: string;
  pain_tag: string;
  referencia_mes: string;
  causa_raiz: string | null;
  medida_tomada: string | null;
  acao_preventiva: string | null;
  evidencia_url: string | null;
  status: ActionPlanStatus;
  deadline_at: string;
  created_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionPlanComment {
  id: string;
  action_plan_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export interface CreateActionPlanInput {
  loja_id: string;
  pain_tag: string;
  referencia_mes: string;
}

export interface UpdateActionPlanInput {
  id: string;
  causa_raiz?: string;
  medida_tomada?: string;
  acao_preventiva?: string;
  evidencia_url?: string;
  status?: ActionPlanStatus;
}

export function useActionPlans(lojaId?: string | null, referenciaMes?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentMonth = referenciaMes || format(new Date(), "yyyy-MM");

  const { data: actionPlans = [], isLoading } = useQuery({
    queryKey: ["action-plans", lojaId, currentMonth],
    queryFn: async () => {
      let query = supabase
        .from("action_plans")
        .select("*")
        .eq("referencia_mes", currentMonth)
        .order("created_at", { ascending: false });

      if (lojaId) {
        query = query.eq("loja_id", lojaId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ActionPlan[];
    },
  });

  const createActionPlan = useMutation({
    mutationFn: async (input: CreateActionPlanInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("action_plans")
        .insert({
          loja_id: input.loja_id,
          pain_tag: input.pain_tag,
          referencia_mes: input.referencia_mes,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action-plans"] });
      toast({
        title: "Plano de ação criado",
        description: "O plano foi criado e está aguardando resolução.",
      });
    },
    onError: (error: Error) => {
      // If duplicate, just ignore
      if (error.message.includes("duplicate")) {
        return;
      }
      toast({
        title: "Erro ao criar plano",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateActionPlan = useMutation({
    mutationFn: async (input: UpdateActionPlanInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: Record<string, unknown> = {};
      
      if (input.causa_raiz !== undefined) updateData.causa_raiz = input.causa_raiz;
      if (input.medida_tomada !== undefined) updateData.medida_tomada = input.medida_tomada;
      if (input.acao_preventiva !== undefined) updateData.acao_preventiva = input.acao_preventiva;
      if (input.evidencia_url !== undefined) updateData.evidencia_url = input.evidencia_url;
      
      if (input.status) {
        updateData.status = input.status;
        
        if (input.status === "in_analysis") {
          updateData.resolved_by = user?.id;
          updateData.resolved_at = new Date().toISOString();
        } else if (input.status === "resolved") {
          updateData.validated_by = user?.id;
          updateData.validated_at = new Date().toISOString();
        }
      }

      const { data, error } = await supabase
        .from("action_plans")
        .update(updateData)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action-plans"] });
      toast({
        title: "Plano atualizado",
        description: "As alterações foram salvas.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    actionPlans,
    isLoading,
    createActionPlan,
    updateActionPlan,
  };
}

export function useActionPlanComments(actionPlanId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["action-plan-comments", actionPlanId],
    queryFn: async () => {
      if (!actionPlanId) return [];
      
      const { data, error } = await supabase
        .from("action_plan_comments")
        .select("*")
        .eq("action_plan_id", actionPlanId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ActionPlanComment[];
    },
    enabled: !!actionPlanId,
  });

  const addComment = useMutation({
    mutationFn: async ({ actionPlanId, message }: { actionPlanId: string; message: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("action_plan_comments")
        .insert({
          action_plan_id: actionPlanId,
          user_id: user.id,
          message,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action-plan-comments"] });
      toast({
        title: "Comentário adicionado",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao comentar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    comments,
    isLoading,
    addComment,
  };
}
