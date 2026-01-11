import { useState } from "react";
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
  const { isAdmin, unidade, isGerenteUnidade } = useUserProfile();

  // Only show for admin
  if (!isAdmin) {
    if (isGerenteUnidade && unidade) {
      return (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Unidade:</span>
          <Badge variant="secondary">{unidade.nome}</Badge>
        </div>
      );
    }
    return null;
  }

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
