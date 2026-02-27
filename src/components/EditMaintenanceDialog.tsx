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
import { MaintenanceEntry } from "@/types/maintenance";
import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";

interface EditMaintenanceDialogProps {
  entry: MaintenanceEntry;
}

export function EditMaintenanceDialog({ entry }: EditMaintenanceDialogProps) {
  const [open, setOpen] = useState(false);
  const { updateEntry } = useMaintenanceEntries();

  const [fornecedor, setFornecedor] = useState(entry.fornecedor);
  const [numeroNf, setNumeroNf] = useState(entry.numero_nf);
  const [valor, setValor] = useState(String(entry.valor));
  const [dataServico, setDataServico] = useState(entry.data_servico);
  const [descricao, setDescricao] = useState(entry.descricao || "");
  const [cpfCnpj, setCpfCnpj] = useState(entry.cpf_cnpj || "");
  const [chavePix, setChavePix] = useState(entry.chave_pix || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setFornecedor(entry.fornecedor);
      setNumeroNf(entry.numero_nf);
      setValor(String(entry.valor));
      setDataServico(entry.data_servico);
      setDescricao(entry.descricao || "");
      setCpfCnpj(entry.cpf_cnpj || "");
      setChavePix(entry.chave_pix || "");
    }
    setOpen(isOpen);
  };

  const handleSave = async () => {
    const amount = parseFloat(valor.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;
    if (!fornecedor.trim() || !numeroNf.trim()) return;

    setIsSubmitting(true);
    try {
      await updateEntry({
        id: entry.id,
        fornecedor: fornecedor.trim(),
        numero_nf: numeroNf.trim(),
        valor: amount,
        data_servico: dataServico,
        descricao: descricao.trim() || null,
        cpf_cnpj: cpfCnpj.trim() || null,
        chave_pix: chavePix.trim() || null,
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Manutenção</DialogTitle>
          <DialogDescription>
            {entry.loja} — NF {entry.numero_nf}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Número NF *</Label>
            <Input value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-2">
            <Label>Data do Serviço</Label>
            <Input type="date" value={dataServico} onChange={(e) => setDataServico(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ</Label>
            <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Chave PIX</Label>
            <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} />
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
