import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  useSectors,
  useShifts,
  useStaffingMatrix,
  useUpsertStaffingMatrix,
  useAddSector,
  useDeleteSector,
} from "@/hooks/useStaffingMatrix";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StaffingMatrixImporter } from "./StaffingMatrixImporter";

const DAYS = [
  { value: 0, label: "Seg" },
  { value: 1, label: "Ter" },
  { value: 2, label: "Qua" },
  { value: 3, label: "Qui" },
  { value: 4, label: "Sex" },
  { value: 5, label: "Sáb" },
  { value: 6, label: "Dom" },
];

export function StaffingMatrixConfig() {
  const { isAdmin } = useUserProfile();
  const lojas = useConfigLojas();
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [newSectorName, setNewSectorName] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: sectors = [], isLoading: loadingSectors } = useSectors(selectedUnit);
  const { data: shifts = [], isLoading: loadingShifts } = useShifts();
  const sectorIds = sectors.map((s) => s.id);
  const { data: matrix = [], isLoading: loadingMatrix } = useStaffingMatrix(sectorIds);
  const upsertMatrix = useUpsertStaffingMatrix();
  const addSector = useAddSector();
  const deleteSector = useDeleteSector();

  const shiftTypes = [...new Set(shifts.map((s) => s.type))];

  const getEntry = (sectorId: string, day: number, shiftType: string) => {
    return matrix.find(
      (m) => m.sector_id === sectorId && m.day_of_week === day && m.shift_type === shiftType
    );
  };

  const getCount = (sectorId: string, day: number, shiftType: string) => {
    return getEntry(sectorId, day, shiftType)?.required_count ?? 0;
  };

  const getExtras = (sectorId: string, day: number, shiftType: string) => {
    const entry = getEntry(sectorId, day, shiftType);
    return entry?.extras_count ?? 0;
  };

  const handleCountChange = (sectorId: string, day: number, shiftType: string, value: string) => {
    const num = parseInt(value) || 0;
    const currentExtras = getExtras(sectorId, day, shiftType);
    upsertMatrix.mutate({
      sector_id: sectorId,
      day_of_week: day,
      shift_type: shiftType,
      required_count: num,
      extras_count: currentExtras,
    });
  };

  const handleExtrasChange = (sectorId: string, day: number, shiftType: string, value: string) => {
    const num = parseInt(value) || 0;
    const currentCount = getCount(sectorId, day, shiftType);
    upsertMatrix.mutate({
      sector_id: sectorId,
      day_of_week: day,
      shift_type: shiftType,
      required_count: currentCount,
      extras_count: num,
    });
  };

  const handleAddSector = () => {
    if (!selectedUnit || !newSectorName.trim()) return;
    addSector.mutate(
      { unit_id: selectedUnit, name: newSectorName.trim() },
      {
        onSuccess: () => {
          setNewSectorName("");
          setAddDialogOpen(false);
        },
      }
    );
  };

  const isLoading = loadingSectors || loadingShifts || loadingMatrix;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Matriz de Efetivo Mínimo</h2>
          <p className="text-muted-foreground">
            Defina a quantidade mínima de efetivos e extras por setor, dia e turno (POP nº 02).
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Formato: <Badge variant="outline" className="text-[10px] px-1.5 py-0">Efetivos + Extras</Badge> — 
            Efetivos = quadro fixo (CLT) · Extras = diárias/freelancers planejados
          </p>
        </div>
      </div>

      {/* Unit selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selecione a Unidade</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={selectedUnit || ""} onValueChange={(v) => setSelectedUnit(v)}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Escolha a unidade" />
            </SelectTrigger>
            <SelectContent>
              {lojas.options.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedUnit && (
            <>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Novo Setor
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Setor</DialogTitle>
                  </DialogHeader>
                  <div className="flex gap-2 pt-2">
                    <Input
                      placeholder="Ex: Cozinha, Salão, Bar..."
                      value={newSectorName}
                      onChange={(e) => setNewSectorName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSector()}
                    />
                    <Button onClick={handleAddSector} disabled={addSector.isPending}>
                      Adicionar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <StaffingMatrixImporter
                selectedUnit={selectedUnit}
                sectors={sectors}
                onUpsert={(row) => upsertMatrix.mutate(row)}
                onAddSector={async (params) => { addSector.mutateAsync(params); }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Matrix */}
      {!selectedUnit && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione uma unidade para visualizar a matriz.
          </CardContent>
        </Card>
      )}

      {selectedUnit && isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {selectedUnit && !isLoading && sectors.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum setor cadastrado para esta unidade. {isAdmin ? 'Clique em "Novo Setor" para começar.' : ""}
          </CardContent>
        </Card>
      )}

      {selectedUnit && !isLoading && sectors.length > 0 && shiftTypes.map((shiftType) => {
        const shiftLabel = shifts.find((s) => s.type === shiftType)?.name || shiftType;

        return (
          <Card key={shiftType}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Turno: {shiftLabel}</CardTitle>
              <CardDescription>
                Quantidade mínima de pessoas por setor e dia — 
                <span className="font-medium text-foreground"> Efetivos</span> (topo) + 
                <span className="font-medium text-orange-600 dark:text-orange-400"> Extras</span> (baixo)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Setor</TableHead>
                      {DAYS.map((d) => (
                        <TableHead key={d.value} className="text-center min-w-[90px]">
                          {d.label}
                        </TableHead>
                      ))}
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectors.map((sector) => (
                      <TableRow key={sector.id}>
                        <TableCell className="font-medium">{sector.name}</TableCell>
                        {DAYS.map((d) => {
                          const count = getCount(sector.id, d.value, shiftType);
                          const extras = getExtras(sector.id, d.value, shiftType);
                          return (
                            <TableCell key={d.value} className="text-center p-1">
                              <div className="flex flex-col items-center gap-0.5">
                                <Input
                                  key={`eff-${sector.id}-${d.value}-${shiftType}-${count}`}
                                  type="number"
                                  min={0}
                                  className="h-7 w-12 text-center mx-auto text-xs"
                                  defaultValue={count}
                                  onBlur={(e) => {
                                    const v = parseInt(e.target.value) || 0;
                                    if (v !== count) handleCountChange(sector.id, d.value, shiftType, e.target.value);
                                  }}
                                  title="Efetivos (quadro fixo)"
                                />
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[9px] text-orange-500 font-bold">+</span>
                                  <Input
                                    key={`ext-${sector.id}-${d.value}-${shiftType}-${extras}`}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="h-7 w-12 text-center mx-auto text-xs border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    defaultValue={extras}
                                    onBlur={(e) => {
                                      const v = parseInt(e.target.value) || 0;
                                      if (v !== extras) handleExtrasChange(sector.id, d.value, shiftType, e.target.value);
                                    }}
                                    title="Extras (freelancers/diárias)"
                                  />
                                </div>
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell className="p-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteSector.mutate(sector.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
