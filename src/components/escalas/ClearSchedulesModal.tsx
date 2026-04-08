import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Sector {
  id: string;
  name: string;
}

interface ClearSchedulesModalProps {
  unitId: string;
  sectors: Sector[];
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
}

export function ClearSchedulesModal({
  unitId,
  sectors,
  weekStart,
  weekEnd,
  weekLabel,
}: ClearSchedulesModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState<string>("__all__");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const isConfirmValid = confirmText.toUpperCase() === "ZERAR";
  const canDelete = isConfirmValid && !isDeleting;

  const selectedSectorName =
    selectedSectorId === "__all__"
      ? "TODOS os setores"
      : sectors.find((s) => s.id === selectedSectorId)?.name || "";

  const handleClear = async () => {
    setIsDeleting(true);
    try {
      const targetSectorIds =
        selectedSectorId === "__all__"
          ? sectors.map((s) => s.id)
          : [selectedSectorId];

      const { error, count } = await supabase
        .from("schedules")
        .update({ status: "cancelled" })
        .in("sector_id", targetSectorIds)
        .gte("schedule_date", weekStart)
        .lte("schedule_date", weekEnd)
        .neq("status", "cancelled");

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["manual-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules-multi"] });

      toast.success(
        `Escalas zeradas para ${selectedSectorName} na semana ${weekLabel}.`
      );

      setOpen(false);
      setSelectedSectorId("__all__");
      setConfirmText("");
    } catch (error) {
      console.error("Error clearing schedules:", error);
      toast.error("Erro ao zerar escalas. Verifique suas permissões.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSelectedSectorId("__all__");
      setConfirmText("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Zerar Escalas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Zerar Escalas da Semana
          </DialogTitle>
          <DialogDescription className="text-left">
            Remove todas as escalas do período selecionado. Os lançamentos serão
            cancelados (não excluídos permanentemente).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="text-sm font-medium">
              Semana: <span className="text-foreground">{weekLabel}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um setor..." />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="__all__">Todos os setores</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              Você irá cancelar todas as escalas de{" "}
              <strong>{selectedSectorName}</strong> na semana{" "}
              <strong>{weekLabel}</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              Digite <span className="font-mono font-bold">ZERAR</span> para
              confirmar
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite ZERAR"
              className={
                confirmText && !isConfirmValid
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={!canDelete}
          >
            {isDeleting ? "Zerando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
