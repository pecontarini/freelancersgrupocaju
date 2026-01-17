import { useState, useMemo } from "react";
import { TrendingUp, Wallet, AlertTriangle, Edit2, Check } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { MaintenanceEntry, MaintenanceBudget } from "@/types/maintenance";
import { formatCurrency } from "@/lib/formatters";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";

interface MaintenanceBudgetDashboardProps {
  entries: MaintenanceEntry[];
  budgets: MaintenanceBudget[];
  selectedLojaId: string | null;
}

export function MaintenanceBudgetDashboard({
  entries,
  budgets,
  selectedLojaId,
}: MaintenanceBudgetDashboardProps) {
  const { isAdmin } = useUserProfile();
  const { updateBudget } = useMaintenanceEntries();
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

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

  const handleSaveBudget = async () => {
    if (!selectedLojaId) return;
    const valor = parseFloat(budgetInput.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    await updateBudget({ lojaId: selectedLojaId, budget: valor });
    setIsEditingBudget(false);
    setBudgetInput("");
  };

  const isOverBudget = totalGasto > budgetLiberado && budgetLiberado > 0;
  const isNearLimit = percentualGasto >= 80 && !isOverBudget;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Budget Card */}
      <Card className={isOverBudget ? "border-destructive" : ""}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Budget Liberado</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isEditingBudget && isAdmin && selectedLojaId ? (
            <div className="flex items-center gap-2">
              <Input
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
                className="h-8"
              />
              <Button size="icon" variant="ghost" onClick={handleSaveBudget}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(budgetLiberado)}</span>
              {isAdmin && selectedLojaId && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setIsEditingBudget(true);
                    setBudgetInput(
                      budgetLiberado.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    );
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          {!selectedLojaId && (
            <p className="text-xs text-muted-foreground mt-1">
              Selecione uma loja para definir o budget
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
  );
}
