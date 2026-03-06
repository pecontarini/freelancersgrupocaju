import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Settings, Loader2, Calendar, Store, Users, Wrench, Shirt, SprayCanIcon, Trash2, Lock, Pencil, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreBudgets, StoreBudget } from "@/hooks/useStoreBudgets";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

interface InlineBudgetEditorProps {
  preselectedStoreId?: string | null;
}

export function InlineBudgetEditor({ preselectedStoreId }: InlineBudgetEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isOperator, unidades } = useUserProfile();
  const { options: lojas } = useConfigLojas();
  const { budgets, upsertBudget, deleteBudget, isUpdating, isDeleting, getCurrentMonthYear } = useStoreBudgets();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"password" | "editor">("password");
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Budget form state
  const availableLojas = isAdmin ? lojas : unidades;
  const [selectedStoreId, setSelectedStoreId] = useState<string>(preselectedStoreId || "");
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(getCurrentMonthYear());
  const [freelancerBudget, setFreelancerBudget] = useState("");
  const [maintenanceBudget, setMaintenanceBudget] = useState("");
  const [uniformsBudget, setUniformsBudget] = useState("");
  const [cleaningBudget, setCleaningBudget] = useState("");
  const [utensilsBudget, setUtensilsBudget] = useState("");
  const [apoioVendaBudget, setApoioVendaBudget] = useState("");
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  // Only admin and operator can access
  if (!isOperator && !isAdmin) return null;

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 6; i >= 1; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push({ value: format(date, "yyyy-MM"), label: format(date, "MMMM yyyy", { locale: ptBR }) });
    }
    for (let i = 0; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({ value: format(date, "yyyy-MM"), label: format(date, "MMMM yyyy", { locale: ptBR }) });
    }
    return options;
  };

  const parseAmount = (value: string): number => {
    const amount = parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
    return isNaN(amount) || amount < 0 ? 0 : amount;
  };

  const calculateTotal = () =>
    parseAmount(freelancerBudget) + parseAmount(maintenanceBudget) + parseAmount(uniformsBudget) + parseAmount(cleaningBudget) + parseAmount(utensilsBudget) + parseAmount(apoioVendaBudget);

  const handleOpen = () => {
    setIsOpen(true);
    setStep("password");
    setPassword("");
    setPasswordError("");
    setEditingBudgetId(null);
    setSelectedStoreId(preselectedStoreId || (availableLojas.length === 1 ? availableLojas[0].id : ""));
    setSelectedMonthYear(getCurrentMonthYear());
    resetBudgetFields();
  };

  const resetBudgetFields = () => {
    setFreelancerBudget("");
    setMaintenanceBudget("");
    setUniformsBudget("");
    setCleaningBudget("");
    setUtensilsBudget("");
    setApoioVendaBudget("");
  };

  const handleEditBudget = (budget: StoreBudget) => {
    setEditingBudgetId(budget.id);
    setSelectedStoreId(budget.store_id);
    setSelectedMonthYear(budget.month_year);
    setFreelancerBudget(budget.freelancer_budget > 0 ? String(budget.freelancer_budget) : "");
    setMaintenanceBudget(budget.maintenance_budget > 0 ? String(budget.maintenance_budget) : "");
    setUniformsBudget(budget.uniforms_budget > 0 ? String(budget.uniforms_budget) : "");
    setCleaningBudget(budget.cleaning_budget > 0 ? String(budget.cleaning_budget) : "");
    setUtensilsBudget(budget.utensils_budget > 0 ? String(budget.utensils_budget) : "");
    setApoioVendaBudget(budget.apoio_venda_budget > 0 ? String(budget.apoio_venda_budget) : "");
  };

  const handlePasswordConfirm = async () => {
    if (!user?.email || !password) return;
    setIsVerifying(true);
    setPasswordError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (error) {
        setPasswordError("Senha incorreta. Tente novamente.");
      } else {
        // Re-validate cached data after re-auth (token may have refreshed)
        const { queryClient } = await import("@tanstack/react-query");
        setStep("editor");
        setPassword("");
      }
    } catch {
      setPasswordError("Erro ao verificar senha.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStoreId || !selectedMonthYear) return;
    const total = calculateTotal();
    if (total === 0) return;

    try {
      await upsertBudget({
        store_id: selectedStoreId,
        month_year: selectedMonthYear,
        freelancer_budget: parseAmount(freelancerBudget),
        maintenance_budget: parseAmount(maintenanceBudget),
        uniforms_budget: parseAmount(uniformsBudget),
        cleaning_budget: parseAmount(cleaningBudget),
        utensils_budget: parseAmount(utensilsBudget),
        apoio_venda_budget: parseAmount(apoioVendaBudget),
      });
      setEditingBudgetId(null);
      resetBudgetFields();
      setIsOpen(false);
    } catch (err) {
      console.error("Erro ao salvar budget:", err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o orçamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (budgetId: string) => {
    if (confirm("Tem certeza que deseja remover este orçamento?")) {
      try {
        await deleteBudget(budgetId);
      } catch (err) {
        console.error("Erro ao remover budget:", err);
      }
    }
  };

  const getStoreName = (storeId: string) =>
    lojas.find((l) => l.id === storeId)?.nome || "Loja não encontrada";

  const formatMonthYear = (monthYear: string) => {
    const [year, month] = monthYear.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, "MMMM yyyy", { locale: ptBR });
  };

  const storeIds = new Set(availableLojas.map((l) => l.id));
  const visibleBudgets = isAdmin ? budgets : budgets.filter((b) => storeIds.has(b.store_id));
  const currentMonthYear = getCurrentMonthYear();
  const activeBudgets = visibleBudgets
    .filter((b) => b.month_year >= currentMonthYear)
    .filter((b) => !selectedStoreId || b.store_id === selectedStoreId);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleOpen}>
        <Settings className="h-3.5 w-3.5" />
        Editar Budgets
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          {step === "password" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Confirme sua senha
                </DialogTitle>
                <DialogDescription>
                  Para editar os budgets, confirme sua senha de acesso.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordConfirm()}
                  />
                  {passwordError && (
                    <p className="text-sm text-destructive">{passwordError}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button onClick={handlePasswordConfirm} disabled={!password || isVerifying}>
                  {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{editingBudgetId ? "Editar Budget" : "Novo Budget"}</DialogTitle>
                <DialogDescription>Configure os limites de gastos para cada categoria operacional.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Loja/Unidade</Label>
                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId} disabled={!!editingBudgetId}>
                      <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                      <SelectContent>
                        {availableLojas.map((loja) => (
                          <SelectItem key={loja.id} value={loja.id}>
                            <div className="flex items-center gap-2"><Store className="h-4 w-4" />{loja.nome}</div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mês de Referência</Label>
                    <Select value={selectedMonthYear} onValueChange={setSelectedMonthYear} disabled={!!editingBudgetId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {getMonthOptions().map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span className="capitalize">{option.label}</span></div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-blue-500" />Freelancers</Label>
                    <Input type="text" placeholder="R$ 0,00" value={freelancerBudget} onChange={(e) => setFreelancerBudget(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-amber-500" />Manutenção</Label>
                    <Input type="text" placeholder="R$ 0,00" value={maintenanceBudget} onChange={(e) => setMaintenanceBudget(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Shirt className="h-3.5 w-3.5 text-purple-500" />Uniformes</Label>
                    <Input type="text" placeholder="R$ 0,00" value={uniformsBudget} onChange={(e) => setUniformsBudget(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><SprayCanIcon className="h-3.5 w-3.5 text-cyan-500" />Limpeza</Label>
                    <Input type="text" placeholder="R$ 0,00" value={cleaningBudget} onChange={(e) => setCleaningBudget(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-rose-500" />Utensílios</Label>
                    <Input type="text" placeholder="R$ 0,00" value={utensilsBudget} onChange={(e) => setUtensilsBudget(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5 text-green-500" />Apoio à Venda</Label>
                    <Input type="text" placeholder="R$ 0,00" value={apoioVendaBudget} onChange={(e) => setApoioVendaBudget(e.target.value)} />
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Budget Total</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(calculateTotal())}</p>
                </div>

                {activeBudgets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Budgets ativos</p>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Loja</TableHead>
                            <TableHead>Mês</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeBudgets.map((b) => (
                            <TableRow key={b.id} className={editingBudgetId === b.id ? "bg-primary/5" : ""}>
                              <TableCell className="text-sm">{getStoreName(b.store_id)}</TableCell>
                              <TableCell className="text-sm capitalize">{formatMonthYear(b.month_year)}</TableCell>
                              <TableCell className="text-right text-sm font-semibold text-primary">{formatCurrency(b.total_budget)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleEditBudget(b)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(b.id)} disabled={isDeleting}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={!selectedStoreId || !selectedMonthYear || calculateTotal() === 0 || isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
