import { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, TrendingDown, ShoppingCart, Edit3 } from "lucide-react";
import {
  useVendasAjuste,
  useWeeklySales,
  useSalesMappings,
  useDesvioCalculation,
  type VendasAjusteEntry,
} from "@/hooks/useCMVVendasDesvio";
import { DIAS, type SemanaCMV, type CamaraEntry, type PracaEntry } from "@/hooks/useCMVSemanas";

type CMVItem = { id: string; nome: string; unidade: string };

interface Props {
  semana: SemanaCMV;
  items: CMVItem[];
  camaraEntries: CamaraEntry[];
  pracaEntries: PracaEntry[];
  readOnly: boolean;
}

const META = 0.6;

export function CMVVendasDesvioGrid({ semana, items, camaraEntries, pracaEntries, readOnly }: Props) {
  const { entries: ajusteEntries, upsert: ajusteUpsert } = useVendasAjuste(semana.id);
  const { data: salesData = [] } = useWeeklySales(semana.data_inicio, semana.data_fim);
  const { data: mappings = [] } = useSalesMappings();

  const { desvioRows, vendasAutoPorItemDia } = useDesvioCalculation(
    semana, items, camaraEntries, pracaEntries, ajusteEntries, salesData, mappings
  );

  return (
    <Tabs defaultValue="cruzamento" className="space-y-3">
      <TabsList className="grid grid-cols-3 w-full max-w-md">
        <TabsTrigger value="cruzamento" className="gap-1 text-xs">
          <TrendingDown className="h-3.5 w-3.5" /> Cruzamento
        </TabsTrigger>
        <TabsTrigger value="vendas-auto" className="gap-1 text-xs">
          <ShoppingCart className="h-3.5 w-3.5" /> Vendas Auto
        </TabsTrigger>
        <TabsTrigger value="ajuste" className="gap-1 text-xs">
          <Edit3 className="h-3.5 w-3.5" /> Ajuste Manual
        </TabsTrigger>
      </TabsList>

      {/* Cruzamento */}
      <TabsContent value="cruzamento">
        <DesvioTable rows={desvioRows} />
      </TabsContent>

      {/* Vendas Auto */}
      <TabsContent value="vendas-auto">
        <VendasAutoTable items={items} vendasPorItemDia={vendasAutoPorItemDia} />
      </TabsContent>

      {/* Ajuste Manual */}
      <TabsContent value="ajuste">
        <AjusteManualTable
          semanaId={semana.id}
          items={items}
          entries={ajusteEntries}
          onUpsert={(p) => ajusteUpsert.mutate(p)}
          readOnly={readOnly}
        />
      </TabsContent>
    </Tabs>
  );
}

// ─── Cruzamento Table ─────────────────────────────────────────────

