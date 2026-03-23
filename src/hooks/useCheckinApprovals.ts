import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCheckinApprovals() {
  const queryClient = useQueryClient();

  const batchApprove = useMutation({
    mutationFn: async (params: {
      lojaId: string;
      approvalDate: string;
      approvedBy: string;
      pinHash: string;
      checkinIds: string[];
    }) => {
      const { data, error } = await supabase
        .from("checkin_approvals")
        .insert({
          loja_id: params.lojaId,
          approval_date: params.approvalDate,
          approved_by: params.approvedBy,
          pin_hash: params.pinHash,
          checkin_ids: params.checkinIds,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["checkin-approvals"] });
    },
  });

  return { batchApprove };
}
