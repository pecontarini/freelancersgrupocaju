import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppRole, UserProfile, ConfigOption } from "@/types/freelancer";

export interface UserProfileData {
  profile: UserProfile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isPartner: boolean;
  isGerenteUnidade: boolean;
  unidades: ConfigOption[];
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
          isPartner: false,
          isGerenteUnidade: false,
          unidades: [],
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
      const isPartner = roles.includes("partner");
      const isGerenteUnidade = roles.includes("gerente_unidade");

      // Fetch user stores (multi-loja support)
      let unidades: ConfigOption[] = [];
      const { data: userStoresData, error: userStoresError } = await supabase
        .from("user_stores")
        .select("loja_id")
        .eq("user_id", user.id);

      if (!userStoresError && userStoresData && userStoresData.length > 0) {
        const lojaIds = userStoresData.map((us) => us.loja_id);
        const { data: lojasData, error: lojasError } = await supabase
          .from("config_lojas")
          .select("*")
          .in("id", lojaIds);

        if (!lojasError && lojasData) {
          unidades = lojasData;
        }
      }

      return {
        profile: profileData as UserProfile | null,
        roles,
        isAdmin,
        isPartner,
        isGerenteUnidade,
        unidades,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    profile: data?.profile || null,
    roles: data?.roles || [],
    isAdmin: data?.isAdmin || false,
    isPartner: data?.isPartner || false,
    isGerenteUnidade: data?.isGerenteUnidade || false,
    unidades: data?.unidades || [],
    // Backwards compatibility - first unidade
    unidade: data?.unidades?.[0] || null,
    isLoading,
    error,
    hasNoRole: !isLoading && data?.roles.length === 0,
  };
}
