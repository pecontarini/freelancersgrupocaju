import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FreelancerProfile {
  id: string;
  cpf: string;
  nome_completo: string;
  telefone: string | null;
  foto_url: string | null;
  tipo_chave_pix: string | null;
  chave_pix: string | null;
  created_at: string;
}

export function useFreelancerProfiles() {
  const queryClient = useQueryClient();

  const lookupByCpf = async (cpf: string): Promise<FreelancerProfile | null> => {
    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select("*")
      .eq("cpf", cpf)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const createProfile = useMutation({
    mutationFn: async (profile: {
      cpf: string;
      nome_completo: string;
      telefone?: string;
      foto_url?: string;
      tipo_chave_pix?: string;
      chave_pix?: string;
    }) => {
      const { data, error } = await supabase
        .from("freelancer_profiles")
        .insert(profile)
        .select()
        .single();
      if (error) throw error;
      return data as FreelancerProfile;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["freelancer-profiles"] }),
  });

  const updateProfile = useMutation({
    mutationFn: async (params: {
      id: string;
      nome_completo?: string;
      telefone?: string | null;
      foto_url?: string | null;
      tipo_chave_pix?: string | null;
      chave_pix?: string | null;
    }) => {
      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from("freelancer_profiles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as FreelancerProfile;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["freelancer-profiles"] }),
  });

  return { lookupByCpf, createProfile, updateProfile };
}
