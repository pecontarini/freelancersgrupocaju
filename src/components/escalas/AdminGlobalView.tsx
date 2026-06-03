import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { usePopDiario, type PopDiarioTurno, type PopDiarioRow } from "@/hooks/usePopDiario";
import { UnitCard } from "./UnitCard";

interface ConfigOption {
  id: string;
  nome: string;
  created_at: string;
}

interface AdminGlobalViewProps {
  allLojas: ConfigOption[];
  shiftType: string;
  today: string;
  onSelectUnit: (unitId: string) => void;
}

function shiftToTurno(shift: string): PopDiarioTurno | "TODOS" {
  const s = (shift || "").toUpperCase();
  if (s === "ALMOCO" || s === "ALMOÇO") return "ALMOCO";
  if (s === "JANTAR") return "JANTAR";
  return "TODOS";
}

export function AdminGlobalView({
  allLojas,
  shiftType,
  today,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSelectUnit,
}: AdminGlobalViewProps) {
  const turno = shiftToTurno(shiftType);
  const pop = usePopDiario({ date: today, turno });

  const rowsByUnit = useMemo(() => {
    const m = new Map<string, PopDiarioRow[]>();
    for (const r of pop.rows) {
      if (!m.has(r.unit_id)) m.set(r.unit_id, []);
      m.get(r.unit_id)!.push(r);
    }
    return m;
  }, [pop.rows]);

  if (allLojas.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma unidade cadastrada.
        </CardContent>
      </Card>
    );
  }

  if (pop.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">Quadro Operacional — Todas as Unidades</h3>
        <p className="text-sm text-muted-foreground">
          Clique em &quot;Ver detalhe por setor&quot; para abrir a tabela inline. Clique numa linha
          para ver a lista nominal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
        {[...allLojas]
          .map((loja) => {
            const agg = pop.byUnit[loja.id] ?? {
              pop_minimo: 0,
              escalados: 0,
              pop_chegou: 0,
              presentes: 0,
              faltantes: 0,
              extras_freelancer: 0,
              saldo_final: 0,
              setores_conforme: 0,
              setores_inconforme: 0,
              setores_aguardando: 0,
              setores_sem_pop: 0,
              conformidade_pct: 0,
            };
            const sectorRows = rowsByUnit.get(loja.id) ?? [];
            return { loja, agg, sectorRows };
          })
          .sort((a, b) => {
            // Inactive (no POP and no scale) go last
            const aInactive = a.agg.pop_minimo === 0 && a.sectorRows.length === 0;
            const bInactive = b.agg.pop_minimo === 0 && b.sectorRows.length === 0;
            if (aInactive !== bInactive) return aInactive ? 1 : -1;
            // Units with POP: lowest conformidade first
            if (a.agg.pop_minimo > 0 && b.agg.pop_minimo > 0) {
              return a.agg.conformidade_pct - b.agg.conformidade_pct;
            }
            // Units with POP before units without POP
            if ((a.agg.pop_minimo > 0) !== (b.agg.pop_minimo > 0)) {
              return a.agg.pop_minimo > 0 ? -1 : 1;
            }
            return a.loja.nome.localeCompare(b.loja.nome);
          })
          .map(({ loja, agg, sectorRows }) => (
            <UnitCard
              key={loja.id}
              unitId={loja.id}
              unitName={loja.nome}
              agg={agg}
              sectorRows={sectorRows}
            />
          ))}
      </div>
    </div>
  );
}
