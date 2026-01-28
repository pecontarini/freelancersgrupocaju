import { Search, X, Calendar, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useConfigFuncoes, useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsMobile } from "@/hooks/use-mobile";

export interface FreelancerFiltersState {
  searchTerm: string;
  lojaId: string | null;
  funcoes: string[];
  dateStart: Date | null;
  dateEnd: Date | null;
}

interface FreelancerFiltersProps {
  filters: FreelancerFiltersState;
  onFiltersChange: (filters: FreelancerFiltersState) => void;
  selectedUnidadeId: string | null;
}

export function FreelancerFilters({
  filters,
  onFiltersChange,
  selectedUnidadeId,
}: FreelancerFiltersProps) {
  const { options: lojas } = useConfigLojas();
  const { options: funcoes } = useConfigFuncoes();
  const { isAdmin, isGerenteUnidade, unidades } = useUserProfile();
  const isMobile = useIsMobile();

  // Managers can only see their assigned stores
  const availableLojas = isAdmin 
    ? lojas 
    : lojas.filter(loja => unidades.some(u => u.id === loja.id));

  // Convert funcoes to MultiSelect options
  const funcaoOptions = funcoes.map((f) => ({ value: f.nome, label: f.nome }));

  const activeFiltersCount = [
    filters.searchTerm,
    filters.lojaId,
    filters.funcoes.length > 0,
    filters.dateStart,
    filters.dateEnd,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      searchTerm: "",
      lojaId: null,
      funcoes: [],
      dateStart: null,
      dateEnd: null,
    });
  };

  const handleLojaChange = (value: string) => {
    onFiltersChange({
      ...filters,
      lojaId: value === "all" ? null : value,
    });
  };

  const handleFuncoesChange = (selected: string[]) => {
    onFiltersChange({
      ...filters,
      funcoes: selected,
    });
  };

  // Handle date range selection
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    onFiltersChange({
      ...filters,
      dateStart: range?.from || null,
      dateEnd: range?.to || null,
    });
  };

  const dateRange: DateRange | undefined = 
    filters.dateStart || filters.dateEnd
      ? { from: filters.dateStart || undefined, to: filters.dateEnd || undefined }
      : undefined;

  const formatDateRange = () => {
    if (filters.dateStart && filters.dateEnd) {
      return `${format(filters.dateStart, "dd/MM/yy")} - ${format(filters.dateEnd, "dd/MM/yy")}`;
    }
    if (filters.dateStart) {
      return `${format(filters.dateStart, "dd/MM/yy")} - ...`;
    }
    if (filters.dateEnd) {
      return `... - ${format(filters.dateEnd, "dd/MM/yy")}`;
    }
    return "Selecionar Período";
  };

  // Get selected store name
  const selectedLojaName = filters.lojaId 
    ? lojas.find(l => l.id === filters.lojaId)?.nome || null
    : null;

  // Mobile filter content (reusable)
  const FilterContent = () => (
    <div className="space-y-4">
      {/* Store Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Unidade</label>
        <Select
          value={filters.lojaId || "all"}
          onValueChange={handleLojaChange}
          disabled={isGerenteUnidade && !isAdmin && unidades.length === 1}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Todas as Unidades" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {isAdmin && <SelectItem value="all">Todas as Unidades</SelectItem>}
            {availableLojas.map((loja) => (
              <SelectItem key={loja.id} value={loja.id}>
                {loja.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Function Multi-Select */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Funções {filters.funcoes.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {filters.funcoes.length}
            </Badge>
          )}
        </label>
        <MultiSelect
          options={funcaoOptions}
          selected={filters.funcoes}
          onChange={handleFuncoesChange}
          placeholder="Todas as Funções"
        />
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Período</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal bg-background",
                (filters.dateStart || filters.dateEnd) && "text-primary border-primary"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
            <div className="p-3 space-y-3">
              <div className="text-sm font-medium text-center text-muted-foreground">
                Selecione a Data Inicial e Final
              </div>
              <CalendarComponent
                mode="range"
                selected={dateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={1}
                locale={ptBR}
                className="pointer-events-auto"
              />
              <div className="flex justify-between gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      dateStart: startOfMonth(new Date()),
                      dateEnd: endOfMonth(new Date()),
                    })
                  }
                >
                  Mês Atual
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      dateStart: null,
                      dateEnd: null,
                    })
                  }
                >
                  Limpar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Clear All Button */}
      {activeFiltersCount > 0 && (
        <Button
          variant="outline"
          className="w-full"
          onClick={clearFilters}
        >
          <X className="h-4 w-4 mr-2" />
          Limpar Todos os Filtros ({activeFiltersCount})
        </Button>
      )}
    </div>
  );

  // Mobile: Compact layout with drawer for filters
  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Mobile Filter Bar */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={filters.searchTerm}
              onChange={(e) =>
                onFiltersChange({ ...filters, searchTerm: e.target.value })
              }
              className="pl-10 bg-background"
            />
          </div>

          {/* Filter Drawer Trigger */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline" className="gap-2 shrink-0">
                <Filter className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="px-4 pb-8">
              <DrawerHeader className="px-0">
                <DrawerTitle>Filtros de Busca</DrawerTitle>
              </DrawerHeader>
              <FilterContent />
            </DrawerContent>
          </Drawer>
        </div>

        {/* Active Filters Badges (Mobile) */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.searchTerm && (
              <Badge variant="secondary" className="gap-1 text-xs">
                "{filters.searchTerm}"
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, searchTerm: "" })}
                />
              </Badge>
            )}
            {selectedLojaName && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {selectedLojaName}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, lojaId: null })}
                />
              </Badge>
            )}
            {filters.funcoes.length > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs">
                Funções: {filters.funcoes.length}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, funcoes: [] })}
                />
              </Badge>
            )}
            {(filters.dateStart || filters.dateEnd) && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {formatDateRange()}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      dateStart: null,
                      dateEnd: null,
                    })
                  }
                />
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  // Desktop: Full inline filter bar
  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/50 p-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou fornecedor..."
            value={filters.searchTerm}
            onChange={(e) =>
              onFiltersChange({ ...filters, searchTerm: e.target.value })
            }
            className="pl-10 bg-background"
          />
        </div>

        {/* Store Filter (locked for managers with single store) */}
        <Select
          value={filters.lojaId || "all"}
          onValueChange={handleLojaChange}
          disabled={isGerenteUnidade && !isAdmin && unidades.length === 1}
        >
          <SelectTrigger className="w-[200px] bg-background">
            <SelectValue placeholder="Todas as Unidades" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {isAdmin && <SelectItem value="all">Todas as Unidades</SelectItem>}
            {availableLojas.map((loja) => (
              <SelectItem key={loja.id} value={loja.id}>
                {loja.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Function Multi-Select */}
        <div className="w-[200px]">
          <MultiSelect
            options={funcaoOptions}
            selected={filters.funcoes}
            onChange={handleFuncoesChange}
            placeholder="Todas as Funções"
          />
        </div>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[220px] justify-start text-left font-normal bg-background",
                (filters.dateStart || filters.dateEnd) && "text-primary border-primary"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
            <div className="p-3 space-y-3">
              <div className="text-sm font-medium text-center text-muted-foreground">
                Selecione a Data Inicial e Final
              </div>
              <CalendarComponent
                mode="range"
                selected={dateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                locale={ptBR}
                className="pointer-events-auto"
              />
              <div className="flex justify-between gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      dateStart: startOfMonth(new Date()),
                      dateEnd: endOfMonth(new Date()),
                    })
                  }
                >
                  Mês Atual
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      dateStart: null,
                      dateEnd: null,
                    })
                  }
                >
                  Limpar Datas
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear Filters Button */}
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Limpar ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Active Filters Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.searchTerm && (
            <Badge variant="secondary" className="gap-1">
              Busca: "{filters.searchTerm}"
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, searchTerm: "" })}
              />
            </Badge>
          )}
          {selectedLojaName && (
            <Badge variant="secondary" className="gap-1">
              Loja: {selectedLojaName}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, lojaId: null })}
              />
            </Badge>
          )}
          {filters.funcoes.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              Funções: {filters.funcoes.length}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, funcoes: [] })}
              />
            </Badge>
          )}
          {(filters.dateStart || filters.dateEnd) && (
            <Badge variant="secondary" className="gap-1">
              {formatDateRange()}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    dateStart: null,
                    dateEnd: null,
                  })
                }
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
