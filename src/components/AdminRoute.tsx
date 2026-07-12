import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { BrandSplash } from "@/components/motion";
import { NoAccessScreen } from "@/components/NoAccessScreen";

interface Props {
  children: ReactNode;
  /** Papel exigido. Padrão: super_admin. */
  requireSuperAdmin?: boolean;
}

/**
 * Guarda rotas administrativas. Exige autenticação + papel de super_admin
 * (ou admin, quando `requireSuperAdmin=false`). Caso contrário exibe
 * a tela de "sem acesso".
 */
export function AdminRoute({ children, requireSuperAdmin = true }: Props) {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, isAdmin, isLoading } = useUserProfile();

  if (authLoading || (user && isLoading)) {
    return <BrandSplash variant="full" message="Verificando permissões..." />;
  }

  if (!user) return <Navigate to="/auth" replace />;

  const allowed = requireSuperAdmin ? isSuperAdmin : isSuperAdmin || isAdmin;
  if (!allowed) {
    return (
      <NoAccessScreen
        title="Acesso restrito"
        description={
          requireSuperAdmin
            ? "Esta área é exclusiva para super administradores da plataforma."
            : "Você não possui permissão administrativa para acessar esta área."
        }
      />
    );
  }

  return <>{children}</>;
}
