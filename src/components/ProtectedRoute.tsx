import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BrandSplash } from "@/components/motion";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <BrandSplash variant="full" message="Carregando seu portal..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
