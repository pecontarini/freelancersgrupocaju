import { IndicadorDashboardShell } from "../IndicadorDashboardShell";
import type { KdsData, KdsLoja } from "@/lib/indicadores-parsers";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

function pctNorm(p: number) {
  return p < 1 ? p * 100 : p;
}
function pctColor(p: number) {
  const n = pctNorm(p);
  if (n < 5) return "bg-emerald-500";
  if (n < 10) return "bg-amber-500";
  return "bg-red-500";
}

function LojaItem({ loja }: { loja: KdsLoja }) {
  const tg = loja.totalGeral;
  return (
    <AccordionItem value={loja.loja} className="border rounded-xl bg-white/60 backdrop-blur-md mb-2">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center justify-between w-full pr-3 gap-3">
          <span className="font-semibold truncate">{loja.loja}</span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">{tg.qtnTarget}/{tg.totalPratos}</span>
            <span className={cn("text-sm font-mono tabular-nums font-bold w-14 text-right",
              pctNorm(tg.pct) < 5 ? "text-emerald-600" : pctNorm(tg.pct) < 10 ? "text-amber-600" : "text-red-600")}>
              {pctNorm(tg.pct).toFixed(1)}%
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-3">
        <div className="space-y-2">
          {loja.categorias.map((c) => {
            const pct = pctNorm(c.pct);
            return (
              <div key={c.categoria} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{c.categoria}</span>
                  <span className="tabular-nums font-mono">{c.qtnTarget}/{c.totalPratos} • {pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full", pctColor(c.pct))} style={{ width: `${Math.min(pct * 4, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function KdsTargetPretoDashboard() {
  return (
    <IndicadorDashboardShell<KdsData>
      metaKey="kds-target-preto"
      subtitle="% de pratos em target preto por loja e categoria"
      render={(d) => (
        <div className="space-y-3">
          {d.dataAtualizacao && (
            <div className="text-xs text-muted-foreground">
              Última atualização: <strong>{d.dataAtualizacao}</strong>
            </div>
          )}
          <Accordion type="multiple" className="space-y-2">
            {d.lojas.map((l) => <LojaItem key={l.loja} loja={l} />)}
          </Accordion>
        </div>
      )}
    />
  );
}
