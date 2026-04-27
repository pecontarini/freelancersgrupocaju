import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Link2, Plus } from "lucide-react";
import { useJobTitles, useUpsertJobTitle, type JobTitle } from "@/hooks/useJobTitles";
import { useAddSectorJobTitle } from "@/hooks/useSectorJobTitles";
import { toast } from "sonner";

interface QuickCreateJobTitleDialogProps {
  open: boolean;
  onClose: () => void;
  unitId: string;
  sectorId: string;
  /** IDs dos cargos já vinculados ao setor (para filtrar do combobox) */
  alreadyLinkedIds: Set<string>;
  /** Callback chamado quando um cargo foi criado/vinculado com sucesso */
  onLinked: (jobTitle: JobTitle) => void;
}

export function QuickCreateJobTitleDialog({
  open,
  onClose,
  unitId,
  sectorId,
  alreadyLinkedIds,
  onLinked,
}: QuickCreateJobTitleDialogProps) {
  const { data: allJobTitles = [] } = useJobTitles(unitId);
  const upsertJobTitle = useUpsertJobTitle();
  const addSectorJobTitle = useAddSectorJobTitle();

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedExistingId, setSelectedExistingId] = useState<string>("");
  const [newName, setNewName] = useState("");

  // Cargos que existem na unidade mas ainda não estão vinculados ao setor
  const linkableExisting = useMemo(
    () => allJobTitles.filter((jt) => !alreadyLinkedIds.has(jt.id)),
    [allJobTitles, alreadyLinkedIds]
  );

  // Default mode: se não existem cargos disponíveis para vincular, já abre em modo "novo"
  const effectiveMode = linkableExisting.length === 0 ? "new" : mode;

  const isSaving = upsertJobTitle.isPending || addSectorJobTitle.isPending;

  function reset() {
    setMode("existing");
    setSelectedExistingId("");
    setNewName("");
  }

  async function handleSubmit() {
    try {
      let jobTitle: JobTitle | undefined;

      if (effectiveMode === "existing") {
        if (!selectedExistingId) {
          toast.error("Selecione um cargo da lista.");
          return;
        }
        jobTitle = allJobTitles.find((jt) => jt.id === selectedExistingId);
        if (!jobTitle) {
          toast.error("Cargo não encontrado.");
          return;
        }
      } else {
        const trimmed = newName.trim();
        if (!trimmed) {
          toast.error("Informe o nome do cargo.");
          return;
        }
        jobTitle = await upsertJobTitle.mutateAsync({ name: trimmed, unit_id: unitId });
      }

      await addSectorJobTitle.mutateAsync({
        sectorId,
        jobTitleId: jobTitle.id,
      });

      toast.success(`Cargo "${jobTitle.name}" vinculado ao setor!`);
      onLinked(jobTitle);
      reset();
      onClose();
    } catch (err: any) {
      // toasts de erro já são exibidos pelas mutations
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Vincular cargo ao setor
          </DialogTitle>
          <DialogDescription>
            Crie ou selecione um cargo para liberar a escala neste setor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle de modo (só aparece se existem cargos disponíveis para vincular) */}
          {linkableExisting.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={effectiveMode === "existing" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("existing")}
              >
                <Link2 className="h-3.5 w-3.5 mr-1" />
                Existente
              </Button>
              <Button
                type="button"
                variant={effectiveMode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("new")}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Novo
              </Button>
            </div>
          )}

          {effectiveMode === "existing" && linkableExisting.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo existente nesta unidade</Label>
              <Select value={selectedExistingId} onValueChange={setSelectedExistingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  {linkableExisting.map((jt) => (
                    <SelectItem key={jt.id} value={jt.id}>
                      {jt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Cargos já cadastrados na unidade que ainda não foram vinculados a este setor.
              </p>
            </div>
          )}

          {effectiveMode === "new" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do novo cargo *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Auxiliar de Bar"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) handleSubmit();
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                O cargo será criado na unidade e vinculado automaticamente a este setor.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Vincular
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
