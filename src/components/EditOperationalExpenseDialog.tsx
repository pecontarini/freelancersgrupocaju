import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OperationalExpense, useOperationalExpenses } from "@/hooks/useOperationalExpenses";

interface EditOperationalExpenseDialogProps {
  expense: OperationalExpense;
}

const CATEGORY_LABELS: Record<string, string> = {
  uniformes: "Uniformes",
  limpeza: "Limpeza",
  utensilios: "Utensílios",
  apoio: "Apoio/Outros",
};

export function EditOperationalExpenseDialog({ expense }: EditOperationalExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const { updateExpense } = useOperationalExpenses();

  const [valor, setValor] = useState(String(expense.valor));
  const [dataDespesa, setDataDespesa] = useState(expense.data_despesa);
  const [descricao, setDescricao] = useState(expense.descricao || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setValor(String(expense.valor));
      setDataDespesa(expense.data_despesa);
      setDescricao(expense.descricao || "");
    }
    setOpen(isOpen);
  };

  const handleSave = async () => {
    const amount = parseFloat(valor.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      await updateExpense({
        id: expense.id,
        valor: amount,
        data_despesa: dataDespesa,
        descricao: descricao.trim() || null,
      });
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Despesa</DialogTitle>
          <DialogDescription>
            {CATEGORY_LABELS[expense.category] || expense.category}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
