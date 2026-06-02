import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PopDiarioRow } from "@/hooks/usePopDiario";
import { SectorDrillDown } from "./SectorDrillDown";

interface SectorTableProps {
  rows: PopDiarioRow[];
  unitName: string;
  isLoading?: boolean;
}

function useSectorNames(ids: string[]) {
  const key = [...new Set(ids)].sort().join(",");
  return useQuery({
    queryKey: ["sectors-names", key],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors")
        .select("id, name")
        .in("id", [...new Set(ids)]);
      if (error) throw error;
      const m = new Map<string, string>();
      for (const r of (data as any[]) || []) m.set(r.id, r.name);
      return m;
    },
  });
}

const statusRowBg: Record<string, string> = {
  conforme: "bg-green-50/60 hover:bg-green-50",
  inconforme: "bg-red-50/60 hover:bg-red-50",
  aguardando: "bg-blue-50/60 hover:bg-blue-50",
  sem_pop: "bg-muted/30 hover:bg-muted/50",
};

function StatusBadge({ status }: { status: PopDiarioRow["status"] }) {
  switch (status) {
    case "conforme":
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 gap-1">
          <CheckCircle2 className="h-3 w-3" /> OK
        </Badge>
      );
    case "inconforme":
      return (
        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 gap-1">
          <XCircle className="h-3 w-3" /> Gap
        </Badge>
      );
    case "aguardando":
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 gap-1">
          <Clock className="h-3 w-3" /> Aguarda
        </Badge>
      );
    case "sem_pop":
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1">
          <Minus className="h-3 w-3" /> Sem POP
        </Badge>
      );
  }
}

export function SectorTable({ rows, unitName, isLoading }: SectorTableProps) {
  const sectorIds = useMemo(() => rows.map((r) => r.sector_id), [rows]);
  const sectors = useSectorNames(sectorIds);
  const [drillRow, setDrillRow] = useState<PopDiarioRow | null>(null);

  const enriched = useMemo(() => {
    const list = rows.map((r) => ({
      row: r,
      name: sectors.data?.get(r.sector_id) ?? r.sector_id.slice(0, 8),
    }));
    // sort: turno -> sem_pop last -> name
    return list.sort((a, b) => {
      if (a.row.turno !== b.row.turno) return a.row.turno.localeCompare(b.row.turno);
      if (a.row.sem_pop !== b.row.sem_pop) return a.row.sem_pop ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [rows, sectors.data]);

  if (isLoading || sectors.isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Sem setores com escala neste turno/data.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">Setor</TableHead>
              <TableHead className="text-center">POP</TableHead>
              <TableHead className="text-center">Esc</TableHead>
              <TableHead className="text-center">Pres</TableHead>
              <TableHead className="text-center">Falt</TableHead>
              <TableHead className="text-center">Extra</TableHead>
              <TableHead className="text-center">Saldo</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enriched.map(({ row, name }) => {
              const saldoTxt = row.sem_pop ? "—" : row.saldo_final;
              const saldoCls = row.sem_pop
                ? "text-muted-foreground"
                : row.saldo_final < 0
                ? "text-red-700 font-semibold"
                : row.saldo_final === 0
                ? "text-foreground"
                : "text-green-700 font-semibold";
              return (
                <TableRow
                  key={`${row.sector_id}-${row.turno}`}
                  className={cn("cursor-pointer", statusRowBg[row.status])}
                  onClick={() => setDrillRow(row)}
                >
                  <TableCell className="font-medium text-sm">
                    {name}
                    <span className="ml-2 text-[10px] text-muted-foreground uppercase">
                      {row.turno === "ALMOCO" ? "alm" : "jan"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {row.sem_pop ? "—" : row.pop_minimo}
                  </TableCell>
                  <TableCell className="text-center text-sm">{row.escalados}</TableCell>
                  <TableCell className="text-center text-sm">{row.presentes}</TableCell>
                  <TableCell className="text-center text-sm">
                    {row.sem_pop ? "—" : row.faltantes}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {row.extras_freelancer > 0 ? `${row.extras_freelancer} fl` : "—"}
                  </TableCell>
                  <TableCell className={cn("text-center text-sm", saldoCls)}>
                    {saldoTxt}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <SectorDrillDown
        open={!!drillRow}
        onOpenChange={(v) => !v && setDrillRow(null)}
        sectorName={drillRow ? sectors.data?.get(drillRow.sector_id) ?? "Setor" : ""}
        unitName={unitName}
        row={drillRow}
      />
    </>
  );
}
