import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table2 } from "lucide-react";
import type { SheetBlock } from "@/hooks/useSheetBlocks";

export function ItemTableBlock({ block }: { block: SheetBlock }) {
  const payload = block.payload as {
    label?: string;
    canais?: string[];
    items?: Array<{ loja_codigo: string; valores: Record<string, number | null> }>;
    empty?: boolean;
  };
  const canais = payload.canais ?? [];
  const items = payload.items ?? [];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-emerald-500" />
          <CardTitle className="text-sm uppercase tracking-wide">{payload.label ?? "Tabela"}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {payload.empty || !items.length ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Aguardando primeiros dados desta planilha. Quando popular as linhas, esta tabela aparece automaticamente no próximo sync.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Loja</th>
                  {canais.map((c) => (
                    <th key={c} className="px-2 py-2 font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.loja_codigo} className="border-b border-border/40">
                    <td className="p-2 font-medium">{it.loja_codigo}</td>
                    {canais.map((c) => (
                      <td key={c} className="px-2 py-1 text-center font-mono tabular-nums">
                        {it.valores[c] ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
