import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Beef, Snowflake, ChefHat, Plus, Lock, Calendar } from "lucide-react";
import { useSemanasCMV, useCamaraData, usePracaData, DIAS } from "@/hooks/useCMVSemanas";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CMVCamaraGrid } from "./CMVCamaraGrid";
import { CMVPracaGrid } from "./CMVPracaGrid";
import { CMVTurnoEntryModal } from "./CMVTurnoEntryModal";
import { CMVDesvioResumo } from "./CMVDesvioResumo";
import { toast } from "sonner";

type CMVItem = { id: string; nome: string; unidade: string };

export function CMVContagemCarnes() {
  const { effectiveUnidadeId } = useUnidade();
  const { isAdmin } = useUserProfile();
  const [quadro, setQuadro] = useState<"camara" | "praca">("camara");
  const [newSemanaOpen, setNewSemanaOpen] = useState(false);
  const [responsavel, setResponsavel] = useState("");

  const { semanas, createSemana, encerrarSemana } = useSemanasCMV();
  const semanaAberta = useMemo(() => semanas.find((s) => s.status === "aberta"), [semanas]);
  const semanaAtual = semanaAberta || semanas[0];

  const { entries: camaraEntries, upsert: camaraUpsert } = useCamaraData(semanaAtual?.id);
  const { entries: pracaEntries, upsert: pracaUpsert } = usePracaData(semanaAtual?.id);

  // Fetch CMV items
  const { data: cmvItems = [] } = useQuery<CMVItem[]>({
    queryKey: ["cmv_items_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_items")
        .select("id, nome, unidade")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  if (!effectiveUnidadeId) return null;

  const isReadOnly = semanaAtual?.status === "encerrada";

  const handleCreateSemana = () => {
    const hoje = new Date();
    const inicio = startOfWeek(hoje, { weekStartsOn: 1 });
    const fim = endOfWeek(hoje, { weekStartsOn: 1 });
    createSemana.mutate({
      data_inicio: format(inicio, "yyyy-MM-dd"),
      data_fim: format(fim, "yyyy-MM-dd"),
      responsavel: responsavel || undefined,
    });
    setNewSemanaOpen(false);
    setResponsavel("");
  };

  const handleEncerrar = () => {
    if (!semanaAtual) return;
    // Build final saldo from câmara
    const saldoFinal: Record<string, number> = {};
    cmvItems.forEach((item) => {
      const saldoAnterior = (semanaAtual.saldo_anterior_json as Record<string, number>)?.[item.id] ?? 0;
      let running = saldoAnterior;
      DIAS.forEach((dia) => {
        const entry = camaraEntries.find((e) => e.cmv_item_id === item.id && e.dia === dia);
        running += (entry?.entrada ?? 0) - (entry?.saida ?? 0);
      });
      saldoFinal[item.id] = running;
    });

    // Warn about empty fields
    const totalExpected = cmvItems.length * 7;
    const filledCamara = camaraEntries.length;
    if (filledCamara < totalExpected) {
      toast.warning(`Atenção: ${totalExpected - filledCamara} campos da câmara sem preenchimento.`);
    }

    encerrarSemana.mutate({ semanaId: semanaAtual.id, saldoFinalJson: saldoFinal });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Beef className="h-5 w-5 text-primary" />
          Contagem de Carnes — Controle Semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Week context bar */}
        {semanaAtual ? (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {format(new Date(semanaAtual.data_inicio + "T00:00:00"), "dd/MM", { locale: ptBR })} →{" "}
              {format(new Date(semanaAtual.data_fim + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
            </span>
            {semanaAtual.responsavel && (
              <span className="text-sm text-muted-foreground">
                Resp: {semanaAtual.responsavel}
              </span>
            )}
            <Badge variant={isReadOnly ? "secondary" : "default"}>
              {isReadOnly ? (
                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Encerrada</span>
              ) : (
                "🟢 Aberta"
              )}
            </Badge>

            {!isReadOnly && isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto">
                    <Lock className="h-3 w-3 mr-1" /> Encerrar Semana
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Encerrar semana?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Os dados ficarão em modo leitura e o saldo final da câmara será transportado
                      para a próxima semana.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEncerrar}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-3">Nenhuma semana de controle aberta.</p>
            <Dialog open={newSemanaOpen} onOpenChange={setNewSemanaOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Nova Semana
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Semana de Controle</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-3">
                  <p className="text-sm text-muted-foreground">
                    Será criada a semana atual (segunda a domingo).
                  </p>
                  <Input
                    placeholder="Responsável (opcional)"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button onClick={handleCreateSemana} disabled={createSemana.isPending}>
                    Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {semanaAtual && (
          <>
            {/* Toggle + Quick Entry */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ToggleGroup type="single" value={quadro} onValueChange={(v) => v && setQuadro(v as any)}>
                <ToggleGroupItem value="camara" className="gap-1.5">
                  <Snowflake className="h-4 w-4" /> Câmara Congelada
                </ToggleGroupItem>
                <ToggleGroupItem value="praca" className="gap-1.5">
                  <ChefHat className="h-4 w-4" /> Praça / Operação
                </ToggleGroupItem>
              </ToggleGroup>

              {quadro === "praca" && !isReadOnly && (
                <CMVTurnoEntryModal
                  semanaId={semanaAtual.id}
                  items={cmvItems}
                  entries={pracaEntries}
                  onUpsert={(p) => pracaUpsert.mutate(p)}
                  dataInicio={semanaAtual.data_inicio}
                />
              )}
            </div>

            {/* Grid */}
            {quadro === "camara" ? (
              <CMVCamaraGrid
                semana={semanaAtual}
                items={cmvItems}
                entries={camaraEntries}
                onUpsert={(p) => camaraUpsert.mutate(p)}
                readOnly={isReadOnly}
              />
            ) : (
              <CMVPracaGrid
                semanaId={semanaAtual.id}
                items={cmvItems}
                entries={pracaEntries}
                onUpsert={(p) => pracaUpsert.mutate(p)}
                readOnly={isReadOnly}
              />
            )}

            {/* Deviation Summary */}
            <CMVDesvioResumo
              semana={semanaAtual}
              items={cmvItems}
              camaraEntries={camaraEntries}
              pracaEntries={pracaEntries}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
