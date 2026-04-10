import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FreelancerCheckin {
  id: string;
  freelancer_id: string;
  loja_id: string;
  checkin_at: string;
  checkin_selfie_url: string;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkout_at: string | null;
  checkout_selfie_url: string | null;
  checkout_lat: number | null;
  checkout_lng: number | null;
  valor_informado: number | null;
  valor_aprovado: number | null;
  valor_status: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  valor_approved_by: string | null;
  valor_approved_at: string | null;
  rejection_reason: string | null;
  checkin_date: string;
  created_at: string;
  freelancer_profiles?: {
    id: string;
    cpf: string;
    nome_completo: string;
    telefone: string | null;
    foto_url: string | null;
  };
}

export function useFreelancerCheckins(lojaId?: string, date?: string) {
  const queryClient = useQueryClient();

  const checkinsQuery = useQuery({
    queryKey: ["freelancer-checkins", lojaId, date],
    queryFn: async () => {
      let query = supabase
        .from("freelancer_checkins")
        .select("*, freelancer_profiles(*)")
        .order("checkin_at", { ascending: false });

      if (lojaId) query = query.eq("loja_id", lojaId);
      if (date) query = query.eq("checkin_date", date);

      const { data, error } = await query;
      if (error) throw error;
      return data as FreelancerCheckin[];
    },
    enabled: !!lojaId,
  });

  const findOpenCheckin = async (freelancerId: string, lojaId: string, today: string) => {
    // First check for open checkins (active session)
    const { data: openData, error: openErr } = await supabase
      .from("freelancer_checkins")
      .select("*")
      .eq("freelancer_id", freelancerId)
      .eq("loja_id", lojaId)
      .eq("checkin_date", today)
      .eq("status", "open")
      .maybeSingle();
    if (openErr) throw openErr;
    if (openData) return openData;
    return null;
  };

  const findPendingScheduleCheckin = async (freelancerId: string, lojaId: string, today: string) => {
    const { data, error } = await supabase
      .from("freelancer_checkins")
      .select("*")
      .eq("freelancer_id", freelancerId)
      .eq("loja_id", lojaId)
      .eq("checkin_date", today)
      .eq("status", "pending_schedule")
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const createCheckin = useMutation({
    mutationFn: async (checkin: {
      freelancer_id: string;
      loja_id: string;
      checkin_selfie_url: string;
      checkin_lat?: number;
      checkin_lng?: number;
      valor_informado?: number;
    }) => {
      const { data, error } = await supabase
        .from("freelancer_checkins")
        .insert(checkin)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["freelancer-checkins"] }),
  });

  const doCheckout = useMutation({
    mutationFn: async (params: {
      checkinId: string;
      checkout_selfie_url: string;
      checkout_lat?: number;
      checkout_lng?: number;
    }) => {
      const { data, error } = await supabase
        .from("freelancer_checkins")
        .update({
          checkout_at: new Date().toISOString(),
          checkout_selfie_url: params.checkout_selfie_url,
          checkout_lat: params.checkout_lat,
          checkout_lng: params.checkout_lng,
          status: "completed",
        })
        .eq("id", params.checkinId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["freelancer-checkins"] }),
  });

  const approvePresence = useMutation({
    mutationFn: async (params: { checkinId: string; userId: string }) => {
      const { error } = await supabase
        .from("freelancer_checkins")
        .update({
          status: "approved",
          approved_by: params.userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", params.checkinId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["freelancer-checkins"] }),
  });

  const rejectPresence = useMutation({
    mutationFn: async (params: { checkinId: string; userId: string; reason: string }) => {
      const { error } = await supabase
        .from("freelancer_checkins")
        .update({
          status: "rejected",
          approved_by: params.userId,
          approved_at: new Date().toISOString(),
          rejection_reason: params.reason,
        })
        .eq("id", params.checkinId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["freelancer-checkins"] }),
  });

  const approveValue = useMutation({
    mutationFn: async (params: { checkinId: string; userId: string; valorAprovado: number }) => {
      const { error } = await supabase
        .from("freelancer_checkins")
        .update({
          valor_aprovado: params.valorAprovado,
          valor_status: "approved",
          valor_approved_by: params.userId,
          valor_approved_at: new Date().toISOString(),
        })
        .eq("id", params.checkinId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["freelancer-checkins"] }),
  });

  return {
    checkins: checkinsQuery.data ?? [],
    isLoading: checkinsQuery.isLoading,
    findOpenCheckin,
    findPendingScheduleCheckin,
    createCheckin,
    doCheckout,
    approvePresence,
    rejectPresence,
    approveValue,
  };
}
