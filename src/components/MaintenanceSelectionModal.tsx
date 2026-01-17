import { useState, useMemo } from "react";
import { FileText, Loader2, Check, CheckSquare, Square } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MaintenanceEntry } from "@/types/maintenance";
import { formatCurrency } from "@/lib/formatters";

interface MaintenanceSelectionModalProps {
  entries: MaintenanceEntry[];
  lojaNome?: string;
  onGenerate: (selectedEntries: MaintenanceEntry[]) => void;
  isGenerating: boolean;
}

export function MaintenanceSelectionModal({
  entries,
  lojaNome,
  onGenerate,
  isGenerating,
}: MaintenanceSelectionModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  // Reset selection when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Select all by default
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
    setOpen(newOpen);
  };

  const toggleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(entries.map((e) => e.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectedEntries = useMemo(() => {
    return entries.filter((e) => selectedIds.has(e.id));
  }, [entries, selectedIds]);

  const selectedTotal = useMemo(() => {
    return selectedEntries.reduce((sum, e) => sum + e.valor, 0);
  }, [selectedEntries]);

  const handleGenerate = () => {
    if (selectedEntries.length > 0) {
      onGenerate(selectedEntries);
      setOpen(false);
    }
  };

  const allSelected = selectedIds.size === entries.length;
  const noneSelected = selectedIds.size === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={entries.length === 0} className="gap-2">
          <FileText className="h-4 w-4" />
          Gerar OP de Manutenção
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Manutenções</DialogTitle>
          <DialogDescription>
            Escolha quais registros deseja incluir na Ordem de Pagamento
            {lojaNome && ` para ${lojaNome}`}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={allSelected}
              className="gap-1"
            >
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Selecionar Todos</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={noneSelected}
              className="gap-1"
            >
              <Square className="h-4 w-4" />
              <span className="hidden sm:inline">Limpar</span>
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedIds.size} de {entries.length} selecionado(s)
          </div>
        </div>

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {entries.map((entry) => {
              const isSelected = selectedIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => toggleEntry(entry.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleEntry(entry.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {entry.fornecedor}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        NF: {entry.numero_nf}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatDate(entry.data_servico)}</span>
                      {entry.loja && (
                        <>
                          <span>•</span>
                          <span className="truncate">{entry.loja}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="font-semibold text-primary whitespace-nowrap">
                    {formatCurrency(entry.valor)}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="text-sm text-muted-foreground">Total selecionado:</p>
            <p className="text-lg font-bold text-primary">
              {formatCurrency(selectedTotal)}
            </p>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={noneSelected || isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Gerar PDF ({selectedIds.size})
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
