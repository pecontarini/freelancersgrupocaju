import { SidebarTrigger } from "@/components/ui/sidebar";
import { UnidadeSelector } from "@/components/UnidadeSelector";
import { useUserProfile } from "@/hooks/useUserProfile";

interface PortalHeaderProps {
  title: string;
  subtitle?: string;
  selectedUnidadeId: string | null;
  onUnidadeChange: (id: string | null) => void;
}

export function PortalHeader({
  title,
  subtitle,
  selectedUnidadeId,
  onUnidadeChange,
}: PortalHeaderProps) {
  const { isAdmin, isGerenteUnidade, unidades } = useUserProfile();

  const showUnidadeSelector =
    isAdmin || (isGerenteUnidade && unidades.length > 1);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="font-display text-xl font-bold uppercase tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      {showUnidadeSelector && (
        <UnidadeSelector
          selectedUnidadeId={selectedUnidadeId}
          onUnidadeChange={onUnidadeChange}
        />
      )}

      {/* Single store indicator for gerente */}
      {isGerenteUnidade && !isAdmin && unidades.length === 1 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">{unidades[0]?.nome}</span>
        </div>
      )}
    </header>
  );
}
