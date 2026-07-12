import { Check, ChevronDown, Building2 } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Seletor de tenant.
 *
 * Aparece automaticamente apenas quando o usuário tem vínculo com mais de
 * um tenant (super_admin, ou qualquer outro cenário multi-empresa).
 * A troca é visual + reconciliação de branding; a RLS continua governada
 * pelo `user_tenants` do usuário.
 */
export function TenantSwitcher() {
  const { tenant, availableTenants, setTenantSlug } = useTenant();

  if (availableTenants.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="h-4 w-4" />
          <span className="hidden sm:inline max-w-[160px] truncate">
            {tenant.copy.appName}
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Empresa ativa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableTenants.map((t) => (
          <DropdownMenuItem
            key={t.slug}
            onClick={() => setTenantSlug(t.slug)}
            className="cursor-pointer"
          >
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">{t.copy.appName}</span>
              {t.copy.tagline && (
                <span className="text-xs text-muted-foreground">
                  {t.copy.tagline}
                </span>
              )}
            </div>
            {t.slug === tenant.slug && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
