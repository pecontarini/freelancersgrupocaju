import { useState } from "react";
import { Link2, Link2Off, Loader2, Building2, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import {
  useAllUnitPartnerships,
  useUnlinkUnits,
} from "@/hooks/useUnitPartnerships";
import { UnitPartnerLinkModal } from "./UnitPartnerLinkModal";

export function UnitPartnershipsSection() {
  const { options: lojas, isLoading } = useConfigLojas();
  const { data: partnershipsMap, isLoading: loadingPartnerships } =
    useAllUnitPartnerships();

  const [linkModal, setLinkModal] = useState<{ id: string; nome: string } | null>(
    null
  );
  const [unlinkTarget, setUnlinkTarget] = useState<{
    partnershipId: string;
    unitName: string;
    partnerName: string;
    unitId: string;
    partnerUnitId: string;
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [removeSectorLinks, setRemoveSectorLinks] = useState(false);
  const unlinkUnits = useUnlinkUnits();

  const handleUnlink = async () => {
    if (!unlinkTarget) return;
    await unlinkUnits.mutateAsync({
      partnershipId: unlinkTarget.partnershipId,
      removeSectorPartnerships: removeSectorLinks,
      unitId: unlinkTarget.unitId,
      partnerUnitId: unlinkTarget.partnerUnitId,
    });
    setUnlinkTarget(null);
    setConfirmText("");
    setRemoveSectorLinks(false);
  };

  // Build a deduplicated list of pairs (so each partnership appears once)
  const renderedPairIds = new Set<string>();
  const isLoadingAny = isLoading || loadingPartnerships;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          Lojas Casadas
        </CardTitle>
        <CardDescription>
          Vincule duas unidades que operam no mesmo endereço e compartilham equipe em setores
          como Cozinha, Bar e ASG. A matriz POP (efetivo mínimo) dos setores compartilhados é
          espelhada automaticamente entre as duas lojas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingAny ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : lojas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma loja cadastrada.
          </p>
        ) : (
          <div className="space-y-2">
            {lojas.map((loja) => {
              const partnership = partnershipsMap?.get(loja.id);
              const isPartnered = !!partnership;

              // Skip rendering if this pair was already shown (we render the pair once
              // from the side that comes first alphabetically)
              if (isPartnered) {
                const pairKey = [loja.id, partnership!.partnerUnitId].sort().join("|");
                if (renderedPairIds.has(pairKey)) return null;
                renderedPairIds.add(pairKey);
              }

              const partnerLoja = isPartnered
                ? lojas.find((l) => l.id === partnership!.partnerUnitId)
                : null;

              return (
                <div
                  key={loja.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    {isPartnered && partnerLoja ? (
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{loja.nome}</span>
                        <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium truncate">{partnerLoja.nome}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          Casadas
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{loja.nome}</span>
                        <Badge variant="outline" className="text-[10px]">
                          Sem parceira
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    {isPartnered && partnerLoja ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={() =>
                          setUnlinkTarget({
                            partnershipId: partnership!.id,
                            unitName: loja.nome,
                            partnerName: partnerLoja.nome,
                            unitId: loja.id,
                            partnerUnitId: partnerLoja.id,
                          })
                        }
                      >
                        <Link2Off className="h-3.5 w-3.5" /> Desvincular
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setLinkModal({ id: loja.id, nome: loja.nome })}
                      >
                        <Link2 className="h-3.5 w-3.5" /> Vincular parceira
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Link modal */}
      {linkModal && (
        <UnitPartnerLinkModal
          open={!!linkModal}
          onOpenChange={(o) => !o && setLinkModal(null)}
          unitId={linkModal.id}
          unitName={linkModal.nome}
          allUnits={lojas}
        />
      )}

      {/* Unlink confirmation */}
      <Dialog
        open={!!unlinkTarget}
        onOpenChange={(o) => {
          if (!o) {
            setUnlinkTarget(null);
            setConfirmText("");
            setRemoveSectorLinks(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Desvincular lojas
            </DialogTitle>
            <DialogDescription>
              Você está prestes a desvincular{" "}
              <strong>{unlinkTarget?.unitName}</strong> de{" "}
              <strong>{unlinkTarget?.partnerName}</strong>. As escalas e dados existentes
              não serão afetados — apenas o vínculo guarda-chuva entre as lojas será removido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
              <Checkbox
                id="remove-sector-links"
                checked={removeSectorLinks}
                onCheckedChange={(c) => setRemoveSectorLinks(!!c)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="remove-sector-links" className="cursor-pointer text-sm">
                  Também remover vínculos de setor (Cozinha, Bar, ASG)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Se marcado, os setores das duas lojas voltam a operar de forma independente.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Para confirmar, digite{" "}
                <span className="font-mono font-bold">DESVINCULAR</span>
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DESVINCULAR"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlinkTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "DESVINCULAR" || unlinkUnits.isPending}
              onClick={handleUnlink}
            >
              {unlinkUnits.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Desvinculando...
                </>
              ) : (
                <>
                  <Link2Off className="h-4 w-4 mr-2" /> Desvincular
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
