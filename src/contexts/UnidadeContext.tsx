import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";

interface UnidadeContextType {
  selectedUnidadeId: string | null;
  setSelectedUnidadeId: (id: string | null) => void;
  effectiveUnidadeId: string | null;
  /** Stores the user can access based on role */
  availableUnidades: { id: string; nome: string }[];
}

const UnidadeContext = createContext<UnidadeContextType | undefined>(undefined);

export function UnidadeProvider({ children }: { children: ReactNode }) {
  const { isAdmin, isOperator, isGerenteUnidade, unidade, unidades, isLoading } = useUserProfile();
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Auto-select ONLY for single-store users; multi-store users start at null ("todas")
  useEffect(() => {
    if (isLoading || initialized) return;
    if (!isAdmin && unidades.length === 1) {
      setSelectedUnidadeId(unidades[0].id);
    } else if (!isAdmin && unidade) {
      setSelectedUnidadeId(unidade.id);
    }
    setInitialized(true);
  }, [isAdmin, unidade, unidades, isLoading, initialized]);

  // For non-admin: effectiveUnidadeId falls back to first store when selection is null
  // For admin: null means "all stores"
  const effectiveUnidadeId = isAdmin
    ? selectedUnidadeId
    : selectedUnidadeId || unidade?.id || (unidades.length > 0 ? unidades[0].id : null);

  const availableUnidades = useMemo(() => {
    // Non-admin users only see their linked stores
    if (!isAdmin) return unidades;
    // Admin sees all — but that list comes from useConfigLojas, not here
    // We return unidades (empty for admin) so consumers know to use useConfigLojas
    return unidades;
  }, [isAdmin, unidades]);

  return (
    <UnidadeContext.Provider
      value={{
        selectedUnidadeId,
        setSelectedUnidadeId,
        effectiveUnidadeId,
        availableUnidades,
      }}
    >
      {children}
    </UnidadeContext.Provider>
  );
}

export function useUnidade() {
  const context = useContext(UnidadeContext);
  if (context === undefined) {
    throw new Error("useUnidade must be used within an UnidadeProvider");
  }
  return context;
}
