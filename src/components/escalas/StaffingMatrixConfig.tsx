import { useState } from "react";
import { Plus, Trash2, Loader2, Lock } from "lucide-react";
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

  const getCount = (sectorId: string, day: number, shiftType: string) => {
    const entry = matrix.find(
      (m) => m.sector_id === sectorId && m.day_of_week === day && m.shift_type === shiftType
    );
    return entry?.required_count ?? 0;
  };

  const handleCountChange = (sectorId: string, day: number, shiftType: string, value: string) => {
    if (!isAdmin) return;
    const num = parseInt(value) || 0;
    upsertMatrix.mutate({
      sector_id: sectorId,
      day_of_week: day,
      shift_type: shiftType,
      required_count: num,
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
            Defina a quantidade mínima de pessoas por setor, dia e turno (POP nº 02).
          </p>
        </div>
        {!isAdmin && (
          <Badge variant="secondary" className="gap-1 self-start">
            <Lock className="h-3 w-3" /> Somente visualização
          </Badge>
        )}
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

          {isAdmin && selectedUnit && (
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
            Nenhum setor cadastrado para esta unidade. {isAdmin ? "Clique em \"Novo Setor\" para começar." : ""}
          </CardContent>
        </Card>
      )}

      {selectedUnit && !isLoading && sectors.length > 0 && shiftTypes.map((shiftType) => {
        const shiftLabel = shifts.find((s) => s.type === shiftType)?.name || shiftType;

        return (
          <Card key={shiftType}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Turno: {shiftLabel}</CardTitle>
              <CardDescription>Quantidade mínima de pessoas por setor e dia</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Setor</TableHead>
                      {DAYS.map((d) => (
                        <TableHead key={d.value} className="text-center min-w-[70px]">
                          {d.label}
                        </TableHead>
                      ))}
                      {isAdmin && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectors.map((sector) => (
                      <TableRow key={sector.id}>
                        <TableCell className="font-medium">{sector.name}</TableCell>
                        {DAYS.map((d) => {
                          const count = getCount(sector.id, d.value, shiftType);
                          return (
                            <TableCell key={d.value} className="text-center p-1">
                              {isAdmin ? (
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-8 w-14 text-center mx-auto"
                                  defaultValue={count}
                                  onBlur={(e) =>
                                    handleCountChange(sector.id, d.value, shiftType, e.target.value)
                                  }
                                />
                              ) : (
                                <span className={count > 0 ? "font-semibold" : "text-muted-foreground"}>
                                  {count}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                        {isAdmin && (
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
                        )}
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
