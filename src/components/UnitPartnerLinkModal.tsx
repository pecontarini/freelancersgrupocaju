import { useState, useMemo } from "react";
import { Link2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  useAllUnitPartnerships,
  useLinkUnits,
} from "@/hooks/useUnitPartnerships";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  unitName: string;
  allUnits: { id: string; nome: string }[];
}

export function UnitPartnerLinkModal({
  open,
  onOpenChange,
  unitId,
  unitName,
  allUnits,
}: Props) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [autoLinkSectors, setAutoLinkSectors] = useState(true);

  const { data: partnershipsMap } = useAllUnitPartnerships();
  const linkUnits = useLinkUnits();

  const availableUnits = useMemo(() => {
    return allUnits.filter((u) => {
      if (u.id === unitId) return false;
      // Hide units that already have a partnership
      return !partnershipsMap?.has(u.id);
    });
  }, [allUnits, unitId, partnershipsMap]);

  const handleSubmit = async () => {
    if (!selectedPartnerId) return;
    await linkUnits.mutateAsync({
      unitId,
      partnerUnitId: selectedPartnerId,
      autoLinkSharedSectors: autoLinkSectors,
    });
    setSelectedPartnerId("");
    setAutoLinkSectors(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vincular loja parceira
          </DialogTitle>
          <DialogDescription>
            Selecione a loja que opera no mesmo prédio que <strong>{unitName}</strong>. Isso
            permitirá tratar setores compartilhados (Cozinha, Bar, ASG) como uma única equipe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Loja parceira</Label>
            <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma loja..." />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.length === 0 && (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    Nenhuma loja disponível para vínculo.
                  </div>
                )}
                {availableUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Lojas que já possuem parceira não aparecem aqui.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id="auto-link-sectors"
              checked={autoLinkSectors}
              onCheckedChange={(c) => setAutoLinkSectors(!!c)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="auto-link-sectors" className="cursor-pointer text-sm">
                Vincular automaticamente os setores compartilhados
              </Label>
              <p className="text-xs text-muted-foreground">
                Cria os vínculos de setor entre <strong>Cozinha</strong>,{" "}
                <strong>Bar</strong> e <strong>ASG / Serviços Gerais</strong> das duas lojas.
                Setores que já possuem vínculo são ignorados.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedPartnerId || linkUnits.isPending}
          >
            {linkUnits.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Vinculando...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" /> Vincular lojas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
