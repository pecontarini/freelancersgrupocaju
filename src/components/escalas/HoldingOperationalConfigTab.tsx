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
import { Building2, MapPin, CalendarRange } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ALL_BRANDS, deriveBrand, type Brand } from "@/lib/holding/sectors";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { HoldingStaffingPanel } from "./holding/HoldingStaffingPanel";
import { HoldingForecastPanel } from "./holding/HoldingForecastPanel";
import { HoldingRatesPanel } from "./holding/HoldingRatesPanel";

interface UnitRow {
  id: string;
  nome: string;
}

function buildMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  // 6 meses passados, atual e 6 futuros
  for (let i = -6; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
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

  const monthOptions = useMemo(buildMonthOptions, []);
  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [brand, setBrand] = useState<Brand>("Caju Limão");
  const [unitId, setUnitId] = useState<string>("");
  const [monthYear, setMonthYear] = useState<string>(currentMonth);

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
              <Select value={monthYear} onValueChange={setMonthYear}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </div>
  );
}
