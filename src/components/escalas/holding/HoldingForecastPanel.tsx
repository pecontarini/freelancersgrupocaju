import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDeleteHoldingForecast,
  useHoldingFreelancerForecast,
  useUpsertHoldingForecast,
} from "@/hooks/useHoldingConfig";
import { useHoldingFreelancerBudgetCalc } from "@/hooks/useHoldingFreelancerBudgetCalc";
import {
  SECTOR_LABELS,
  SHIFT_TYPES,
  sectorsForBrand,
  type Brand,
  type SectorKey,
} from "@/lib/holding/sectors";

interface Props {
  brand: Brand;
  unitId: string;
  monthYear: string;
}

/**
 * F2 — Previsão de freelancers por data específica.
 * O COO pode pré-cadastrar reforços (eventos, feriados, etc.)
 * para o mês selecionado.
 */
export function HoldingForecastPanel({ brand, unitId, monthYear }: Props) {
  const { data, isLoading } = useHoldingFreelancerForecast(unitId, monthYear);
  const remove = useDeleteHoldingForecast();
  const sectors = sectorsForBrand(brand);
  const [open, setOpen] = useState(false);
  const calc = useHoldingFreelancerBudgetCalc(unitId, monthYear, brand);

  const sortedRows = useMemo(() => {
    return [...(data ?? [])].sort((a, b) => {
      if (a.forecast_date === b.forecast_date) {
        return a.shift_type.localeCompare(b.shift_type);
      }
      return a.forecast_date.localeCompare(b.forecast_date);
    });
  }, [data]);

  const totalCount = useMemo(
    () => sortedRows.reduce((acc, r) => acc + (r.freelancer_count ?? 0), 0),
    [sortedRows],
  );

  return (
    <div className="space-y-3">
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumo do Mês — Diárias Previstas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cruzamento automático: <strong>Gap</strong> (mínimo dimensionado − CLT efetivo,
            multiplicado pelos dias do mês) + <strong>Pontuais</strong> (cadastros abaixo).
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Gap (estrutural)</TableHead>
                  <TableHead className="text-right">Pontuais</TableHead>
                  <TableHead className="text-right">Total Diárias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calc.perSector.map((row) => (
                  <TableRow key={row.sector}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.gapDiarias}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.pontuaisDiarias}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {row.totalDiarias}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-primary/5">
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {calc.totalGapDiarias}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {calc.totalPontuaisDiarias}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-primary">
                    {calc.totalDiarias}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-base">
            Previsão Pontual — {monthYear}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Reforços por data específica (eventos, feriados). Total pontual:{" "}
            <strong className="text-foreground">{totalCount}</strong>{" "}
            freelancer(s).
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nova Previsão
            </Button>
          </DialogTrigger>
          <NewForecastDialog
            brand={brand}
            unitId={unitId}
            monthYear={monthYear}
            sectors={sectors}
            onClose={() => setOpen(false)}
          />
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : sortedRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma previsão cadastrada para este mês.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium tabular-nums">
                      {formatDate(r.forecast_date)}
                    </TableCell>
                    <TableCell>
                      {SECTOR_LABELS[r.sector_key as SectorKey] ?? r.sector_key}
                    </TableCell>
                    <TableCell className="capitalize">
                      {r.shift_type === "almoco" ? "Almoço" : "Jantar"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge variant="secondary">{r.freelancer_count}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.reason || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => remove.mutate(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

function formatDate(yyyy_mm_dd: string) {
  // pure string handling para evitar bugs de timezone
  const [y, m, d] = yyyy_mm_dd.split("-");
  return `${d}/${m}/${y}`;
}

function NewForecastDialog({
  brand,
  unitId,
  monthYear,
  sectors,
  onClose,
}: {
  brand: Brand;
  unitId: string;
  monthYear: string;
  sectors: SectorKey[];
  onClose: () => void;
}) {
  const upsert = useUpsertHoldingForecast();
  const [date, setDate] = useState(`${monthYear}-01`);
  const [sector, setSector] = useState<SectorKey | "">("");
  const [shift, setShift] = useState<"almoco" | "jantar">("almoco");
  const [count, setCount] = useState("1");
  const [reason, setReason] = useState("");

  const canSubmit = !!sector && !!date && Number(count) > 0;

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nova Previsão de Freelancers</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input
            type="date"
            value={date}
            min={`${monthYear}-01`}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Setor</Label>
            <Select value={sector} onValueChange={(v) => setSector(v as SectorKey)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SECTOR_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Turno</Label>
            <Select value={shift} onValueChange={(v) => setShift(v as "almoco" | "jantar")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_TYPES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Quantidade de freelancers</Label>
          <Input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Motivo (opcional)</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: Evento, Feriado, Reforço de fim de semana"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!canSubmit || upsert.isPending}
          onClick={async () => {
            if (!sector) return;
            await upsert.mutateAsync({
              unit_id: unitId,
              brand,
              forecast_date: date,
              sector_key: sector,
              shift_type: shift,
              freelancer_count: Math.max(1, Math.floor(Number(count) || 1)),
              reason: reason.trim() || null,
            });
            onClose();
          }}
        >
          {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Previsão
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
