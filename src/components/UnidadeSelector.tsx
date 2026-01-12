import { Store, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Badge } from "@/components/ui/badge";

interface UnidadeSelectorProps {
  selectedUnidadeId: string | null;
  onUnidadeChange: (unidadeId: string | null) => void;
}

export function UnidadeSelector({ selectedUnidadeId, onUnidadeChange }: UnidadeSelectorProps) {
  const { options: lojas, isLoading } = useConfigLojas();
  const { isAdmin, unidades, isGerenteUnidade } = useUserProfile();

  // Admin - show all stores selector
  if (isAdmin) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Visualizar:</span>
        </div>
        <Select
          value={selectedUnidadeId || "all"}
          onValueChange={(value) => onUnidadeChange(value === "all" ? null : value)}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas as unidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Todas as unidades
              </span>
            </SelectItem>
            {lojas.map((loja) => (
              <SelectItem key={loja.id} value={loja.id}>
                {loja.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Gerente with multiple stores - show multi-store selector
  if (isGerenteUnidade && unidades.length > 1) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Visualizar:</span>
        </div>
        <Select
          value={selectedUnidadeId || "all"}
          onValueChange={(value) => onUnidadeChange(value === "all" ? null : value)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todas as minhas lojas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Todas as minhas lojas
              </span>
            </SelectItem>
            {unidades.map((loja) => (
              <SelectItem key={loja.id} value={loja.id}>
                {loja.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Gerente with single store - show badge
  if (isGerenteUnidade && unidades.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Unidade:</span>
        <Badge variant="secondary">{unidades[0].nome}</Badge>
      </div>
    );
  }

  // Gerente with no stores assigned
  if (isGerenteUnidade && unidades.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
        <Store className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">Nenhuma loja atribuída</span>
      </div>
    );
  }

  return null;
}
