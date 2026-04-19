import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useUpdateEmployee } from "@/hooks/useEmployees";
import { useJobTitles, useUpsertJobTitle } from "@/hooks/useJobTitles";
import { toast } from "sonner";

interface EditEmployeeQuickModalProps {
  open: boolean;
  onClose: () => void;
  employee: {
    id: string;
    name: string;
    gender: string;
    phone: string | null;
    job_title: string | null;
    job_title_id: string | null;
    unit_id: string;
  } | null;
}

const OUTRO = "__outro__";

export function EditEmployeeQuickModal({
  open,
  onClose,
  employee,
}: EditEmployeeQuickModalProps) {
  const update = useUpdateEmployee();
  const upsertJob = useUpsertJobTitle();
  const { data: jobTitles = [] } = useJobTitles(employee?.unit_id ?? null);

  const [name, setName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [phone, setPhone] = useState("");
  const [jobTitleId, setJobTitleId] = useState<string>("");
  const [customJobTitle, setCustomJobTitle] = useState("");

  useEffect(() => {
    if (!employee) return;
    setName(employee.name || "");
    setGender((employee.gender as "M" | "F") || "M");
    setPhone(employee.phone || "");
    setJobTitleId(employee.job_title_id || "");
    setCustomJobTitle("");
  }, [employee, open]);

  if (!employee) return null;

  const isSaving = update.isPending || upsertJob.isPending;

  async function handleSave() {
    if (!employee) return;
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      let finalJobTitleId: string | undefined = jobTitleId || undefined;
      let finalJobTitleName: string | undefined;

      if (jobTitleId === OUTRO && customJobTitle.trim()) {
        const created = await upsertJob.mutateAsync({
          name: customJobTitle.trim().toUpperCase(),
          unit_id: employee.unit_id,
        });
        finalJobTitleId = created.id;
        finalJobTitleName = created.name;
      } else if (jobTitleId) {
        finalJobTitleName = jobTitles.find((j) => j.id === jobTitleId)?.name;
      } else {
        finalJobTitleId = undefined;
      }

      await update.mutateAsync({
        id: employee.id,
        name: name.trim().toUpperCase(),
        gender,
        phone: phone.trim() || undefined,
        job_title_id: finalJobTitleId,
        job_title: finalJobTitleName,
      });

      onClose();
    } catch (err) {
      // toasts handled inside hooks
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar funcionário</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              className="uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Select value={jobTitleId || ""} onValueChange={(v) => setJobTitleId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {jobTitles.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={OUTRO}>+ Outro (criar novo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Gênero</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as "M" | "F")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {jobTitleId === OUTRO && (
            <div className="space-y-1.5">
              <Label>Novo cargo</Label>
              <Input
                value={customJobTitle}
                onChange={(e) => setCustomJobTitle(e.target.value)}
                placeholder="Ex: PARRILHEIRO LÍDER"
                className="uppercase"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
