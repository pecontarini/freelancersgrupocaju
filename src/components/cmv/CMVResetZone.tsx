import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const CONFIRM_PHRASE = "ZERAR CMV";

const RESULT_LABELS: Record<string, string> = {
  cmv_contagens_deleted: "Contagens diárias",
  cmv_camara_deleted: "Contagens de câmara",
  cmv_praca_deleted: "Contagens de praça",
  cmv_inventory_deleted: "Saldos de inventário",
  cmv_movements_deleted: "Movimentações legadas",
  cmv_vendas_ajuste_deleted: "Ajustes de vendas",
  cmv_price_history_deleted: "Histórico de preços",
  cmv_pending_sales_items_deleted: "Itens pendentes",
  inventory_transactions_deleted: "Transações de estoque",
  daily_stock_positions_deleted: "Snapshots diários",
  daily_sales_deleted: "Vendas diárias",
};

export function CMVResetZone() {
  const { isAdmin } = useUserProfile();
  const { data: lojas = [] } = useConfigLojas();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [scopeAll, setScopeAll] = useState(true);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);

  if (!isAdmin) return null;

  const canConfirm =
    confirmText.trim().toUpperCase() === CONFIRM_PHRASE &&
    (scopeAll || selectedUnits.length > 0);

  const toggleUnit = (id: string) => {
    setSelectedUnits((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const handleReset = async () => {
    if (!canConfirm) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("reset_cmv_module", {
        p_unit_ids: scopeAll ? null : selectedUnits,
      });
      if (error) throw error;

      setResult(data as Record<string, any>);
      toast({
        title: "Histórico CMV zerado",
        description: "O módulo está pronto para um novo ciclo.",
      });

      // Invalidar caches relacionados
      [
        "cmv-items",
        "cmv-contagens",
        "cmv-analytics",
        "cmv-kardex",
        "cmv-closing",
        "cmv-vendas-desvio",
        "cmv-pending",
        "cmv-ai-context",
        "daily-sales",
        "realtime-stock",
        "inventory-transactions",
      ].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

      setConfirmText("");
    } catch (err: any) {
      toast({
        title: "Falha ao zerar histórico",
        description: err.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base">Zona de Risco — Reset do CMV</CardTitle>
          </div>
          <CardDescription>
            Apaga todo o histórico operacional (contagens, movimentações, vendas e snapshots),
            mantendo intactos os itens cadastrados, preços e mapeamentos. Use ao iniciar um
            novo ciclo de operação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive" className="bg-background/60">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Ação irreversível</AlertTitle>
            <AlertDescription>
              Os dados removidos não poderão ser recuperados. Recomendado fazer backup antes.
            </AlertDescription>
          </Alert>

          <Button
            variant="destructive"
            onClick={() => {
              setResult(null);
              setOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Zerar Histórico do CMV
          </Button>

          {result && (
            <div className="rounded-md border bg-background/80 p-4 space-y-2">
              <p className="text-sm font-medium">Relatório do reset</p>
              <ul className="text-sm space-y-1">
                {Object.entries(RESULT_LABELS).map(([key, label]) => (
                  <li key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono">{Number(result[key] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar reset do CMV
            </DialogTitle>
            <DialogDescription>
              Esta ação apaga todo o histórico operacional do módulo CMV. Itens, preços e
              mapeamentos permanecem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Escopo</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="scope-all"
                  checked={scopeAll}
                  onCheckedChange={(c) => setScopeAll(Boolean(c))}
                />
                <label htmlFor="scope-all" className="text-sm cursor-pointer">
                  Todas as unidades
                </label>
              </div>

              {!scopeAll && (
                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                  {lojas.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma unidade encontrada.</p>
                  )}
                  {lojas.map((loja) => (
                    <div key={loja.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`u-${loja.id}`}
                        checked={selectedUnits.includes(loja.id)}
                        onCheckedChange={() => toggleUnit(loja.id)}
                      />
                      <label htmlFor={`u-${loja.id}`} className="text-sm cursor-pointer">
                        {loja.nome}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">
                Digite <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> para confirmar
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!canConfirm || loading}
              onClick={handleReset}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Zerar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
