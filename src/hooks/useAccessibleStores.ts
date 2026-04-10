import { useMemo } from "react";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";

/**
 * Returns the list of stores the current user can access based on their role.
 * Admin: all stores from config_lojas
 * Others: only their linked stores from user profile
 */
export function useAccessibleStores() {
  const { options: allLojas, isLoading: loadingLojas } = useConfigLojas();
  const { isAdmin, unidades, isLoading: loadingProfile } = useUserProfile();

  const stores = useMemo(() => {
    if (isAdmin) return allLojas;
    return unidades;
  }, [isAdmin, allLojas, unidades]);

  return {
    stores,
    isLoading: loadingLojas || loadingProfile,
  };
}
