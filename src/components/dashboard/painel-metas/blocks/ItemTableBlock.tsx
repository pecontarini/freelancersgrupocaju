import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table2, ArrowUpDown } from "lucide-react";
import type { SheetBlock } from "@/hooks/useSheetBlocks";

type Column = { key: string; label: string; type?: "text" | "number" | "percent" | "currency" };

function fmt(v: unknown, type?: Column["type"]): string {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v !== "number") return String(v);
  if (type === "currency") return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (type === "percent") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  if (type === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return String(v);
}

export function ItemTableBlock({ block }: { block: SheetBlock }) {
  const payload = block.payload as {
    label?: string;
    columns?: Column[];
    rows?: Array<Record<string, unknown>>;
    // Legacy format
    canais?: string[];
    items?: Array<{ loja_codigo: string; valores: Record<string, number | null> }>;
    empty?: boolean;
  };

  // Legacy adapter
  const columns: Column[] = payload.columns ?? (payload.canais
    ? [{ key: "loja_codigo", label: "Loja", type: "text" }, ...payload.canais.map(c => ({ key: c, label: c, type: "number" as const }))]
    : []);
  const rows: Array<Record<string, unknown>> = payload.rows ?? (payload.items
    ? payload.items.map(it => ({ loja_codigo: it.loja_codigo, ...it.valores }))
    : []);

  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let r = rows;
    if (q) {
      const qq = q.toLowerCase();
      r = r.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(qq)));
    }
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = a[sortKey]; const bv = b[sortKey];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return r.slice(0, 50);
  }, [rows, q, sortKey, sortDir]);

  if (payload.empty || !rows.length) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-sm uppercase tracking-wide">{payload.label ?? "Tabela"}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Aguardando dados desta planilha.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl md:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-emerald-500" />
          <CardTitle className="text-sm uppercase tracking-wide">{payload.label ?? "Tabela"}</CardTitle>
          <Input
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="ml-auto h-7 w-40 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                {columns.map(c => (
                  <th
                    key={c.key}
                    className="px-2 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => {
                      if (sortKey === c.key) setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else { setSortKey(c.key); setSortDir("desc"); }
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr key={idx} className="border-b border-border/40 hover:bg-muted/30">
                  {columns.map(c => (
                    <td key={c.key} className={`px-2 py-1.5 ${c.type === "text" ? "" : "text-right font-mono tabular-nums"}`}>
                      {fmt(row[c.key], c.type)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 50 && (
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              Mostrando 50 de {rows.length} linhas. Refine a busca para ver mais.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
