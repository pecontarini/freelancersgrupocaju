import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Calendar, Loader2, Store, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { formatCurrency } from "@/lib/formatters";

export function BudgetConfigSection() {
  const { budgets, isLoading, upsertBudget, deleteBudget, isUpdating, isDeleting, getCurrentMonthYear } = useStoreBudgets();
  const { options: lojas, isLoading: isLoadingLojas } = useConfigLojas();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(getCurrentMonthYear());
  const [budgetAmount, setBudgetAmount] = useState<string>("");

  // Generate month options for the last 12 months and next 6 months
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    // 6 months ahead
    for (let i = 6; i >= 1; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: ptBR }),
      });
    }
    
    // Current month and 12 months back
    for (let i = 0; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: ptBR }),
      });
    }
    
    return options;
  };

  const handleSubmit = async () => {
    if (!selectedStoreId || !selectedMonthYear || !budgetAmount) return;

    const amount = parseFloat(budgetAmount.replace(/[^\d,.-]/g, "").replace(",", "."));
    if (isNaN(amount) || amount < 0) return;

    await upsertBudget({
      store_id: selectedStoreId,
      month_year: selectedMonthYear,
      budget_amount: amount,
    });

    setIsDialogOpen(false);
    setSelectedStoreId("");
    setBudgetAmount("");
  };

  const handleDelete = async (budgetId: string) => {
    if (confirm("Tem certeza que deseja remover este orçamento?")) {
      await deleteBudget(budgetId);
    }
  };

  const getStoreName = (storeId: string) => {
    return lojas.find((l) => l.id === storeId)?.nome || "Loja não encontrada";
  };

  const formatMonthYear = (monthYear: string) => {
    const [year, month] = monthYear.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, "MMMM yyyy", { locale: ptBR });
  };

  // Filter to show only current and future budgets by default
  const currentMonthYear = getCurrentMonthYear();
  const activeBudgets = budgets.filter((b) => b.month_year >= currentMonthYear);

  if (isLoading || isLoadingLojas) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Orçamento Mensal por Loja</CardTitle>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Definir Budget</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Definir Orçamento Mensal</DialogTitle>
                <DialogDescription>
                  Configure o limite de gastos para uma loja em um mês específico.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="store">Loja/Unidade</Label>
                  <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                    <SelectTrigger id="store">
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {lojas.map((loja) => (
                        <SelectItem key={loja.id} value={loja.id}>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4" />
                            {loja.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="month">Mês de Referência</Label>
                  <Select value={selectedMonthYear} onValueChange={setSelectedMonthYear}>
                    <SelectTrigger id="month">
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {getMonthOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="capitalize">{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Valor do Budget (R$)</Label>
                  <Input
                    id="amount"
                    type="text"
                    placeholder="Ex: 50000"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedStoreId || !selectedMonthYear || !budgetAmount || isUpdating}
                >
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Defina o orçamento mensal para cada loja. Os valores serão usados para controle de gastos com freelancers e manutenção.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {activeBudgets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum orçamento configurado.</p>
            <p className="text-sm mt-1">Clique em "Definir Budget" para começar.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Orçamento</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeBudgets.map((budget) => (
                  <TableRow key={budget.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        {getStoreName(budget.store_id)}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {formatMonthYear(budget.month_year)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatCurrency(budget.budget_amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(budget.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
