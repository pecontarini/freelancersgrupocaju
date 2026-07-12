import { SidebarTrigger } from "@/components/ui/sidebar";
import { UnidadeSelector } from "@/components/UnidadeSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const { isAdmin, isOperator, isGerenteUnidade, unidades } = useUserProfile();
  const isMobile = useIsMobile();

  const showUnidadeSelector =
    isAdmin || isOperator || (isGerenteUnidade && unidades.length > 1);

  // Mobile layout - more compact
  if (isMobile) {
    return (
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="cj-header__title text-lg">
              {title}
            </h1>
            {subtitle && (
              <p className="cj-header__subtitle text-xs">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TenantSwitcher />
            <ThemeToggle />
          </div>

        {showUnidadeSelector && (
          <UnidadeSelector
            selectedUnidadeId={selectedUnidadeId}
            onUnidadeChange={onUnidadeChange}
          />
        )}

        {(isGerenteUnidade || isOperator) && !isAdmin && unidades.length === 1 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="font-medium text-sm">{unidades[0]?.nome}</span>
          </div>
        )}
      </header>
    );
  }

  // Desktop layout
  return (
    <header className="cj-header flex h-16 shrink-0 items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="cj-header__title">{title}</h1>
          {subtitle && <p className="cj-header__subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {showUnidadeSelector && (
          <UnidadeSelector
            selectedUnidadeId={selectedUnidadeId}
            onUnidadeChange={onUnidadeChange}
          />
        )}

        {(isGerenteUnidade || isOperator) && !isAdmin && unidades.length === 1 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="font-medium">{unidades[0]?.nome}</span>
          </div>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
