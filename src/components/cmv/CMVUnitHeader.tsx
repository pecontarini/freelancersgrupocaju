import { Store, Package, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useCMVInventory, useCMVItems } from "@/hooks/useCMV";
import { formatCurrency } from "@/lib/formatters";
import { startOfMonth, endOfMonth } from "date-fns";

export function CMVUnitHeader() {
  const { options: lojas, isLoading } = useConfigLojas();
  const { isAdmin, unidades, isGerenteUnidade } = useUserProfile();
  const { selectedUnidadeId, setSelectedUnidadeId, effectiveUnidadeId } = useUnidade();
  const { items } = useCMVItems();
  const { inventory } = useCMVInventory(effectiveUnidadeId || undefined);

  const selectedLoja = lojas.find((l) => l.id === effectiveUnidadeId);

  // Calculate period status
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const activeItems = items.filter((i) => i.ativo);
  
  const inventoryThisMonth = inventory.filter((inv) => {
    if (!inv.ultima_contagem) return false;
    const contagemDate = new Date(inv.ultima_contagem);
    return contagemDate >= currentMonthStart && contagemDate <= currentMonthEnd;
  });
  
  const isPeriodOpen = activeItems.length > 0 && inventoryThisMonth.length === activeItems.length;

  // Calculate total stock value
  const totalValue = inventory.reduce((sum, inv) => {
    const item = items.find((i) => i.id === inv.cmv_item_id);
    return sum + (inv.quantidade_atual * (item?.preco_custo_atual || 0));
  }, 0);

  const handleUnidadeChange = (value: string) => {
    setSelectedUnidadeId(value === "all" ? null : value);
  };

  const renderSelector = () => {
    if (isAdmin) {
      return (
        <Select
          value={selectedUnidadeId || "all"}
          onValueChange={handleUnidadeChange}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" disabled>
              <span className="flex items-center gap-2 text-muted-foreground">
                <Store className="h-4 w-4" />
                Selecione uma unidade
              </span>
            </SelectItem>
            {lojas.map((loja) => (
              <SelectItem key={loja.id} value={loja.id}>
                {loja.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (isGerenteUnidade && unidades.length > 1) {
      return (
        <Select
          value={selectedUnidadeId || "all"}
          onValueChange={handleUnidadeChange}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" disabled>
              <span className="flex items-center gap-2 text-muted-foreground">
                <Store className="h-4 w-4" />
                Selecione uma unidade
              </span>
            </SelectItem>
            {unidades.map((loja) => (
              <SelectItem key={loja.id} value={loja.id}>
                {loja.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (isGerenteUnidade && unidades.length === 1) {
      return (
        <Badge variant="secondary" className="text-base px-4 py-2">
          <Store className="h-4 w-4 mr-2" />
          {unidades[0].nome}
        </Badge>
      );
    }

    return null;
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Unit Selection */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">
                  Unidade CMV
                </p>
                {renderSelector()}
              </div>
            </div>

            {effectiveUnidadeId && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l">
                {isPeriodOpen ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Período Aberto
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950/30 dark:text-yellow-400">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Contagem Pendente
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Stock Value */}
          {effectiveUnidadeId && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase">
                  Valor Total em Estoque
                </p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(totalValue)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
            </div>
          )}
        </div>

        {!effectiveUnidadeId && (
          <div className="mt-3 flex items-center gap-2 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">
              Selecione uma unidade acima para gerenciar o controle de CMV (estoque, entradas e saídas)
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
