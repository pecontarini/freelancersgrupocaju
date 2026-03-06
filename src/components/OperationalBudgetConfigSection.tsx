import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Calendar, Loader2, Store, Plus, Trash2, Users, Wrench, Shirt, SprayCanIcon, Pencil, ShoppingBag } from "lucide-react";
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
import { useUserProfile } from "@/hooks/useUserProfile";

export function BudgetConfigSection() {
  const { budgets, isLoading, upsertBudget, deleteBudget, isUpdating, isDeleting, getCurrentMonthYear } = useStoreBudgets();
  const { options: lojas, isLoading: isLoadingLojas } = useConfigLojas();
  const { isAdmin, isOperator, unidades } = useUserProfile();
  
  // Operators only see their assigned stores
  const availableLojas = isAdmin ? lojas : unidades;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(getCurrentMonthYear());
  const [freelancerBudget, setFreelancerBudget] = useState<string>("");
  const [maintenanceBudget, setMaintenanceBudget] = useState<string>("");
  const [uniformsBudget, setUniformsBudget] = useState<string>("");
  const [cleaningBudget, setCleaningBudget] = useState<string>("");
  const [utensilsBudget, setUtensilsBudget] = useState<string>("");
  const [apoioVendaBudget, setApoioVendaBudget] = useState<string>("");

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

  const parseAmount = (value: string): number => {
    const amount = parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
    return isNaN(amount) || amount < 0 ? 0 : amount;
  };

  const calculateTotal = () => {
    return parseAmount(freelancerBudget) + parseAmount(maintenanceBudget) + parseAmount(uniformsBudget) + parseAmount(cleaningBudget) + parseAmount(utensilsBudget) + parseAmount(apoioVendaBudget);
  };

  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const handleEditBudget = (budget: typeof budgets[0]) => {
    setEditingBudgetId(budget.id);
    setSelectedStoreId(budget.store_id);
    setSelectedMonthYear(budget.month_year);
    setFreelancerBudget(budget.freelancer_budget > 0 ? String(budget.freelancer_budget) : "");
    setMaintenanceBudget(budget.maintenance_budget > 0 ? String(budget.maintenance_budget) : "");
    setUniformsBudget(budget.uniforms_budget > 0 ? String(budget.uniforms_budget) : "");
    setCleaningBudget(budget.cleaning_budget > 0 ? String(budget.cleaning_budget) : "");
    setUtensilsBudget(budget.utensils_budget > 0 ? String(budget.utensils_budget) : "");
    setApoioVendaBudget(budget.apoio_venda_budget > 0 ? String(budget.apoio_venda_budget) : "");
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedStoreId || !selectedMonthYear) return;

    const freelancerAmount = parseAmount(freelancerBudget);
    const maintenanceAmount = parseAmount(maintenanceBudget);
    const uniformsAmount = parseAmount(uniformsBudget);
    const cleaningAmount = parseAmount(cleaningBudget);
    const utensilsAmount = parseAmount(utensilsBudget);
    const apoioVendaAmount = parseAmount(apoioVendaBudget);

    if (freelancerAmount === 0 && maintenanceAmount === 0 && uniformsAmount === 0 && cleaningAmount === 0 && utensilsAmount === 0 && apoioVendaAmount === 0) return;

    try {
      await upsertBudget({
        store_id: selectedStoreId,
        month_year: selectedMonthYear,
        freelancer_budget: freelancerAmount,
        maintenance_budget: maintenanceAmount,
        uniforms_budget: uniformsAmount,
        cleaning_budget: cleaningAmount,
        utensils_budget: utensilsAmount,
        apoio_venda_budget: apoioVendaAmount,
      });
      setIsDialogOpen(false);
      setEditingBudgetId(null);
      resetForm();
    } catch (err) {
      console.error("Erro ao salvar budget:", err);
    }
  };

  const resetForm = () => {
    setSelectedStoreId("");
    setFreelancerBudget("");
    setMaintenanceBudget("");
    setUniformsBudget("");
    setCleaningBudget("");
    setUtensilsBudget("");
    setApoioVendaBudget("");
    setEditingBudgetId(null);
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
  // Filter budgets: operators only see their stores
  const storeIds = new Set(availableLojas.map(l => l.id));
  const visibleBudgets = isAdmin ? budgets : budgets.filter(b => storeIds.has(b.store_id));
  const activeBudgets = visibleBudgets.filter((b) => b.month_year >= currentMonthYear);

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
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Definir Orçamento Mensal</DialogTitle>
                <DialogDescription>
                  Configure os limites de gastos para cada categoria operacional.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="store">Loja/Unidade</Label>
                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                      <SelectTrigger id="store">
                        <SelectValue placeholder="Selecione a loja" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLojas.map((loja) => (
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="freelancer-amount" className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-blue-500" />
                      Freelancers
                    </Label>
                    <Input
                      id="freelancer-amount"
                      type="text"
                      placeholder="R$ 0,00"
                      value={freelancerBudget}
                      onChange={(e) => setFreelancerBudget(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maintenance-amount" className="flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-amber-500" />
                      Manutenção
                    </Label>
                    <Input
                      id="maintenance-amount"
                      type="text"
                      placeholder="R$ 0,00"
                      value={maintenanceBudget}
                      onChange={(e) => setMaintenanceBudget(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="uniforms-amount" className="flex items-center gap-1.5">
                      <Shirt className="h-3.5 w-3.5 text-purple-500" />
                      Uniformes
                    </Label>
                    <Input
                      id="uniforms-amount"
                      type="text"
                      placeholder="R$ 0,00"
                      value={uniformsBudget}
                      onChange={(e) => setUniformsBudget(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cleaning-amount" className="flex items-center gap-1.5">
                      <SprayCanIcon className="h-3.5 w-3.5 text-cyan-500" />
                      Limpeza
                    </Label>
                    <Input
                      id="cleaning-amount"
                      type="text"
                      placeholder="R$ 0,00"
                      value={cleaningBudget}
                      onChange={(e) => setCleaningBudget(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="utensils-amount" className="flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-rose-500" />
                      Utensílios
                    </Label>
                    <Input
                      id="utensils-amount"
                      type="text"
                      placeholder="R$ 0,00"
                      value={utensilsBudget}
                      onChange={(e) => setUtensilsBudget(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Budget Total</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(calculateTotal())}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedStoreId || !selectedMonthYear || calculateTotal() === 0 || isUpdating}
                >
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
        Defina orçamentos para Freelancers, Manutenção, Uniformes, Limpeza e Utensílios.
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
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Users className="h-3.5 w-3.5 text-blue-500" />
                      Free.
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Wrench className="h-3.5 w-3.5 text-amber-500" />
                      Manut.
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Shirt className="h-3.5 w-3.5 text-purple-500" />
                      Unif.
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <SprayCanIcon className="h-3.5 w-3.5 text-cyan-500" />
                      Limp.
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Wrench className="h-3.5 w-3.5 text-rose-500" />
                      Utens.
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Total</TableHead>
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
                    <TableCell className="text-right text-blue-600">
                      {formatCurrency(budget.freelancer_budget)}
                    </TableCell>
                    <TableCell className="text-right text-amber-600">
                      {formatCurrency(budget.maintenance_budget)}
                    </TableCell>
                    <TableCell className="text-right text-purple-600">
                      {formatCurrency(budget.uniforms_budget)}
                    </TableCell>
                    <TableCell className="text-right text-cyan-600">
                      {formatCurrency(budget.cleaning_budget)}
                    </TableCell>
                    <TableCell className="text-right text-rose-600">
                      {formatCurrency(budget.utensils_budget)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatCurrency(budget.total_budget)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => handleEditBudget(budget)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(budget.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
