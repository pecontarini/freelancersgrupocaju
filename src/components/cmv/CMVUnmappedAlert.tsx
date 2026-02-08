import { AlertTriangle, Link2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useUnmappedSalesItems } from "@/hooks/useUnmappedSalesItems";
import { useUnidade } from "@/contexts/UnidadeContext";

interface CMVUnmappedAlertProps {
  onNavigateToMapping?: () => void;
}

export function CMVUnmappedAlert({ onNavigateToMapping }: CMVUnmappedAlertProps) {
  const { effectiveUnidadeId } = useUnidade();
  const { data: unmappedItems = [], isLoading } = useUnmappedSalesItems(effectiveUnidadeId || undefined);

  // Count only new items (detected in last 7 days)
  const newItemsCount = unmappedItems.filter(item => item.is_new).length;
  const totalUnmapped = unmappedItems.length;

  if (isLoading || totalUnmapped === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-foreground">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-600 dark:text-amber-400">
        {newItemsCount > 0 
          ? `${newItemsCount} novo(s) prato(s) detectado(s)`
          : `${totalUnmapped} item(ns) sem vínculo`
        }
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm">
          {newItemsCount > 0 
            ? "Vincule agora para calcular o CMV corretamente."
            : "Itens de venda aguardando mapeamento para o estoque."
          }
        </span>
        {onNavigateToMapping && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onNavigateToMapping}
            className="shrink-0 border-amber-500/50 hover:bg-amber-500/10"
          >
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            Vincular
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
