import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";

interface UnidadeContextType {
  selectedUnidadeId: string | null;
  setSelectedUnidadeId: (id: string | null) => void;
  effectiveUnidadeId: string | null;
}

const UnidadeContext = createContext<UnidadeContextType | undefined>(undefined);

export function UnidadeProvider({ children }: { children: ReactNode }) {
  const { isAdmin, isOperator, unidade, unidades, isLoading } = useUserProfile();
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string | null>(null);

  // For gerente_unidade and operator, auto-select their assigned store
  // For admin, allow selecting any store or null (all)
  useEffect(() => {
    if (!isLoading && !isAdmin && (unidade || unidades.length > 0)) {
      if (unidade) setSelectedUnidadeId(unidade.id);
    }
  }, [isAdmin, unidade, unidades, isLoading]);

  const effectiveUnidadeId = isAdmin ? selectedUnidadeId : (selectedUnidadeId || unidade?.id || null);

  return (
    <UnidadeContext.Provider
      value={{
        selectedUnidadeId,
        setSelectedUnidadeId,
        effectiveUnidadeId,
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