function DesvioTable({ rows }: { rows: ReturnType<typeof useDesvioCalculation>["desvioRows"] }) {
  const hasData = rows.some((r) => r.vendasTotal > 0 || r.consumoCamara > 0 || r.consumoPraca > 0);

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Sem dados de vendas ou contagem para cruzamento nesta semana.
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">Produto</TableHead>
            <TableHead className="text-center min-w-[80px]">Câmara (Saídas)</TableHead>
            <TableHead className="text-center min-w-[80px]">Praça (VAR)</TableHead>
            <TableHead className="text-center min-w-[80px]">Vendas Teór.</TableHead>
            <TableHead className="text-center min-w-[70px]">Ajuste</TableHead>
            <TableHead className="text-center min-w-[80px]">Total Vendas</TableHead>
            <TableHead className="text-center min-w-[90px]">Desvio Câm.</TableHead>
            <TableHead className="text-center min-w-[90px]">Desvio Praça</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            if (row.vendasTotal === 0 && row.consumoCamara === 0 && row.consumoPraca === 0) return null;
            return (
              <TableRow key={row.itemId}>
                <TableCell className="font-medium text-sm">{row.itemNome}</TableCell>
                <TableCell className="text-center text-sm">{row.consumoCamara.toFixed(1)}</TableCell>
                <TableCell className="text-center text-sm">{row.consumoPraca.toFixed(1)}</TableCell>
                <TableCell className="text-center text-sm">{row.vendasTeorico.toFixed(1)}</TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {row.ajusteManual !== 0 ? row.ajusteManual.toFixed(1) : "—"}
                </TableCell>
                <TableCell className="text-center text-sm font-medium">{row.vendasTotal.toFixed(1)}</TableCell>
                <TableCell className="text-center">
                  <DeviationBadge value={row.desvioCamara} pct={row.desvioCamaraPct} hasData={row.vendasTotal > 0} />
                </TableCell>
                <TableCell className="text-center">
                  <DeviationBadge value={row.desvioPraca} pct={row.desvioPracaPct} hasData={row.vendasTotal > 0} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function DeviationBadge({ value, pct, hasData }: { value: number; pct: number; hasData: boolean }) {
  if (!hasData) return <span className="text-xs text-muted-foreground">—</span>;
  const absMeta = Math.abs(pct) > META;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-xs font-medium ${absMeta ? "text-destructive" : "text-green-600"}`}>
        {value >= 0 ? "+" : ""}{value.toFixed(1)}
      </span>
      <Badge variant={absMeta ? "destructive" : "default"} className="text-[10px] px-1 py-0">
        {pct.toFixed(1)}% {absMeta ? "🔴" : "🟢"}
      </Badge>
    </div>
  );
}

// ─── Vendas Auto Table ────────────────────────────────────────────

function VendasAutoTable({
  items,
  vendasPorItemDia,
}: {
  items: CMVItem[];
  vendasPorItemDia: Record<string, Record<string, number>>;
}) {
  const relevantItems = items.filter((i) => vendasPorItemDia[i.id]);

  if (!relevantItems.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Nenhuma venda mapeada encontrada para esta semana.
          <br />
          <span className="text-xs">Verifique se os mapeamentos de vendas (CMV → Pratos) estão configurados.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">Produto</TableHead>
            {DIAS.map((d) => (
              <TableHead key={d} className="text-center min-w-[60px]">{d}</TableHead>
            ))}
            <TableHead className="text-center min-w-[70px] font-bold">TOTAL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {relevantItems.map((item) => {
            const dias = vendasPorItemDia[item.id] || {};
            const total = DIAS.reduce((s, d) => s + (dias[d] || 0), 0);
            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-sm">{item.nome}</TableCell>
                {DIAS.map((d) => (
                  <TableCell key={d} className="text-center text-sm">
                    {dias[d] ? dias[d].toFixed(1) : "—"}
                  </TableCell>
                ))}
                <TableCell className="text-center text-sm font-bold">{total.toFixed(1)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ─── Ajuste Manual Table ──────────────────────────────────────────

function AjusteManualTable({
  semanaId,
  items,
  entries,
  onUpsert,
  readOnly,
}: {
  semanaId: string;
  items: CMVItem[];
  entries: VendasAjusteEntry[];
  onUpsert: (p: { semana_id: string; cmv_item_id: string; dia: string; quantidade_manual: number | null }) => void;
  readOnly: boolean;
}) {
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleChange = useCallback(
    (itemId: string, dia: string, raw: string) => {
      const key = `${itemId}-${dia}`;
      clearTimeout(debounceTimers.current[key]);
      debounceTimers.current[key] = setTimeout(() => {
        const val = raw.trim() === "" ? null : parseFloat(raw);
        if (val !== null && isNaN(val)) return;
        onUpsert({ semana_id: semanaId, cmv_item_id: itemId, dia, quantidade_manual: val });
      }, 800);
    },
    [semanaId, onUpsert]
  );

  const getVal = (itemId: string, dia: string) => {
    const e = entries.find((x) => x.cmv_item_id === itemId && x.dia === dia);
    return e?.quantidade_manual;
  };

  return (
    <ScrollArea className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">Produto</TableHead>
            {DIAS.map((d) => (
              <TableHead key={d} className="text-center min-w-[70px]">{d}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-sm">{item.nome}</TableCell>
              {DIAS.map((dia) => {
                const val = getVal(item.id, dia);
                return (
                  <TableCell key={dia} className="p-1">
                    <input
                      type="number"
                      min={0}
                      step={item.unidade === "kg" ? "0.1" : "1"}
                      defaultValue={val ?? ""}
                      disabled={readOnly}
                      onChange={(e) => handleChange(item.id, dia, e.target.value)}
                      className="w-full h-9 text-center text-sm rounded-md border border-input bg-background px-1 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
