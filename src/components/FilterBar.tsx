import { CalendarIcon, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

import { FilterState } from "@/types/freelancer";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  uniqueSetores: string[];
  uniqueGerencias: string[];
  uniqueLojas: string[];
}

export function FilterBar({
  filters,
  onFiltersChange,
  uniqueSetores,
  uniqueGerencias,
  uniqueLojas,
}: FilterBarProps) {
  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      dateFrom: undefined,
      dateTo: undefined,
      setor: "",
      gerencia: "",
      nome: "",
      loja: "",
    });
  };

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.setor ||
    filters.gerencia ||
    filters.nome ||
    filters.loja;

  return (
    <Card className="glass-card">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-3 w-3" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Date From */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Data Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal input-focus-ring h-9",
                    !filters.dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {filters.dateFrom ? (
                    format(filters.dateFrom, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span className="text-xs">Selecionar</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => updateFilter("dateFrom", date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Data Fim</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal input-focus-ring h-9",
                    !filters.dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {filters.dateTo ? (
                    format(filters.dateTo, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span className="text-xs">Selecionar</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => updateFilter("dateTo", date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Loja */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Loja</Label>
            <Select
              value={filters.loja}
              onValueChange={(val) => updateFilter("loja", val)}
            >
              <SelectTrigger className="input-focus-ring h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {uniqueLojas.map((loja) => (
                  <SelectItem key={loja} value={loja}>
                    {loja}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Setor */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Setor</Label>
            <Select
              value={filters.setor}
              onValueChange={(val) => updateFilter("setor", val)}
            >
              <SelectTrigger className="input-focus-ring h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueSetores.map((setor) => (
                  <SelectItem key={setor} value={setor}>
                    {setor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gerência */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Gerência</Label>
            <Select
              value={filters.gerencia}
              onValueChange={(val) => updateFilter("gerencia", val)}
            >
              <SelectTrigger className="input-focus-ring h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {uniqueGerencias.map((gerencia) => (
                  <SelectItem key={gerencia} value={gerencia}>
                    {gerencia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              placeholder="Buscar por nome..."
              value={filters.nome}
              onChange={(e) => updateFilter("nome", e.target.value)}
              className="input-focus-ring h-9"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
