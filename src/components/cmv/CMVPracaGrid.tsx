import { useMemo, useCallback, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DIAS, type PracaEntry } from "@/hooks/useCMVSemanas";
import { cn } from "@/lib/utils";

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
  }) => void;
  readOnly?: boolean;
}

export function CMVPracaGrid({ semanaId, items, entries, onUpsert, readOnly }: Props) {
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const lookup = useMemo(() => {
    const m: Record<string, Record<string, PracaEntry>> = {};
    entries.forEach((e) => {
      if (!m[e.cmv_item_id]) m[e.cmv_item_id] = {};
      m[e.cmv_item_id][e.dia] = e;
    });
    return m;
  }, [entries]);

  const handleChange = useCallback(
    (itemId: string, dia: string, field: "t1_abertura" | "t2_almoco" | "t3_fechamento", value: string, unidade: string) => {
      const key = `${itemId}-${dia}-${field}`;
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);

      debounceTimers.current[key] = setTimeout(() => {
        const parsed = value === "" ? null : unidade === "UN" ? Math.round(Number(value.replace(",", "."))) : Number(value.replace(",", "."));
        if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;

        onUpsert({
          semana_id: semanaId,
          cmv_item_id: itemId,
          dia,
          [field]: parsed,
        });
      }, 800);
    },
    [onUpsert, semanaId]
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Produto</TableHead>
            {DIAS.map((dia) => (
              <TableHead key={dia} colSpan={4} className="text-center border-l">
                {dia}
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10" />
            {DIAS.map((dia) => (
              <>
                <TableHead key={`${dia}-t1`} className="text-center text-xs border-l min-w-[55px]">T1</TableHead>
                <TableHead key={`${dia}-t2`} className="text-center text-xs min-w-[55px]">T2</TableHead>
                <TableHead key={`${dia}-t3`} className="text-center text-xs min-w-[55px]">T3</TableHead>
                <TableHead key={`${dia}-v`} className="text-center text-xs min-w-[50px]">VAR</TableHead>
              </>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="sticky left-0 bg-background z-10 font-medium text-xs">
                {item.nome}
                <span className="text-muted-foreground ml-1">({item.unidade})</span>
              </TableCell>
              {DIAS.map((dia) => {
                const entry = lookup[item.id]?.[dia];
                const t1 = entry?.t1_abertura;
                const t2 = entry?.t2_almoco;
                const t3 = entry?.t3_fechamento;
                const varDia = t1 != null && t3 != null ? t1 - t3 : null;
                const varNeg = varDia != null && varDia < 0;

                return (
                  <>
                    <TableCell key={`${dia}-t1`} className="p-1 border-l">
                      <Input
                        type="number"
                        min={0}
                        step={item.unidade === "KG" ? "0.01" : "1"}
                        defaultValue={t1 ?? ""}
                        onChange={(e) => handleChange(item.id, dia, "t1_abertura", e.target.value, item.unidade)}
                        disabled={readOnly}
                        className="h-8 w-14 text-center text-xs p-1"
                      />
                    </TableCell>
                    <TableCell key={`${dia}-t2`} className="p-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Input
                            type="number"
                            min={0}
                            step={item.unidade === "KG" ? "0.01" : "1"}
                            defaultValue={t2 ?? ""}
                            onChange={(e) => handleChange(item.id, dia, "t2_almoco", e.target.value, item.unidade)}
                            disabled={readOnly}
                            className="h-8 w-14 text-center text-xs p-1"
                          />
                        </TooltipTrigger>
                        {t1 != null && (
                          <TooltipContent>Ref T1: {t1}</TooltipContent>
                        )}
                      </Tooltip>
                    </TableCell>
                    <TableCell key={`${dia}-t3`} className="p-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Input
                            type="number"
                            min={0}
                            step={item.unidade === "KG" ? "0.01" : "1"}
                            defaultValue={t3 ?? ""}
                            onChange={(e) => handleChange(item.id, dia, "t3_fechamento", e.target.value, item.unidade)}
                            disabled={readOnly}
                            className="h-8 w-14 text-center text-xs p-1"
                          />
                        </TooltipTrigger>
                        {t2 != null && (
                          <TooltipContent>Ref T2: {t2}</TooltipContent>
                        )}
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      key={`${dia}-v`}
                      className={cn(
                        "text-center text-xs font-semibold p-1",
                        varNeg && "text-destructive bg-destructive/10"
                      )}
                    >
                      {varDia != null ? (
                        <span className="flex items-center justify-center gap-1">
                          {varDia.toFixed(item.unidade === "KG" ? 2 : 0)}
                          {varNeg && <AlertTriangle className="h-3 w-3" />}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
