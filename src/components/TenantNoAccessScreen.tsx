import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { buildTenantUrl } from "@/lib/tenantResolver";
import { AlertCircle, LogOut, ExternalLink } from "lucide-react";
import { useBrandLogo, BRAND_NAME } from "@/lib/brand";

interface Props {
  /** Slugs de tenants aos quais o usuário TEM acesso. */
  availableSlugs: string[];
  /** Slug do tenant do subdomínio atual (que o usuário NÃO tem acesso). */
  currentHostSlug: string;
}

export function TenantNoAccessScreen({ availableSlugs, currentHostSlug }: Props) {
  const { src: brandLogo, alt: brandAlt } = useBrandLogo();

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="flex justify-center">
          <img src={brandLogo} alt={brandAlt} className="h-10 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Sem acesso a esta empresa</h1>
            <p className="text-sm text-muted-foreground">
              Seu usuário não está vinculado a esta empresa em <strong>{BRAND_NAME}</strong>.
            </p>
          </div>
        </div>

        {availableSlugs.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Você tem acesso a:
            </p>
            <div className="space-y-1.5">
              {availableSlugs.map((slug) => (
                <a
                  key={slug}
                  href={buildTenantUrl(slug)}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <span className="text-sm font-medium">{slug}</span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Seu usuário ainda não está vinculado a nenhuma empresa. Contate o
            administrador.
          </p>
        )}

        <Button variant="outline" onClick={signOut} className="w-full gap-2">
          <LogOut className="h-4 w-4" /> Sair
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Subdomínio acessado: <code>{currentHostSlug}</code>
        </p>
      </Card>
    </div>
  );
}
