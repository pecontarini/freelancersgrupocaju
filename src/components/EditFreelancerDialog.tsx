import { useState, useMemo, useEffect } from "react";
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
import { useSectors } from "@/hooks/useStaffingMatrix";
import { useJobTitles } from "@/hooks/useJobTitles";
import { useSectorJobTitles } from "@/hooks/useSectorJobTitles";

interface EditFreelancerDialogProps {
  entry: FreelancerEntry;
  variant?: "icon" | "menu";
}

export function EditFreelancerDialog({ entry, variant = "icon" }: EditFreelancerDialogProps) {
  const [open, setOpen] = useState(false);
  const { updateEntry } = useFreelancerEntries();

  const [valor, setValor] = useState(String(entry.valor));
  const [setor, setSetor] = useState<string>(entry.setor || "");
  const [funcao, setFuncao] = useState<string>(entry.funcao || "");
  const [dataPop, setDataPop] = useState(entry.data_pop);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: sectors = [] } = useSectors(entry.loja_id);
  const { data: jobTitles = [] } = useJobTitles(entry.loja_id);
  const sectorIds = useMemo(() => sectors.map((s) => s.id), [sectors]);
  const { data: sectorJobLinks = [] } = useSectorJobTitles(sectorIds);

  const selectedSector = useMemo(
    () => sectors.find((s) => s.name === setor) || null,
    [sectors, setor],
  );
  const filteredJobTitles = useMemo(() => {
    if (!selectedSector) return [];
    const allowed = new Set(
      sectorJobLinks
        .filter((l) => l.sector_id === selectedSector.id)
        .map((l) => l.job_title_id),
    );
    return jobTitles.filter((j) => allowed.has(j.id));
  }, [selectedSector, sectorJobLinks, jobTitles]);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setValor(String(entry.valor));
      setSetor(entry.setor || "");
      setFuncao(entry.funcao || "");
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
        setor,
        funcao,
        data_pop: dataPop,
      });
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAutomatic = entry.origem === 'escala' || entry.origem === 'checkin';
  if (isAutomatic) {
    return null;
  }

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
            <Label>Setor</Label>
            <Select value={setor || undefined} onValueChange={(v) => { setSetor(v); setFuncao(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
                {setor && !sectors.find((s) => s.name === setor) && (
                  <SelectItem value={setor}>{setor}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Select value={funcao || undefined} onValueChange={setFuncao} disabled={!setor}>
              <SelectTrigger>
                <SelectValue placeholder={!setor ? "Selecione o setor primeiro" : "Selecione o cargo"} />
              </SelectTrigger>
              <SelectContent>
                {filteredJobTitles.map((j) => (
                  <SelectItem key={j.id} value={j.name}>
                    {j.name}
                  </SelectItem>
                ))}
                {funcao && !filteredJobTitles.find((j) => j.name === funcao) && (
                  <SelectItem value={funcao}>{funcao}</SelectItem>
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
