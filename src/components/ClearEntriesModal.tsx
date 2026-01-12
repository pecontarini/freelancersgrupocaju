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
import { useConfigLojas, ConfigOption } from "@/hooks/useConfigOptions";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function ClearEntriesModal() {
  const [open, setOpen] = useState(false);
  const [selectedLojaId, setSelectedLojaId] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const { options: lojas, isLoading: isLoadingLojas } = useConfigLojas();

  const selectedLoja = lojas.find((l) => l.id === selectedLojaId);
  const isConfirmValid = confirmText.toUpperCase() === "EXCLUIR";
  const canDelete = selectedLojaId && isConfirmValid && !isDeleting;

  const handleClearEntries = async () => {
    if (!selectedLojaId || !selectedLoja) return;

    setIsDeleting(true);

    try {
      // Get current user for audit logging
      const { data: { user } } = await supabase.auth.getUser();

      // Delete all entries for the selected store
      const { error } = await supabase
        .from("freelancer_entries")
        .delete()
        .eq("loja_id", selectedLojaId);

      if (error) {
        throw error;
      }

      // Log the action to console (audit trail)
      console.log(
        `[AUDIT] Admin ${user?.email} cleared all entries for store "${selectedLoja.nome}" (ID: ${selectedLojaId}) at ${new Date().toISOString()}`
      );

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["freelancer-entries"] });

      toast.success(
        `Todos os lançamentos da unidade "${selectedLoja.nome}" foram removidos.`
      );

      // Reset and close modal
      setSelectedLojaId("");
      setConfirmText("");
      setOpen(false);
    } catch (error) {
      console.error("Error clearing entries:", error);
      toast.error("Erro ao excluir lançamentos. Verifique suas permissões.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setSelectedLojaId("");
      setConfirmText("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
          <Trash2 className="mr-2 h-4 w-4" />
          Zerar Lançamentos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Zerar Lançamentos de Unidade
          </DialogTitle>
          <DialogDescription className="text-left">
            <span className="font-semibold text-destructive">Atenção:</span> Esta ação
            excluirá permanentemente TODOS os lançamentos da unidade selecionada.
            Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="loja-select">Selecione a Loja</Label>
            <Select
              value={selectedLojaId}
              onValueChange={setSelectedLojaId}
              disabled={isLoadingLojas}
            >
              <SelectTrigger id="loja-select">
                <SelectValue placeholder="Escolha uma loja..." />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {lojas.map((loja) => (
                  <SelectItem key={loja.id} value={loja.id}>
                    {loja.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLoja && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">
                Você está prestes a excluir <strong>todos os lançamentos</strong> da
                unidade <strong>"{selectedLoja.nome}"</strong>.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-text">
              Digite <span className="font-mono font-bold">EXCLUIR</span> para confirmar
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite EXCLUIR"
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
            onClick={handleClearEntries}
            disabled={!canDelete}
          >
            {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
