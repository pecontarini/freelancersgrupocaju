import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";
import {
  filterPracas,
  usePracasByUnit,
  type DiaSemanaPraca,
  type TurnoPraca,
} from "@/hooks/usePracas";

interface PracaSelectorProps {
  unitId: string | null;
  sectorName: string | null | undefined;
  turno: TurnoPraca;
  dia: DiaSemanaPraca;
  value: string | null;
  onChange: (pracaId: string | null) => void;
}

const NONE_VALUE = "__none__";

export function PracaSelector({
  unitId,
  sectorName,
  turno,
  dia,
  value,
  onChange,
}: PracaSelectorProps) {
  const { data: pracas = [], isLoading } = usePracasByUnit(unitId);

  const options = useMemo(
    () => filterPracas(pracas, sectorName, turno, dia),
    [pracas, sectorName, turno, dia],
  );

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        Praça do plano de chão
      </Label>
      <Select
        value={value ?? NONE_VALUE}
        onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecionar praça" />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          <SelectItem value={NONE_VALUE}>
            <span className="text-muted-foreground">Sem praça</span>
          </SelectItem>
          {options.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nome_praca}{" "}
              <span className="text-muted-foreground text-xs">
                · alvo {p.qtd_necessaria}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isLoading && options.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nenhuma praça cadastrada para este setor neste turno/dia.
        </p>
      )}
    </div>
  );
}
