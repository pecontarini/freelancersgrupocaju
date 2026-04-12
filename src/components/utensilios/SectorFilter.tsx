import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const SETORES_UTENSILIOS = ["Todos", "Cozinha", "Bar", "Salão", "Parrilla", "Sushi"] as const;
export type SetorUtensilio = typeof SETORES_UTENSILIOS[number];

interface SectorFilterProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function SectorFilter({ value, onChange, className }: SectorFilterProps) {
  return (
    <div className={className}>
      <Label>Setor</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Filtrar por setor" /></SelectTrigger>
        <SelectContent>
          {SETORES_UTENSILIOS.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
