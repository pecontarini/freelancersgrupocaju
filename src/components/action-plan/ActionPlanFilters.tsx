import { Store, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

// Brand detection based on store name prefixes
const BRAND_PREFIXES: Record<string, string> = {
  "MULT": "Caminito",
  "NFE": "Nazo",
  "FB": "Frango Brasil",
  "CAJU": "Caju",
};

function detectBrand(storeName: string): string {
  for (const [prefix, brand] of Object.entries(BRAND_PREFIXES)) {
    if (storeName.toUpperCase().startsWith(prefix)) {
      return brand;
    }
  }
  return "Outras";
}

interface ActionPlanFiltersProps {
  selectedLojaId: string | null;
  onLojaChange: (lojaId: string | null) => void;
  statusFilter: "all" | "pending" | "resolved";
  onStatusChange: (status: "all" | "pending" | "resolved") => void;
  onClearFilters: () => void;
}

export function ActionPlanFilters({
  selectedLojaId,
  onLojaChange,
  statusFilter,
  onStatusChange,
  onClearFilters,
}: ActionPlanFiltersProps) {
  const { options: lojas, isLoading } = useConfigLojas();
  const { isAdmin, unidades, isGerenteUnidade } = useUserProfile();

  // Group stores by brand
  const groupedLojas = useMemo(() => {
    const storeList = isAdmin ? lojas : unidades;
    const groups: Record<string, typeof storeList> = {};

    storeList.forEach((loja) => {
      const brand = detectBrand(loja.nome);
      if (!groups[brand]) {
        groups[brand] = [];
      }
      groups[brand].push(loja);
    });

    // Sort brands alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [lojas, unidades, isAdmin]);

  const hasActiveFilters = selectedLojaId !== null || statusFilter !== "all";

  // Single store manager - show locked badge
  if (isGerenteUnidade && unidades.length === 1) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Unidade:</span>
          <Badge variant="secondary">{unidades[0]?.nome}</Badge>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={onStatusChange as any}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="resolved">Em Correção</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // No stores assigned
  if (isGerenteUnidade && unidades.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
        <Store className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">Nenhuma loja atribuída</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Store selector with brand grouping */}
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-muted-foreground" />
        <Select
          value={selectedLojaId || "all"}
          onValueChange={(value) => onLojaChange(value === "all" ? null : value)}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                {isAdmin ? "Todas as unidades" : "Todas as minhas lojas"}
              </span>
            </SelectItem>
            {groupedLojas.map(([brand, stores]) => (
              <SelectGroup key={brand}>
                <SelectLabel className="text-xs uppercase text-primary font-semibold">
                  {brand}
                </SelectLabel>
                {stores.map((loja) => (
                  <SelectItem key={loja.id} value={loja.id}>
                    {loja.nome}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={onStatusChange as any}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="resolved">Em Correção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear filters button - Admin only */}
      {isAdmin && hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar Filtros
        </Button>
      )}
    </div>
  );
}
