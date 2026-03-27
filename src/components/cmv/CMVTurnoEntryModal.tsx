import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Check } from "lucide-react";
import { DIAS, type DiaSemana, type PracaEntry } from "@/hooks/useCMVSemanas";
import { toast } from "sonner";

type CMVItem = { id: string; nome: string; unidade: string };

interface Props {
  semanaId: string;
  items: CMVItem[];
  entries: PracaEntry[];
  onUpsert: (params: {
    semana_id: string;
    cmv_item_id: string;
    dia: string;
    t1_abertura?: number | null;
    t2_almoco?: number | null;
    t3_fechamento?: number | null;
    turno_encerrado_em?: string | null;
  }) => void;
  dataInicio: string;
}

const TURNO_LABELS: Record<string, string> = {
  t1_abertura: "T1 — Abertura",
  t2_almoco: "T2 — Almoço",
  t3_fechamento: "T3 — Fechamento",
};

const TURNO_REF: Record<string, string> = {
  t2_almoco: "t1_abertura",
  t3_fechamento: "t2_almoco",
};

function getTodayDia(dataInicio: string): DiaSemana {
  const start = new Date(dataInicio + "T00:00:00");
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
  if (diffDays >= 0 && diffDays < 7) return DIAS[diffDays];
  return DIAS[0];
}

export function CMVTurnoEntryModal({ semanaId, items, entries, onUpsert, dataInicio }: Props) {
  const [open, setOpen] = useState(false);
  const [dia, setDia] = useState<DiaSemana>(() => getTodayDia(dataInicio));
  const [turno, setTurno] = useState<string>("t1_abertura");
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const firstEmptyRef = useRef<HTMLInputElement | null>(null);

  const lookup = useMemo(() => {
    const m: Record<string, PracaEntry> = {};
    entries.filter((e) => e.dia === dia).forEach((e) => {
      m[e.cmv_item_id] = e;
    });
    return m;
  }, [entries, dia]);

  // Reset local values when dia/turno change
  useEffect(() => {
    const vals: Record<string, string> = {};
    items.forEach((item) => {
      const entry = lookup[item.id];
      const val = entry?.[turno as keyof PracaEntry];
      vals[item.id] = val != null ? String(val) : "";
    });
    setLocalValues(vals);
  }, [dia, turno, lookup, items]);

  // Focus first empty
  useEffect(() => {
    if (open) {
      setTimeout(() => firstEmptyRef.current?.focus(), 200);
    }
  }, [open, dia, turno]);

  const filledCount = useMemo(
    () => items.filter((item) => {
      const v = localValues[item.id];
      return v !== "" && v != null;
    }).length,
    [items, localValues]
  );

  const handleChange = useCallback(
    (itemId: string, value: string, unidade: string) => {
      setLocalValues((prev) => ({ ...prev, [itemId]: value }));

      const key = `${itemId}-${dia}-${turno}`;
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);

      debounceTimers.current[key] = setTimeout(() => {
        const parsed = value === "" ? null : unidade === "UN" ? Math.round(Number(value.replace(",", "."))) : Number(value.replace(",", "."));
        if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;

        onUpsert({
          semana_id: semanaId,
          cmv_item_id: itemId,
          dia,
          [turno]: parsed,
        });
      }, 800);
    },
    [dia, turno, semanaId, onUpsert]
  );

  const handleFinalizarTurno = () => {
    // Set turno_encerrado_em for all items on this dia
    items.forEach((item) => {
      onUpsert({
        semana_id: semanaId,
        cmv_item_id: item.id,
        dia,
        turno_encerrado_em: new Date().toISOString(),
      });
    });
    toast.success(`${TURNO_LABELS[turno]} finalizado para ${dia}`);
    setOpen(false);
  };

  let firstEmptySet = false;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Entrada Rápida por Turno
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Contagem por Turno — Praça</SheetTitle>
        </SheetHeader>

        {/* Selectors */}
        <div className="flex gap-3 py-3">
          <Select value={dia} onValueChange={(v) => setDia(v as DiaSemana)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIAS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={turno} onValueChange={setTurno}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="t1_abertura">T1 — Abertura</SelectItem>
              <SelectItem value="t2_almoco">T2 — Almoço</SelectItem>
              <SelectItem value="t3_fechamento">T3 — Fechamento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 pb-2">
          <Progress value={(filledCount / items.length) * 100} className="flex-1" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {filledCount} / {items.length}
          </span>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto space-y-2 pb-4">
          {items.map((item) => {
            const entry = lookup[item.id];
            const refField = TURNO_REF[turno];
            const refValue = refField && entry ? (entry as any)[refField] : null;
            const isEmpty = localValues[item.id] === "" || localValues[item.id] == null;
            const shouldRef = !firstEmptySet && isEmpty;
            if (shouldRef) firstEmptySet = true;

            return (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.nome}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{item.unidade}</span>
                    {refValue != null && (
                      <Badge variant="secondary" className="text-xs">
                        Ref: {refValue}
                      </Badge>
                    )}
                  </div>
                </div>
                <Input
                  ref={shouldRef ? firstEmptyRef : undefined}
                  type="number"
                  min={0}
                  step={item.unidade === "KG" ? "0.01" : "1"}
                  value={localValues[item.id] ?? ""}
                  onChange={(e) => handleChange(item.id, e.target.value, item.unidade)}
                  className="w-24 h-11 text-center text-lg font-semibold"
                  placeholder="—"
                />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t">
          <Button
            onClick={handleFinalizarTurno}
            className="w-full gap-2"
            disabled={filledCount === 0}
          >
            <Check className="h-4 w-4" />
            Finalizar {TURNO_LABELS[turno]}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
