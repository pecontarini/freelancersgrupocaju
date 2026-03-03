import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDaysInMonth, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, parseDateString } from "@/lib/formatters";
import { FreelancerEntry } from "@/types/freelancer";
import { MaintenanceEntry } from "@/types/maintenance";
import { OperationalExpense } from "@/hooks/useOperationalExpenses";
import { cn } from "@/lib/utils";
import { EditOperationalExpenseDialog } from "@/components/EditOperationalExpenseDialog";
import { EditFreelancerDialog } from "@/components/EditFreelancerDialog";
import { EditMaintenanceDialog } from "@/components/EditMaintenanceDialog";
import {
  Users,
  Wrench,
  Shirt,
  SprayCanIcon,
  UtensilsCrossed,
  Calendar,
} from "lucide-react";

export type BudgetCategory = "freelancer" | "maintenance" | "uniforms" | "cleaning" | "utensils";

interface BudgetDrillDownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: BudgetCategory;
  freelancerEntries: FreelancerEntry[];
  maintenanceEntries: MaintenanceEntry[];
  operationalExpenses: OperationalExpense[];
  storeId: string | null;
  budgetAmount: number;
  monthYear?: string; // "YYYY-MM" format, defaults to current month
}

const CATEGORY_CONFIG: Record<
  BudgetCategory,
  { label: string; icon: React.ElementType; color: string; barColor: string }
> = {
  freelancer: { label: "Freelancers", icon: Users, color: "text-blue-500", barColor: "hsl(215, 72%, 52%)" },
  maintenance: { label: "Manutenção", icon: Wrench, color: "text-amber-500", barColor: "hsl(43, 96%, 56%)" },
  uniforms: { label: "Uniformes", icon: Shirt, color: "text-purple-500", barColor: "hsl(271, 76%, 53%)" },
  cleaning: { label: "Limpeza", icon: SprayCanIcon, color: "text-cyan-500", barColor: "hsl(197, 71%, 52%)" },
  utensils: { label: "Utensílios", icon: UtensilsCrossed, color: "text-rose-500", barColor: "hsl(350, 65%, 52%)" },
};

interface DailyPoint {
  day: string;
  dayNum: string;
  value: number;
  cumulative: number;
}

interface ExpenseItem {
  id: string;
  date: string;
  description: string;
  value: number;
  originalFreelancer?: FreelancerEntry;
  originalMaintenance?: MaintenanceEntry;
  originalExpense?: OperationalExpense;
}

export function BudgetDrillDownDialog({
  open,
  onOpenChange,
  category,
  freelancerEntries,
  maintenanceEntries,
  operationalExpenses,
  storeId,
  budgetAmount,
  monthYear,
}: BudgetDrillDownDialogProps) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  // Parse month from prop or use current
  const targetDate = monthYear 
    ? parse(monthYear, "yyyy-MM", new Date()) 
    : new Date();
  const mStart = startOfMonth(targetDate);
  const mEnd = endOfMonth(targetDate);
  const daysInMonth = getDaysInMonth(targetDate);
  const dailyBudget = budgetAmount > 0 ? budgetAmount / daysInMonth : 0;

  // Get filtered expenses for category
  const { expenses, dailyData, totalSpent } = useMemo(() => {
    const items: ExpenseItem[] = [];

    if (category === "freelancer") {
      freelancerEntries.forEach((e) => {
        const d = parseDateString(e.data_pop);
        if (d >= mStart && d <= mEnd && (!storeId || e.loja_id === storeId)) {
          items.push({ id: e.id, date: e.data_pop, description: `${e.nome_completo} — ${e.funcao}`, value: e.valor, originalFreelancer: e });
        }
      });
    } else if (category === "maintenance") {
      maintenanceEntries.forEach((e) => {
        const d = parseDateString(e.data_servico);
        if (d >= mStart && d <= mEnd && (!storeId || e.loja_id === storeId)) {
          items.push({ id: e.id, date: e.data_servico, description: `${e.fornecedor} (NF ${e.numero_nf})`, value: e.valor, originalMaintenance: e });
        }
      });
    } else {
      const opCat = category === "uniforms" ? "uniformes" : category === "cleaning" ? "limpeza" : "utensilios";
      operationalExpenses.forEach((e) => {
        const d = parseDateString(e.data_despesa);
        if (e.category === opCat && d >= mStart && d <= mEnd && (!storeId || e.store_id === storeId)) {
          items.push({ id: e.id, date: e.data_despesa, description: e.descricao || opCat, value: e.valor, originalExpense: e });
        }
      });
    }

    items.sort((a, b) => a.date.localeCompare(b.date));

    // Build daily chart data
    const allDays = eachDayOfInterval({ start: mStart, end: mEnd });
    let cumulative = 0;
    const daily: DailyPoint[] = allDays.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayTotal = items.filter((i) => i.date === dayStr).reduce((s, i) => s + i.value, 0);
      cumulative += dayTotal;
      return {
        day: dayStr,
        dayNum: format(day, "dd"),
        value: dayTotal,
        cumulative,
      };
    });

    return {
      expenses: items,
      dailyData: daily,
      totalSpent: items.reduce((s, i) => s + i.value, 0),
    };
  }, [category, freelancerEntries, maintenanceEntries, operationalExpenses, storeId, mStart, mEnd]);

  const pct = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

  const ChartTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const p = payload[0].payload as DailyPoint;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg text-sm">
          <p className="font-medium mb-1">Dia {p.dayNum}</p>
          <p>Gasto do dia: <strong>{formatCurrency(p.value)}</strong></p>
          <p className="text-muted-foreground">Acumulado: {formatCurrency(p.cumulative)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", config.color)} />
            Consumo — {config.label}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {format(targetDate, "MMMM yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Consumido</p>
            <p className="text-lg font-bold">{formatCurrency(totalSpent)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Budget</p>
            <p className="text-lg font-bold">{budgetAmount > 0 ? formatCurrency(budgetAmount) : "N/A"}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">% Usado</p>
            <p className={cn(
              "text-lg font-bold",
              pct > 90 ? "text-destructive" : pct > 70 ? "text-amber-500" : "text-green-500"
            )}>
              {budgetAmount > 0 ? `${pct.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>

        {/* Daily bar chart */}
        <div className="h-[200px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dayNum" fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                fontSize={10}
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <Tooltip content={<ChartTooltip />} />
              {dailyBudget > 0 && (
                <ReferenceLine
                  y={dailyBudget}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: "Meta diária", position: "right", fill: "hsl(var(--destructive))", fontSize: 9 }}
                />
              )}
              <Bar dataKey="value" fill={config.barColor} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense list */}
        <div className="flex-1 min-h-0">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
            Lançamentos ({expenses.length})
          </p>
          <ScrollArea className="h-[200px]">
            {expenses.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum lançamento neste mês.</p>
            ) : (
              <div className="space-y-2 pr-3">
                {expenses.map((item) => {
                  const [y, m, d] = item.date.split("-");
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">{`${d}/${m}/${y}`}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        {item.originalFreelancer && <EditFreelancerDialog entry={item.originalFreelancer} />}
                        {item.originalMaintenance && <EditMaintenanceDialog entry={item.originalMaintenance} />}
                        {item.originalExpense && <EditOperationalExpenseDialog expense={item.originalExpense} />}
                        <Badge variant="secondary">
                          {formatCurrency(item.value)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
