import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, AlertTriangle, Copy, Sparkles, MapPin } from "lucide-react";
import { useAccessibleStores } from "@/hooks/useAccessibleStores";
import { useSectors } from "@/hooks/useStaffingMatrix";
import { usePracasByUnit, type Praca, type TurnoPraca, type DiaSemanaPraca } from "@/hooks/usePracas";
import {
  useUpdatePracaQtd,
  useCreatePraca,
  useDeletePracaGrupo,
  useReplicarPracas,
  useApplySeedPracas,
  DIAS,
  TURNOS,
} from "@/hooks/usePracasAdmin";

const DIA_LABEL: Record<DiaSemanaPraca, string> = {
  SEGUNDA: "Seg",
  TERCA: "Ter",
  QUARTA: "Qua",
  QUINTA: "Qui",
  SEXTA: "Sex",
  SABADO: "Sáb",
  DOMINGO: "Dom",
};

const TURNO_LABEL: Record<TurnoPraca, string> = {
  ALMOCO: "Almoço",
  JANTAR: "Jantar",
  TARDE: "Tarde",
};

const TURNO_COLOR: Record<TurnoPraca, string> = {
  ALMOCO: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  JANTAR: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  TARDE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

interface GroupedPraca {
  setor: string;
  nome_praca: string;
  turno: TurnoPraca;
  byDia: Map<DiaSemanaPraca, Praca>;
}

function groupPracas(pracas: Praca[]): Map<string, GroupedPraca[]> {
  const bySetor = new Map<string, Map<string, GroupedPraca>>();
  for (const p of pracas) {
    const key = `${p.nome_praca}__${p.turno}`;
    if (!bySetor.has(p.setor)) bySetor.set(p.setor, new Map());
    const setorMap = bySetor.get(p.setor)!;
    if (!setorMap.has(key)) {
      setorMap.set(key, {
        setor: p.setor,
        nome_praca: p.nome_praca,
        turno: p.turno,
        byDia: new Map(),
      });
    }
    setorMap.get(key)!.byDia.set(p.dia_semana, p);
  }
  const result = new Map<string, GroupedPraca[]>();
  for (const [setor, map] of bySetor.entries()) {
    const arr = Array.from(map.values()).sort((a, b) => {
      if (a.turno !== b.turno) return TURNOS.indexOf(a.turno) - TURNOS.indexOf(b.turno);
      return a.nome_praca.localeCompare(b.nome_praca);
    });
    result.set(setor, arr);
  }
  return result;
}

export function PracasConfig() {
  const { stores } = useAccessibleStores();
  const [unitId, setUnitId] = useState<string | null>(null);
  const { data: sectors = [] } = useSectors(unitId);
  const { data: pracas = [], isLoading } = usePracasByUnit(unitId);

  const updateQtd = useUpdatePracaQtd();
  const createPraca = useCreatePraca();
  const deleteGrupo = useDeletePracaGrupo();
  const replicar = useReplicarPracas();
  const applySeed = useApplySeedPracas();

  const grouped = useMemo(() => groupPracas(pracas), [pracas]);

  // Sectors used in praças that don't match any sector cadastrado in the unit
  const sectorNames = useMemo(
    () => new Set(sectors.map((s) => s.name.toLowerCase().trim())),
    [sectors]
  );
  const orphanSectors = useMemo(() => {
    const orphans: string[] = [];
    for (const setor of grouped.keys()) {
      if (!sectorNames.has(setor.toLowerCase().trim())) orphans.push(setor);
    }
    return orphans;
  }, [grouped, sectorNames]);

  const allSetorOptions = useMemo(() => {
    const set = new Set<string>();
    sectors.forEach((s) => set.add(s.name));
    pracas.forEach((p) => set.add(p.setor));
    return Array.from(set).sort();
  }, [sectors, pracas]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Plano de Chão (Praças)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Defina, por loja e setor, as praças operacionais e o efetivo necessário em cada dia/turno.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={unitId ?? ""} onValueChange={(v) => setUnitId(v || null)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!unitId && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Selecione uma loja para visualizar e editar suas praças.
          </p>
        )}

        {unitId && isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {unitId && !isLoading && (
          <>
            {/* Top action bar */}
            <div className="flex flex-wrap items-center gap-2">
              <NewPracaDialog
                unitId={unitId}
                sectorOptions={allSetorOptions}
                onCreate={(p) => createPraca.mutate(p)}
                isPending={createPraca.isPending}
              />

              <ReplicarDialog
                currentUnitId={unitId}
                stores={stores.filter((s) => s.id !== unitId)}
                onReplicate={(sourceId) =>
                  replicar.mutate({ source_unit_id: sourceId, target_unit_id: unitId })
                }
                isPending={replicar.isPending}
              />

              {pracas.length === 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => applySeed.mutate(unitId)}
                  disabled={applySeed.isPending}
                >
                  {applySeed.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Aplicar seed padrão
                </Button>
              )}
            </div>

            {/* Orphan warning */}
            {orphanSectors.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Setores sem correspondência:</strong>{" "}
                  {orphanSectors.join(", ")}. Esses nomes não casam com nenhum setor cadastrado da loja
                  e podem não ser detectados pelo Editor de Escalas.
                </div>
              </div>
            )}

            {/* Empty state */}
            {pracas.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <MapPin className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Esta loja ainda não tem praças cadastradas.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use “Aplicar seed padrão” para começar com a configuração da rede, ou crie manualmente.
                </p>
              </div>
            )}

            {/* Grouped lists */}
            {Array.from(grouped.entries()).map(([setor, items]) => (
              <SetorBlock
                key={setor}
                setor={setor}
                items={items}
                unitId={unitId}
                onChangeQtd={(praca, dia, qtd) =>
                  updateQtd.mutate({
                    unit_id: unitId,
                    setor: praca.setor,
                    nome_praca: praca.nome_praca,
                    turno: praca.turno,
                    dia_semana: dia,
                    qtd_necessaria: qtd,
                  })
                }
                onDeleteGrupo={(g) =>
                  deleteGrupo.mutate({
                    unit_id: unitId,
                    setor: g.setor,
                    nome_praca: g.nome_praca,
                    turno: g.turno,
                  })
                }
              />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SetorBlock({
  setor,
  items,
  unitId,
  onChangeQtd,
  onDeleteGrupo,
}: {
  setor: string;
  items: GroupedPraca[];
  unitId: string;
  onChangeQtd: (praca: GroupedPraca, dia: DiaSemanaPraca, qtd: number) => void;
  onDeleteGrupo: (g: GroupedPraca) => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
        <h3 className="font-semibold text-sm">{setor}</h3>
        <Badge variant="outline" className="text-xs">
          {items.length} praça{items.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="divide-y">
        {items.map((g) => (
          <div key={`${g.nome_praca}__${g.turno}`} className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{g.nome_praca}</span>
                <Badge variant="outline" className={`text-[10px] ${TURNO_COLOR[g.turno]}`}>
                  {TURNO_LABEL[g.turno]}
                </Badge>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover praça?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso remove “{g.nome_praca}” ({TURNO_LABEL[g.turno]}) do setor {setor} em todos
                      os 7 dias da semana. Funcionários já vinculados a essa praça nas escalas existentes
                      ficarão sem praça (mas não serão removidos).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDeleteGrupo(g)}>Remover</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {DIAS.map((dia) => {
                const row = g.byDia.get(dia);
                const value = row?.qtd_necessaria ?? 0;
                return (
                  <div key={dia} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] uppercase font-medium text-muted-foreground">
                      {DIA_LABEL[dia]}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={value}
                      key={`${g.nome_praca}-${g.turno}-${dia}-${value}`}
                      className="h-8 px-1 text-center text-sm"
                      onBlur={(e) => {
                        const next = parseInt(e.target.value, 10);
                        if (Number.isNaN(next) || next < 0) return;
                        if (next === value) return;
                        onChangeQtd(g, dia, next);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewPracaDialog({
  unitId,
  sectorOptions,
  onCreate,
  isPending,
}: {
  unitId: string;
  sectorOptions: string[];
  onCreate: (p: { unit_id: string; setor: string; nome_praca: string; turno: TurnoPraca }) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [setor, setSetor] = useState<string>("");
  const [setorCustom, setSetorCustom] = useState("");
  const [nome, setNome] = useState("");
  const [turno, setTurno] = useState<TurnoPraca>("ALMOCO");

  const reset = () => {
    setSetor("");
    setSetorCustom("");
    setNome("");
    setTurno("ALMOCO");
  };

  const handleSubmit = () => {
    const finalSetor = (setor === "__custom__" ? setorCustom : setor).trim();
    if (!finalSetor || !nome.trim()) return;
    onCreate({ unit_id: unitId, setor: finalSetor, nome_praca: nome.trim(), turno });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" /> Nova praça
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova praça</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Setor</Label>
            <Select value={setor} onValueChange={setSetor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {sectorOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">+ Outro (digitar)…</SelectItem>
              </SelectContent>
            </Select>
            {setor === "__custom__" && (
              <Input
                className="mt-2"
                placeholder="Nome do setor"
                value={setorCustom}
                onChange={(e) => setSetorCustom(e.target.value)}
              />
            )}
          </div>
          <div>
            <Label className="text-xs">Nome da praça</Label>
            <Input
              placeholder="Ex: Garçom Almoço, Fogão, Bar Jantar..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Turno</Label>
            <Select value={turno} onValueChange={(v) => setTurno(v as TurnoPraca)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TURNOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TURNO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Será criada uma linha para cada dia da semana com quantidade inicial 1. Você pode ajustar
            depois inline.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar praça
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReplicarDialog({
  currentUnitId,
  stores,
  onReplicate,
  isPending,
}: {
  currentUnitId: string;
  stores: { id: string; nome: string }[];
  onReplicate: (sourceId: string) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string>("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Copy className="h-4 w-4" /> Replicar de outra loja
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replicar praças de outra loja</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Todas as praças da loja origem serão copiadas para a loja atual. Praças já existentes com
            mesma combinação serão atualizadas.
          </p>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Loja de origem" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!sourceId) return;
              onReplicate(sourceId);
              setOpen(false);
            }}
            disabled={!sourceId || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Replicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
