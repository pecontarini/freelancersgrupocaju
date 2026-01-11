import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppRole, UserProfile, ConfigOption } from "@/types/freelancer";

export interface UserProfileData {
  profile: UserProfile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isGerenteUnidade: boolean;
  unidade: ConfigOption | null;
}

export function useUserProfile() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async (): Promise<UserProfileData> => {
      if (!user) {
        return {
          profile: null,
          roles: [],
          isAdmin: false,
          isGerenteUnidade: false,
          unidade: null,
        };
      }

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        throw profileError;
      }

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
        throw rolesError;
      }

      const roles = (rolesData?.map((r) => r.role) || []) as AppRole[];
      const isAdmin = roles.includes("admin");
      const isGerenteUnidade = roles.includes("gerente_unidade");

      // Fetch unidade if user has one
      let unidade: ConfigOption | null = null;
      if (profileData?.unidade_id) {
        const { data: unidadeData, error: unidadeError } = await supabase
          .from("config_lojas")
          .select("*")
          .eq("id", profileData.unidade_id)
          .maybeSingle();

        if (!unidadeError && unidadeData) {
          unidade = unidadeData;
        }
      }

      return {
        profile: profileData as UserProfile | null,
        roles,
        isAdmin,
        isGerenteUnidade,
        unidade,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    profile: data?.profile || null,
    roles: data?.roles || [],
    isAdmin: data?.isAdmin || false,
    isGerenteUnidade: data?.isGerenteUnidade || false,
    unidade: data?.unidade || null,
    isLoading,
    error,
    hasNoRole: !isLoading && data?.roles.length === 0,
  };
}
