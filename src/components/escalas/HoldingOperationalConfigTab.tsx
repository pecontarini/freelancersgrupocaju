import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, MapPin, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ALL_BRANDS, deriveBrand, type Brand } from "@/lib/holding/sectors";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { HoldingStaffingPanel } from "./holding/HoldingStaffingPanel";
import { HoldingForecastPanel } from "./holding/HoldingForecastPanel";
import { HoldingRatesPanel } from "./holding/HoldingRatesPanel";
import { POPWizardButton } from "./holding/POPWizardButton";
import { POPWizardDrawer } from "./holding/POPWizardDrawer";

interface UnitRow {
  id: string;
  nome: string;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatMonthYearLabel(value: string): string {
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return value;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

interface MonthYearPickerProps {
  value: string; // "YYYY-MM"
  onChange: (v: string) => void;
}

function MonthYearPicker({ value, onChange }: MonthYearPickerProps) {
  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = now.getMonth() + 1; // 1-12

  const [selY, selM] = value.split("-").map(Number);
  const [viewYear, setViewYear] = useState<number>(selY || currentY);
  const [open, setOpen] = useState(false);

  const isMonthDisabled = (year: number, monthIdx0: number) => {
    if (year < currentY) return true;
    if (year === currentY && monthIdx0 + 1 < currentM) return true;
    return false;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarRange className="mr-2 h-4 w-4 opacity-70" />
          {value ? formatMonthYearLabel(value) : "Selecione o mês"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 pointer-events-auto" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear((y) => Math.max(currentY, y - 1))}
            disabled={viewYear <= currentY}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{viewYear}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_NAMES.map((name, idx) => {
            const disabled = isMonthDisabled(viewYear, idx);
            const isSelected = selY === viewYear && selM === idx + 1;
            return (
              <Button
                key={name}
                type="button"
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                disabled={disabled}
                className="h-9 text-xs"
                onClick={() => {
                  const v = `${viewYear}-${String(idx + 1).padStart(2, "0")}`;
                  onChange(v);
                  setOpen(false);
                }}
              >
                {name.slice(0, 3)}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Página "Configuração Operacional — Holding"
 * Substitui a antiga aba "Escalas Mínimas".
 *
 * Filtro global em cascata: Marca → Unidade → Mês de referência.
 * Todos os 3 paineis abaixo reagem ao filtro.
 */
export function HoldingOperationalConfigTab() {
  const { isAdmin } = useUserProfile();

  
  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [brand, setBrand] = useState<Brand>("Caju Limão");
  const [unitId, setUnitId] = useState<string>("");
  const [monthYear, setMonthYear] = useState<string>(currentMonth);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: lojas, isLoading: loadingUnits } = useQuery({
    queryKey: ["holding-config-units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_lojas")
        .select("id, nome")
        .order("nome", { ascending: true })
        .range(0, 199);
      if (error) throw error;
      return (data ?? []) as UnitRow[];
    },
    enabled: isAdmin,
  });

  // Unidades filtradas pela marca selecionada
  const filteredUnits = useMemo(() => {
    return (lojas ?? []).filter((u) => deriveBrand(u.nome) === brand);
  }, [lojas, brand]);

  // Reset unitId quando a marca muda e a unidade selecionada não pertence
  const selectedUnitBelongs = filteredUnits.some((u) => u.id === unitId);
  if (unitId && !selectedUnitBelongs) {
    // safe: só atualiza estado uma vez
    setTimeout(() => setUnitId(""), 0);
  }

  if (!isAdmin) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Apenas administradores podem acessar a Configuração Operacional da Holding.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtro global em cascata */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-primary" />
            Configuração Operacional — Holding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" /> Marca
              </Label>
              <Select value={brand} onValueChange={(v) => setBrand(v as Brand)}>
                <SelectTrigger className="h-10 uppercase tracking-wide">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_BRANDS.map((b) => (
                    <SelectItem key={b} value={b} className="uppercase tracking-wide">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5" /> Unidade
              </Label>
              {loadingUnits ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger className="h-10">
                    <SelectValue
                      placeholder={
                        filteredUnits.length === 0
                          ? "Nenhuma unidade nessa marca"
                          : "Selecione a unidade"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <CalendarRange className="h-3.5 w-3.5" /> Mês de Referência
              </Label>
              <MonthYearPicker value={monthYear} onChange={setMonthYear} />
            </div>
          </div>
        </CardContent>
      </Card>

      {!unitId ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Selecione uma <strong>marca</strong> e uma <strong>unidade</strong> para
            visualizar as configurações.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="staffing" className="space-y-3">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="staffing">Mínimo de Pessoas</TabsTrigger>
            <TabsTrigger value="forecast">Previsão de Freelancers</TabsTrigger>
            <TabsTrigger value="rates">Diárias e Budget</TabsTrigger>
          </TabsList>

          <TabsContent value="staffing">
            <HoldingStaffingPanel
              brand={brand}
              unitId={unitId}
              monthYear={monthYear}
            />
          </TabsContent>
          <TabsContent value="forecast">
            <HoldingForecastPanel
              brand={brand}
              unitId={unitId}
              monthYear={monthYear}
            />
          </TabsContent>
          <TabsContent value="rates">
            <HoldingRatesPanel
              brand={brand}
              unitId={unitId}
              monthYear={monthYear}
            />
          </TabsContent>
        </Tabs>
      )}

      {unitId && (
        <>
          <div className="flex justify-end pt-2">
            <POPWizardButton onClick={() => setWizardOpen(true)} />
          </div>
          <POPWizardDrawer
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            brand={brand}
            unitId={unitId}
            unitName={filteredUnits.find((u) => u.id === unitId)?.nome}
            monthYear={monthYear}
          />
        </>
      )}
    </div>
  );
}
