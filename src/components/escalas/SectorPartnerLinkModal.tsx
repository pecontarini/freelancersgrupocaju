import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2, Unlink, AlertTriangle, Loader2, Plus } from "lucide-react";
import { useAccessibleStores } from "@/hooks/useAccessibleStores";
import { useSectors, useAddSector } from "@/hooks/useStaffingMatrix";
import {
  useSectorPartner,
  useLinkSectors,
  useUnlinkSectors,
} from "@/hooks/useSectorPartnerships";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onClose: () => void;
  sectorId: string;
  sectorName: string;
  currentUnitId: string;
  currentUnitName: string;
}

export function SectorPartnerLinkModal({
  open,
  onClose,
  sectorId,
  sectorName,
  currentUnitId,
  currentUnitName,
}: Props) {
  const qc = useQueryClient();
  const { stores } = useAccessibleStores();
  const { data: existing, isLoading: loadingExisting } = useSectorPartner(sectorId);
  const linkSectors = useLinkSectors();
  const unlinkSectors = useUnlinkSectors();
  const addSector = useAddSector();

  const [partnerUnitId, setPartnerUnitId] = useState<string>("");
  const [partnerSectorId, setPartnerSectorId] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: partnerUnitSectors = [], isLoading: loadingPartnerSectors } =
    useSectors(partnerUnitId || null);

  // Available stores: exclude current unit
  const availableStores = useMemo(
    () => stores.filter((s) => s.id !== currentUnitId),
    [stores, currentUnitId]
  );

  // Reset partner sector selection when partner unit changes
  useEffect(() => {
    setPartnerSectorId("");
  }, [partnerUnitId]);

  const linkedSectorInfo = useMemo(() => {
    if (!existing) return null;
    return { partnerSectorId: existing.partnerSectorId, partnershipId: existing.id };
  }, [existing]);

  // Suggest a matching sector by name when partner unit is selected
  useEffect(() => {
    if (!partnerUnitId || partnerUnitSectors.length === 0) return;
    const norm = (s: string) => s.trim().toLowerCase();
    const match = partnerUnitSectors.find((s) => norm(s.name) === norm(sectorName));
    if (match && !partnerSectorId) setPartnerSectorId(match.id);
  }, [partnerUnitId, partnerUnitSectors, sectorName, partnerSectorId]);

  async function handleCreatePartnerSector() {
    if (!partnerUnitId) return;
    setIsCreating(true);
    try {
      // Create sector in partner unit using same name
      const { data, error } = await supabase
        .from("sectors")
        .insert({ unit_id: partnerUnitId, name: sectorName })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(`Setor "${sectorName}" criado na loja parceira.`);
      qc.invalidateQueries({ queryKey: ["sectors"] });
      setPartnerSectorId(data.id);
    } catch (err: any) {
      toast.error("Erro ao criar setor: " + err.message);
    } finally {
      setIsCreating(false);
    }
  }

  function handleLink() {
    if (!partnerSectorId) return;
    linkSectors.mutate(
      { sectorId, partnerSectorId },
      {
        onSuccess: () => {
          setPartnerUnitId("");
          setPartnerSectorId("");
          setConfirmText("");
          onClose();
        },
      }
    );
  }

  function handleUnlink() {
    if (!linkedSectorInfo) return;
    if (confirmText !== "DESVINCULAR") return;
    unlinkSectors.mutate(linkedSectorInfo.partnershipId, {
      onSuccess: () => {
        setConfirmText("");
        onClose();
      },
    });
  }

  const partnerUnitName = stores.find((s) => s.id === partnerUnitId)?.nome || "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Setor Compartilhado
          </DialogTitle>
          <DialogDescription>
            <strong className="text-foreground uppercase">{sectorName}</strong> em{" "}
            <strong className="text-foreground">{currentUnitName}</strong>
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : linkedSectorInfo ? (
          <LinkedView
            partnerSectorId={linkedSectorInfo.partnerSectorId}
            confirmText={confirmText}
            setConfirmText={setConfirmText}
            onUnlink={handleUnlink}
            isUnlinking={unlinkSectors.isPending}
          />
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Esta ação fará a escala deste setor aparecer também na loja parceira.
                Funcionários CLT das duas lojas passarão a aparecer juntos no editor.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-xs">Loja parceira</Label>
              <Select value={partnerUnitId} onValueChange={setPartnerUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a loja casada" />
                </SelectTrigger>
                <SelectContent>
                  {availableStores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Setor parceiro</Label>
              <Select
                value={partnerSectorId}
                onValueChange={setPartnerSectorId}
                disabled={!partnerUnitId || partnerUnitSectors.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !partnerUnitId
                        ? "Selecione a loja primeiro"
                        : partnerUnitSectors.length === 0
                        ? "Loja sem setores cadastrados"
                        : "Escolha o setor equivalente"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {partnerUnitSectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* No sectors in partner unit → offer to auto-create */}
              {partnerUnitId && !loadingPartnerSectors && partnerUnitSectors.length === 0 && (
                <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    A loja <strong className="text-foreground">{partnerUnitName}</strong> ainda não
                    tem setores cadastrados. Posso criar agora um setor chamado{" "}
                    <strong className="text-foreground uppercase">"{sectorName}"</strong> nela e já
                    deixar pronto para vincular.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={handleCreatePartnerSector}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Criar setor "{sectorName}" em {partnerUnitName}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Has sectors but none matches the current sector name → also offer create */}
              {partnerUnitId &&
                !loadingPartnerSectors &&
                partnerUnitSectors.length > 0 &&
                !partnerUnitSectors.some(
                  (s) => s.name.trim().toLowerCase() === sectorName.trim().toLowerCase()
                ) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs h-7"
                    onClick={handleCreatePartnerSector}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-1" />
                        Não vejo "{sectorName}" — criar nesta loja
                      </>
                    )}
                  </Button>
                )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {!linkedSectorInfo && (
            <Button
              onClick={handleLink}
              disabled={!partnerSectorId || linkSectors.isPending}
            >
              {linkSectors.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Vincular setores
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkedView({
  partnerSectorId,
  confirmText,
  setConfirmText,
  onUnlink,
  isUnlinking,
}: {
  partnerSectorId: string;
  confirmText: string;
  setConfirmText: (v: string) => void;
  onUnlink: () => void;
  isUnlinking: boolean;
}) {
  const { partnerSector, partnerUnit } = usePartnerSectorDisplay(partnerSectorId);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Vinculado a:</span>
        </div>
        <div className="pl-6">
          <p className="text-sm font-medium uppercase">
            {partnerUnit || "..."} / {partnerSector || "..."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Funcionários e escalas das duas lojas aparecem unificadas.
          </p>
        </div>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Para desvincular, digite <Badge variant="outline" className="mx-1">DESVINCULAR</Badge> abaixo.
          As escalas já gravadas <strong>permanecem</strong> — apenas a visão volta a ficar separada.
        </AlertDescription>
      </Alert>

      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
        placeholder="Digite DESVINCULAR"
        className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background"
      />

      <Button
        variant="destructive"
        className="w-full"
        disabled={confirmText !== "DESVINCULAR" || isUnlinking}
        onClick={onUnlink}
      >
        {isUnlinking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Unlink className="h-4 w-4 mr-1.5" />
            Desvincular setores
          </>
        )}
      </Button>
    </div>
  );
}

function usePartnerSectorDisplay(partnerSectorId: string) {
  const { stores } = useAccessibleStores();
  const [partnerSector, setPartnerSector] = useState<string>("");
  const [partnerUnit, setPartnerUnit] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("sectors")
        .select("name, unit_id")
        .eq("id", partnerSectorId)
        .maybeSingle();
      if (!cancelled && data) {
        setPartnerSector(data.name);
        const unit = stores.find((s) => s.id === data.unit_id);
        setPartnerUnit(unit?.nome || "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerSectorId, stores]);

  return { partnerSector, partnerUnit };
}
