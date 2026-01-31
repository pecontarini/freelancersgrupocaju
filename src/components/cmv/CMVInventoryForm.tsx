import { useState, useEffect } from "react";
import { ClipboardCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCMVItems, useCMVInventory } from "@/hooks/useCMV";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CMVInventoryForm() {
  const { effectiveUnidadeId } = useUnidade();
  const { options: lojas } = useConfigLojas();
  const unidadeSelecionada = lojas.find(l => l.id === effectiveUnidadeId);
  
  const { items, isLoading: itemsLoading } = useCMVItems();
  const { inventory, isLoading: invLoading, upsertInventory } = useCMVInventory(
    effectiveUnidadeId || undefined
  );

  const [entries, setEntries] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize entries from existing inventory
  useEffect(() => {
    if (inventory.length > 0) {
      const initial: Record<string, string> = {};
      inventory.forEach((inv) => {
        initial[inv.cmv_item_id] = inv.quantidade_atual.toString();
      });
      setEntries(initial);
    }
  }, [inventory]);

  const handleQuantityChange = (itemId: string, value: string) => {
    setEntries((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const handleSaveAll = async () => {
    if (!effectiveUnidadeId) return;
    
    setIsSaving(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      for (const [itemId, qty] of Object.entries(entries)) {
        if (qty && parseFloat(qty) >= 0) {
          await upsertInventory.mutateAsync({
            cmv_item_id: itemId,
            loja_id: effectiveUnidadeId,
            quantidade_atual: parseFloat(qty),
            ultima_contagem: today,
          });
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const activeItems = items.filter((i) => i.ativo);
  const isLoading = itemsLoading || invLoading;

  // Calculate total value
  const totalValue = activeItems.reduce((sum, item) => {
    const qty = parseFloat(entries[item.id] || "0") || 0;
    return sum + qty * item.preco_custo_atual;
  }, 0);

  if (!effectiveUnidadeId) {
    return (
      <Card className="rounded-2xl shadow-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          Selecione uma unidade para gerenciar o inventário
        </CardContent>
      </Card>
    );
  }

  const unidadeNome = unidadeSelecionada?.nome || "Unidade";

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
            <ClipboardCheck className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold uppercase">
              Inventário Inicial
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {unidadeNome} - Contagem de Estoque
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase">
              Valor Total em Estoque
            </p>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(totalValue)}
            </p>
          </div>
          <Button
            onClick={handleSaveAll}
            disabled={isSaving || isLoading}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Salvando..." : "Salvar Contagem"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : activeItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum item cadastrado para inventariar</p>
            <p className="text-sm">Cadastre itens na seção acima primeiro</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Preço Unitário</TableHead>
                  <TableHead className="w-32">Quantidade Atual</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Última Contagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeItems.map((item) => {
                  const existingInv = inventory.find(
                    (inv) => inv.cmv_item_id === item.id
                  );
                  const qty = parseFloat(entries[item.id] || "0") || 0;
                  const itemTotal = qty * item.preco_custo_atual;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.categoria}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.unidade}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.preco_custo_atual)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entries[item.id] || ""}
                          onChange={(e) =>
                            handleQuantityChange(item.id, e.target.value)
                          }
                          placeholder="0"
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(itemTotal)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {existingInv?.ultima_contagem
                          ? format(
                              new Date(existingInv.ultima_contagem),
                              "dd/MM/yyyy",
                              { locale: ptBR }
                            )
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
