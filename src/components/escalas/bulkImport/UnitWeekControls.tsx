import { useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAccessibleStores } from "@/hooks/useAccessibleStores";
import { formatWeekRange, normalizeToMonday } from "./lib/weekUtils";

interface Props {
  unitId: string | null;
  onUnitChange: (id: string | null) => void;
  weekStart: Date | null;
  onWeekChange: (monday: Date | null) => void;
  showUnitSelector: boolean;
}

export function UnitWeekControls({
  unitId,
  onUnitChange,
  weekStart,
  onWeekChange,
  showUnitSelector,
}: Props) {
  const { stores, isLoading } = useAccessibleStores();

  // Auto-select single store
  useEffect(() => {
    if (!showUnitSelector) return;
    if (!unitId && stores.length === 1) {
      onUnitChange(stores[0].id);
    }
  }, [showUnitSelector, stores, unitId, onUnitChange]);

  const singleStore = stores.length === 1;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showUnitSelector && (
        <div className="space-y-2">
          <Label htmlFor="bulk-import-unit">Unidade</Label>
          <Select
            value={unitId ?? ""}
            onValueChange={(v) => onUnitChange(v || null)}
            disabled={isLoading || singleStore}
          >
            <SelectTrigger id="bulk-import-unit" aria-label="Selecionar unidade">
              <SelectValue placeholder="Selecione uma unidade" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="bulk-import-week">Semana de Referência</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="bulk-import-week"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !weekStart && "text-muted-foreground",
              )}
              aria-label="Selecionar semana"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {weekStart ? format(weekStart, "dd/MM/yyyy") : "Escolha uma data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={weekStart ?? undefined}
              onSelect={(d) => onWeekChange(d ? normalizeToMonday(d) : null)}
              weekStartsOn={1}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {weekStart && (
          <p className="text-xs text-muted-foreground">{formatWeekRange(weekStart)}</p>
        )}
      </div>
    </div>
  );
}
