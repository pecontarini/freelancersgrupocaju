import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Loader2, Shirt, SprayCanIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOperationalExpenses } from "@/hooks/useOperationalExpenses";
import { useUserProfile } from "@/hooks/useUserProfile";

interface OperationalExpenseFormProps {
  storeId: string | null;
}

const CATEGORIES = [
  { value: "uniformes", label: "Uniformes", icon: Shirt, color: "text-purple-500" },
  { value: "limpeza", label: "Material de Limpeza", icon: SprayCanIcon, color: "text-cyan-500" },
] as const;

export function OperationalExpenseForm({ storeId }: OperationalExpenseFormProps) {
  const { addExpense, isAdding } = useOperationalExpenses();
  const { unidades, isAdmin, isGerenteUnidade } = useUserProfile();
  
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<"uniformes" | "limpeza">("uniformes");
  const [valor, setValor] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [descricao, setDescricao] = useState("");

  // Determine effective store ID
  const effectiveStoreId = storeId || (isGerenteUnidade && !isAdmin && unidades.length > 0 ? unidades[0].id : null);

  const parseAmount = (value: string): number => {
    const amount = parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
    return isNaN(amount) || amount <= 0 ? 0 : amount;
  };

  const handleSubmit = async () => {
    if (!effectiveStoreId) return;
    
    const amount = parseAmount(valor);
    if (amount <= 0) return;

    await addExpense({
      store_id: effectiveStoreId,
      category,
      valor: amount,
      data_despesa: format(date, "yyyy-MM-dd"),
      descricao: descricao.trim() || undefined,
    });

    setIsOpen(false);
    setValor("");
    setDescricao("");
    setDate(new Date());
    setCategory("uniformes");
  };

  if (!effectiveStoreId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Registrar Custo Operacional
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Custo Operacional</DialogTitle>
          <DialogDescription>
            Lançamento rápido de despesas com uniformes ou material de limpeza.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as "uniformes" | "limpeza")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <cat.icon className={cn("h-4 w-4", cat.color)} />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              type="text"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description (optional) */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              placeholder="Detalhes da despesa..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={parseAmount(valor) <= 0 || isAdding}
          >
            {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
