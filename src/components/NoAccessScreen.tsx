import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBrandLogo, BRAND_NAME } from "@/lib/brand";

interface Props {
  title?: string;
  description?: string;
}

export function NoAccessScreen({
  title = "Sem acesso",
  description = "Você não tem permissão para acessar esta página.",
}: Props) {
  const navigate = useNavigate();
  const { src: brandLogo, alt: brandAlt } = useBrandLogo();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="flex justify-center">
          <img src={brandLogo} alt={brandAlt} className="h-10 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Se você acredita que isso é um erro, contate um administrador da{" "}
          <strong>{BRAND_NAME}</strong>.
        </p>

        <div className="flex flex-col gap-2">
          <Button onClick={() => navigate("/", { replace: true })} className="w-full gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao início
          </Button>
          <Button variant="outline" onClick={signOut} className="w-full gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </Card>
    </div>
  );
}
