import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FreelancerEntry } from "@/types/freelancer";
import { useFreelancerEntries } from "@/hooks/useFreelancerEntries";
import { useConfigFuncoes, useConfigGerencias } from "@/hooks/useConfigOptions";

interface EditFreelancerDialogProps {
  entry: FreelancerEntry;
  variant?: "icon" | "menu";
}

export function EditFreelancerDialog({ entry, variant = "icon" }: EditFreelancerDialogProps) {
  const [open, setOpen] = useState(false);
  const { updateEntry } = useFreelancerEntries();
  const { options: funcoes } = useConfigFuncoes();
  const { options: gerencias } = useConfigGerencias();

  const [valor, setValor] = useState(String(entry.valor));
  const [funcao, setFuncao] = useState(entry.funcao);
  const [gerencia, setGerencia] = useState(entry.gerencia);
  const [dataPop, setDataPop] = useState(entry.data_pop);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setValor(String(entry.valor));
      setFuncao(entry.funcao);
      setGerencia(entry.gerencia);
      setDataPop(entry.data_pop);
    }
    setOpen(isOpen);
  };

  const handleSave = async () => {
    const amount = parseFloat(valor.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        valor: amount,
        funcao,
        gerencia,
        data_pop: dataPop,
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
          <DialogTitle>Editar Lançamento</DialogTitle>
          <DialogDescription>
            {entry.nome_completo} — {entry.loja}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <Select value={funcao} onValueChange={setFuncao}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {funcoes.map((f) => (
                  <SelectItem key={f.id} value={f.nome}>
                    {f.nome}
                  </SelectItem>
                ))}
                {!funcoes.find((f) => f.nome === funcao) && (
                  <SelectItem value={funcao}>{funcao}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gerência</Label>
            <Select value={gerencia} onValueChange={setGerencia}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gerencias.map((g) => (
                  <SelectItem key={g.id} value={g.nome}>
                    {g.nome}
                  </SelectItem>
                ))}
                {!gerencias.find((g) => g.nome === gerencia) && (
                  <SelectItem value={gerencia}>{gerencia}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data</Label>
            <Input
              type="date"
              value={dataPop}
              onChange={(e) => setDataPop(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
