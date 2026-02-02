import { useState } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle, ClipboardCheck, Lock, Unlock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCMVItems, useCMVInventory } from "@/hooks/useCMV";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { formatCurrency } from "@/lib/formatters";
import { format, startOfMonth, endOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function CMVPeriodOpening() {
  const { effectiveUnidadeId } = useUnidade();
  const { options: lojas } = useConfigLojas();
  const unidadeSelecionada = lojas.find((l) => l.id === effectiveUnidadeId);

  const { items, isLoading: itemsLoading } = useCMVItems();
  const { inventory, isLoading: invLoading, upsertInventory } = useCMVInventory(
    effectiveUnidadeId || undefined
  );

  const [entries, setEntries] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const activeItems = items.filter((i) => i.ativo);
  const isLoading = itemsLoading || invLoading;

  // Calculate period opening status
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const currentMonthName = format(now, "MMMM 'de' yyyy", { locale: ptBR });

  // Check if inventory was done this month
  const inventoryThisMonth = inventory.filter((inv) => {
    if (!inv.ultima_contagem) return false;
    const contagemDate = new Date(inv.ultima_contagem);
    return contagemDate >= currentMonthStart && contagemDate <= currentMonthEnd;
  });

  const itemsWithInventory = inventoryThisMonth.length;
  const totalItems = activeItems.length;
  const completionPercentage = totalItems > 0 ? (itemsWithInventory / totalItems) * 100 : 0;
  const isPeriodOpen = completionPercentage === 100;

  // Calculate total value
  const totalValue = activeItems.reduce((sum, item) => {
    const existingInv = inventory.find((inv) => inv.cmv_item_id === item.id);
    const qty = parseFloat(entries[item.id] || existingInv?.quantidade_atual?.toString() || "0") || 0;
    return sum + qty * item.preco_custo_atual;
  }, 0);

  const handleQuantityChange = (itemId: string, value: string) => {
    setEntries((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const handleOpenPeriod = () => {
    // Check if all items have quantities
    const missingItems = activeItems.filter((item) => {
      const existingInv = inventory.find((inv) => inv.cmv_item_id === item.id);
      const currentValue = entries[item.id];
      const hasValue = currentValue !== undefined && currentValue !== "" && parseFloat(currentValue) >= 0;
      const hasExisting = existingInv && inventoryThisMonth.some((inv) => inv.cmv_item_id === item.id);
      return !hasValue && !hasExisting;
    });

    if (missingItems.length > 0) {
      toast.error(`Preencha a contagem de todos os ${missingItems.length} itens pendentes`);
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmOpenPeriod = async () => {
    if (!effectiveUnidadeId) return;

    setIsSaving(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      for (const item of activeItems) {
        const currentValue = entries[item.id];
        const existingInv = inventory.find((inv) => inv.cmv_item_id === item.id);
        
        // Only update if there's a new value or no inventory this month
        const hasNewValue = currentValue !== undefined && currentValue !== "";
        const needsUpdate = hasNewValue || !inventoryThisMonth.some((inv) => inv.cmv_item_id === item.id);
        
        if (needsUpdate) {
          const qty = parseFloat(currentValue || existingInv?.quantidade_atual?.toString() || "0") || 0;
          await upsertInventory.mutateAsync({
            cmv_item_id: item.id,
            loja_id: effectiveUnidadeId,
            quantidade_atual: qty,
            ultima_contagem: today,
          });
        }
      }

      toast.success("Período aberto com sucesso! Balanço de CMV liberado.");
      setShowConfirmDialog(false);
      setEntries({});
    } catch (error) {
      toast.error("Erro ao abrir período");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!effectiveUnidadeId) {
    return (
      <Card className="rounded-2xl shadow-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          Selecione uma unidade para gerenciar o período de CMV
        </CardContent>
      </Card>
    );
  }

  const unidadeNome = unidadeSelecionada?.nome || "Unidade";

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={isPeriodOpen ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20"}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {isPeriodOpen ? (
                <Unlock className="h-5 w-5 text-green-600" />
              ) : (
                <Lock className="h-5 w-5 text-yellow-600" />
              )}
              Abertura de Período - {currentMonthName}
            </CardTitle>
            <Badge variant={isPeriodOpen ? "default" : "secondary"} className={isPeriodOpen ? "bg-green-600" : "bg-yellow-600"}>
              {isPeriodOpen ? "Período Aberto" : "Pendente"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPeriodOpen ? (
            <Alert className="border-green-500/50 bg-green-100/50 dark:bg-green-950/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-700 dark:text-green-400">Período Aberto</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-300">
                A contagem inicial de {unidadeNome} para {currentMonthName} foi concluída. 
                O balanço de CMV está liberado para análise.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-yellow-500/50 bg-yellow-100/50 dark:bg-yellow-950/30">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-700 dark:text-yellow-400">Contagem Inicial Obrigatória</AlertTitle>
              <AlertDescription className="text-yellow-600 dark:text-yellow-300">
                Antes de acessar o balanço de CMV, é necessário registrar a contagem física atual 
                de todos os itens de estoque. Isso estabelece a posição inicial do período.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso da Contagem</span>
              <span className="font-medium">
                {itemsWithInventory} de {totalItems} itens ({completionPercentage.toFixed(0)}%)
              </span>
            </div>
            <Progress value={completionPercentage} className={isPeriodOpen ? "[&>div]:bg-green-500" : "[&>div]:bg-yellow-500"} />
          </div>
        </CardContent>
      </Card>

      {/* Inventory Form */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold uppercase">
                Contagem de Estoque Inicial
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {unidadeNome} - {currentMonthName}
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
            {!isPeriodOpen && (
              <Button
                onClick={handleOpenPeriod}
                disabled={isSaving || isLoading}
                className="gap-2"
              >
                <CalendarCheck className="h-4 w-4" />
                Abrir Período
              </Button>
            )}
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
              <p className="text-sm">Cadastre itens na aba "Cadastro" primeiro</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preço Unitário</TableHead>
                    <TableHead className="w-32">Quantidade Atual</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeItems.map((item) => {
                    const existingInv = inventory.find((inv) => inv.cmv_item_id === item.id);
                    const wasCountedThisMonth = inventoryThisMonth.some((inv) => inv.cmv_item_id === item.id);
                    const currentValue = entries[item.id] ?? (existingInv?.quantidade_atual?.toString() || "");
                    const qty = parseFloat(currentValue || "0") || 0;
                    const itemTotal = qty * item.preco_custo_atual;

                    return (
                      <TableRow key={item.id} className={wasCountedThisMonth ? "bg-green-50/50 dark:bg-green-950/10" : ""}>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.categoria}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(item.preco_custo_atual)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentValue}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            placeholder="0"
                            className="w-24"
                            disabled={isPeriodOpen}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(itemTotal)}
                        </TableCell>
                        <TableCell>
                          {wasCountedThisMonth ? (
                            <Badge variant="outline" className="text-green-600 border-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Contado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
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

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Confirmar Abertura de Período
            </DialogTitle>
            <DialogDescription>
              Você está prestes a registrar a contagem inicial de estoque para {unidadeNome} em {currentMonthName}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total de Itens</span>
                <span className="font-medium">{activeItems.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Total em Estoque</span>
                <span className="font-bold text-primary">{formatCurrency(totalValue)}</span>
              </div>
            </div>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Após confirmar, o balanço de CMV será liberado para análise. 
                A contagem poderá ser ajustada durante o mês se necessário.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmOpenPeriod} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Confirmar Abertura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
