import { useState, useMemo } from "react";
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
import { Link2, Unlink, AlertTriangle, Loader2 } from "lucide-react";
import { useAccessibleStores } from "@/hooks/useAccessibleStores";
import { useSectors } from "@/hooks/useStaffingMatrix";
import {
  useSectorPartner,
  useLinkSectors,
  useUnlinkSectors,
} from "@/hooks/useSectorPartnerships";

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
  const { stores } = useAccessibleStores();
  const { data: existing, isLoading: loadingExisting } = useSectorPartner(sectorId);
  const linkSectors = useLinkSectors();
  const unlinkSectors = useUnlinkSectors();

  const [partnerUnitId, setPartnerUnitId] = useState<string>("");
  const [partnerSectorId, setPartnerSectorId] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");

  const { data: partnerUnitSectors = [] } = useSectors(partnerUnitId || null);

  // Available stores: exclude current unit
  const availableStores = useMemo(
    () => stores.filter((s) => s.id !== currentUnitId),
    [stores, currentUnitId]
  );

  // Look up partner info for display when already linked
  const linkedSectorInfo = useMemo(() => {
    if (!existing) return null;
    return { partnerSectorId: existing.partnerSectorId, partnershipId: existing.id };
  }, [existing]);

  const { data: linkedUnitInfoSectors = [] } = useSectors(
    // We need to figure out the unit_id from the partner sector — we'll fetch all stores' sectors lazily.
    // Simplest: query all sectors when we have a linked partner and look it up.
    null
  );

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
          // Already linked — show partner + unlink option
          <LinkedView
            partnerSectorId={linkedSectorInfo.partnerSectorId}
            confirmText={confirmText}
            setConfirmText={setConfirmText}
            onUnlink={handleUnlink}
            isUnlinking={unlinkSectors.isPending}
          />
        ) : (
          // Not linked — show form to create link
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
              <Select
                value={partnerUnitId}
                onValueChange={(v) => {
                  setPartnerUnitId(v);
                  setPartnerSectorId("");
                }}
              >
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
                disabled={!partnerUnitId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={partnerUnitId ? "Escolha o setor equivalente" : "Selecione a loja primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {partnerUnitSectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {partnerUnitSectors.length === 0 && partnerUnitId && (
                <p className="text-xs text-muted-foreground">
                  Esta loja ainda não tem setores cadastrados.
                </p>
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
  // Lazy fetch partner sector info via inline query
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

/** Inline hook for displaying partner sector + unit name */
function usePartnerSectorDisplay(partnerSectorId: string) {
  const { stores } = useAccessibleStores();
  // Fetch the sector to know its unit_id
  const [partnerSector, setPartnerSector] = useState<string>("");
  const [partnerUnit, setPartnerUnit] = useState<string>("");

  useMemo(() => {
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
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
    return () => { cancelled = true; };
  }, [partnerSectorId, stores]);

  return { partnerSector, partnerUnit };
}
