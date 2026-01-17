import { useState, useMemo } from "react";
import { TrendingUp, Wallet, AlertTriangle, Check, X, DollarSign } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { MaintenanceEntry, MaintenanceBudget } from "@/types/maintenance";
import { formatCurrency } from "@/lib/formatters";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";

interface MaintenanceBudgetDashboardProps {
  entries: MaintenanceEntry[];
  budgets: MaintenanceBudget[];
  selectedLojaId: string | null;
  selectedLojaName?: string;
}

export function MaintenanceBudgetDashboard({
  entries,
  budgets,
  selectedLojaId,
  selectedLojaName,
}: MaintenanceBudgetDashboardProps) {
  const { isAdmin } = useUserProfile();
  const { updateBudget } = useMaintenanceEntries();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Calculate current month stats
  const { totalGasto, budgetLiberado, previsaoMes, percentualGasto, diasDecorridos, totalDiasMes } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const diasDecorridos = now.getDate();
    const totalDiasMes = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Filter entries for current month and selected loja
    const monthEntries = entries.filter((entry) => {
      const [year, month] = entry.data_servico.split("-").map(Number);
      const matchesMonth = month - 1 === currentMonth && year === currentYear;
      const matchesLoja = selectedLojaId ? entry.loja_id === selectedLojaId : true;
      return matchesMonth && matchesLoja;
    });

    const totalGasto = monthEntries.reduce((sum, e) => sum + e.valor, 0);

    // Get budget for selected loja
    const budget = budgets.find((b) => b.loja_id === selectedLojaId);
    const budgetLiberado = budget?.budget_mensal || 0;

    // Run rate calculation
    const previsaoMes = diasDecorridos > 0 
      ? (totalGasto / diasDecorridos) * totalDiasMes 
      : 0;

    const percentualGasto = budgetLiberado > 0 
      ? Math.min((totalGasto / budgetLiberado) * 100, 100) 
      : 0;

    return { totalGasto, budgetLiberado, previsaoMes, percentualGasto, diasDecorridos, totalDiasMes };
  }, [entries, budgets, selectedLojaId]);

  const handleOpenDialog = () => {
    setBudgetInput(
      budgetLiberado.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setIsDialogOpen(true);
  };

  const handleSaveBudget = async () => {
    if (!selectedLojaId) return;
    setIsSaving(true);
    try {
      const valor = parseFloat(budgetInput.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
      await updateBudget({ lojaId: selectedLojaId, budget: valor });
      setIsDialogOpen(false);
      setBudgetInput("");
    } finally {
      setIsSaving(false);
    }
  };

  const isOverBudget = totalGasto > budgetLiberado && budgetLiberado > 0;
  const isNearLimit = percentualGasto >= 80 && !isOverBudget;

  return (
    <div className="space-y-4">
      {/* Budget Action Button - Admin Only */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div>
            <h3 className="font-semibold text-primary flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Controle de Budget
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedLojaId 
                ? `Defina o teto mensal para ${selectedLojaName || "a loja selecionada"}`
                : "Selecione uma loja para definir o budget mensal"
              }
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={handleOpenDialog}
                disabled={!selectedLojaId}
                className="gap-2"
              >
                <Wallet className="h-4 w-4" />
                Lançar Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Definir Budget Mensal</DialogTitle>
                <DialogDescription>
                  Informe o valor máximo liberado para manutenção neste mês
                  {selectedLojaName && ` para ${selectedLojaName}`}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="budget-value">Valor do Budget (R$)</Label>
                  <Input
                    id="budget-value"
                    placeholder="0,00"
                    value={budgetInput}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^\d]/g, "");
                      if (value) {
                        const numericValue = parseInt(value, 10) / 100;
                        value = numericValue.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                      }
                      setBudgetInput(value);
                    }}
                    className="text-lg"
                  />
                </div>
                {budgetLiberado > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Budget atual: {formatCurrency(budgetLiberado)}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
                <Button onClick={handleSaveBudget} disabled={isSaving}>
                  <Check className="mr-2 h-4 w-4" />
                  {isSaving ? "Salvando..." : "Salvar Budget"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Budget Card */}
        <Card className={isOverBudget ? "border-destructive" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Budget Liberado</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{formatCurrency(budgetLiberado)}</span>
            {!selectedLojaId && (
              <p className="text-xs text-muted-foreground mt-1">
                Selecione uma loja para ver o budget
              </p>
            )}
          </CardContent>
        </Card>

        {/* Consumption Progress Card */}
        <Card className={isOverBudget ? "border-destructive" : isNearLimit ? "border-yellow-500" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Consumo do Mês</CardTitle>
            {(isOverBudget || isNearLimit) && (
              <AlertTriangle className={`h-4 w-4 ${isOverBudget ? "text-destructive" : "text-yellow-500"}`} />
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(totalGasto)}</span>
              <span className="text-sm text-muted-foreground">
                {percentualGasto.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={percentualGasto} 
              className={isOverBudget ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-yellow-500" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Dia {diasDecorridos} de {totalDiasMes}
            </p>
          </CardContent>
        </Card>

        {/* Run Rate Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Previsão até Fim do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{formatCurrency(previsaoMes)}</span>
            <p className="text-xs text-muted-foreground mt-1">
              Baseado no ritmo atual de gastos
            </p>
            {budgetLiberado > 0 && previsaoMes > budgetLiberado && (
              <p className="text-xs text-destructive mt-1 font-medium">
                ⚠️ Previsão acima do budget em {formatCurrency(previsaoMes - budgetLiberado)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
