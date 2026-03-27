import { useMemo, useState, useCallback, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DIAS, type DiaSemana, type CamaraEntry, type SemanaCMV } from "@/hooks/useCMVSemanas";
import { cn } from "@/lib/utils";

type CMVItem = { id: string; nome: string; unidade: string };

interface Props {
  semana: SemanaCMV;
  items: CMVItem[];
  entries: CamaraEntry[];
  onUpsert: (params: { semana_id: string; cmv_item_id: string; dia: string; entrada?: number | null; saida?: number | null }) => void;
  readOnly?: boolean;
}

export function CMVCamaraGrid({ semana, items, entries, onUpsert, readOnly }: Props) {
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Build lookup: itemId -> dia -> entry
  const lookup = useMemo(() => {
    const m: Record<string, Record<string, CamaraEntry>> = {};
    entries.forEach((e) => {
      if (!m[e.cmv_item_id]) m[e.cmv_item_id] = {};
      m[e.cmv_item_id][e.dia] = e;
    });
    return m;
  }, [entries]);

  // Calculate chained balances for each item
  const balances = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    items.forEach((item) => {
      const saldoAnterior = (semana.saldo_anterior_json as Record<string, number>)?.[item.id] ?? 0;
      const itemBalances: Record<string, number> = {};
      let running = saldoAnterior;
      DIAS.forEach((dia) => {
        const entry = lookup[item.id]?.[dia];
        const ent = entry?.entrada ?? 0;
        const sai = entry?.saida ?? 0;
        running = running + ent - sai;
        itemBalances[dia] = running;
      });
      result[item.id] = itemBalances;
    });
    return result;
  }, [items, lookup, semana.saldo_anterior_json]);

  // Weekly deviation per item
  const deviations = useMemo(() => {
    const result: Record<string, number> = {};
    items.forEach((item) => {
      const saldoInicial = (semana.saldo_anterior_json as Record<string, number>)?.[item.id] ?? 0;
      let totalEntradas = 0;
      let totalSaidas = 0;
      DIAS.forEach((dia) => {
        const entry = lookup[item.id]?.[dia];
        totalEntradas += entry?.entrada ?? 0;
        totalSaidas += entry?.saida ?? 0;
      });
      const base = saldoInicial + totalEntradas;
      result[item.id] = base > 0 ? (totalSaidas / base) * 100 : 0;
    });
    return result;
  }, [items, lookup, semana.saldo_anterior_json]);

  const handleChange = useCallback(
    (itemId: string, dia: string, field: "entrada" | "saida", value: string, unidade: string) => {
      const key = `${itemId}-${dia}-${field}`;
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);

      debounceTimers.current[key] = setTimeout(() => {
        const existing = lookup[itemId]?.[dia];
        const parsed = value === "" ? null : unidade === "UN" ? Math.round(Number(value.replace(",", "."))) : Number(value.replace(",", "."));
        if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;

        onUpsert({
          semana_id: semana.id,
          cmv_item_id: itemId,
          dia,
          entrada: field === "entrada" ? parsed : existing?.entrada ?? null,
          saida: field === "saida" ? parsed : existing?.saida ?? null,
        });
      }, 800);
    },
    [lookup, onUpsert, semana.id]
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Produto</TableHead>
            <TableHead className="text-center w-16">Desvio</TableHead>
            {DIAS.map((dia) => (
              <TableHead key={dia} colSpan={3} className="text-center border-l">
                {dia}
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10" />
            <TableHead className="text-center text-xs">%</TableHead>
            {DIAS.map((dia) => (
              <>
                <TableHead key={`${dia}-e`} className="text-center text-xs border-l min-w-[60px]">ENT</TableHead>
                <TableHead key={`${dia}-s`} className="text-center text-xs min-w-[60px]">SAÍ</TableHead>
                <TableHead key={`${dia}-b`} className="text-center text-xs min-w-[60px]">SALDO</TableHead>
              </>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const dev = deviations[item.id] ?? 0;
            const isOverThreshold = dev > 0.6;
            return (
              <TableRow key={item.id}>
                <TableCell className="sticky left-0 bg-background z-10 font-medium text-xs">
                  {item.nome}
                  <span className="text-muted-foreground ml-1">({item.unidade})</span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={isOverThreshold ? "destructive" : "default"} className="text-xs">
                    {dev.toFixed(1)}%
                  </Badge>
                </TableCell>
                {DIAS.map((dia) => {
                  const entry = lookup[item.id]?.[dia];
                  const saldo = balances[item.id]?.[dia] ?? 0;
                  const saldoNeg = saldo < 0;
                  return (
                    <>
                      <TableCell key={`${dia}-e`} className="p-1 border-l">
                        <Input
                          type="number"
                          min={0}
                          step={item.unidade === "KG" ? "0.01" : "1"}
                          defaultValue={entry?.entrada ?? ""}
                          onChange={(e) => handleChange(item.id, dia, "entrada", e.target.value, item.unidade)}
                          disabled={readOnly}
                          className="h-8 w-14 text-center text-xs p-1"
                        />
                      </TableCell>
                      <TableCell key={`${dia}-s`} className="p-1">
                        <Input
                          type="number"
                          min={0}
                          step={item.unidade === "KG" ? "0.01" : "1"}
                          defaultValue={entry?.saida ?? ""}
                          onChange={(e) => handleChange(item.id, dia, "saida", e.target.value, item.unidade)}
                          disabled={readOnly}
                          className="h-8 w-14 text-center text-xs p-1"
                        />
                      </TableCell>
                      <TableCell
                        key={`${dia}-b`}
                        className={cn(
                          "text-center text-xs font-semibold p-1",
                          saldoNeg && "text-destructive bg-destructive/10"
                        )}
                      >
                        <span className="flex items-center justify-center gap-1">
                          {saldo.toFixed(item.unidade === "KG" ? 2 : 0)}
                          {saldoNeg && <AlertTriangle className="h-3 w-3" />}
                        </span>
                      </TableCell>
                    </>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
