import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  FileText,
  Filter,
  X,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useReclamacoes, type Reclamacao } from "@/hooks/useReclamacoes";
import { useActionPlans, type ActionPlan } from "@/hooks/useActionPlans";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { UnitSummaryGrid } from "./UnitSummaryGrid";
import { PendingValidationsList } from "./PendingValidationsList";
import { CXHistoryArchive } from "./CXHistoryArchive";
import { CXPerformancePDF } from "./CXPerformancePDF";
import { DoresOperacaoPareto } from "@/components/complaints/DoresOperacaoPareto";
import { LeaderDiagnosticCard } from "@/components/complaints/LeaderDiagnosticCard";

// Brand grouping based on store name patterns
const BRAND_GROUPS = [
  { brand: "CAJU LIMÃO", pattern: /caju/i, color: "bg-amber-100 text-amber-700" },
  { brand: "CAMINITO PARRILLA", pattern: /caminito|mult/i, color: "bg-red-100 text-red-700" },
  { brand: "NAZO JAPANESE", pattern: /nazo|nfe/i, color: "bg-purple-100 text-purple-700" },
  { brand: "FOSTERS BURGUER", pattern: /foster|fb/i, color: "bg-blue-100 text-blue-700" },
];

function detectBrand(storeName: string): { brand: string; color: string } {
  for (const group of BRAND_GROUPS) {
    if (group.pattern.test(storeName)) {
      return { brand: group.brand, color: group.color };
    }
  }
  return { brand: "Outras", color: "bg-muted text-muted-foreground" };
}

export function AdminCXDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useUserProfile();
  const isMobile = useIsMobile();

  const initialLojaId = searchParams.get("loja") || null;
  const initialTab = searchParams.get("tab") || (isMobile ? "pendencias" : "rede");

  const [selectedLojaId, setSelectedLojaId] = useState<string | null>(initialLojaId);
  const [activeTab, setActiveTab] = useState(initialTab);

  const currentMonth = format(new Date(), "yyyy-MM");
  const { options: lojas, isLoading: isLoadingLojas } = useConfigLojas();
  const { reclamacoes, isLoading: isLoadingReclamacoes } = useReclamacoes(
    selectedLojaId || undefined,
    currentMonth
  );
  const { actionPlans, updateActionPlan, isLoading: isLoadingPlans } = useActionPlans(
    selectedLojaId,
    currentMonth
  );

  // Group stores by brand
  const groupedStores = useMemo(() => {
    const groups: Record<string, typeof lojas> = {};
    const ungrouped: typeof lojas = [];

    for (const loja of lojas) {
      const { brand } = detectBrand(loja.nome);
      if (brand !== "Outras") {
        if (!groups[brand]) {
          groups[brand] = [];
        }
        groups[brand].push(loja);
      } else {
        ungrouped.push(loja);
      }
    }

    return { groups, ungrouped };
  }, [lojas]);

  // Get selected store name
  const selectedLoja = lojas.find((l) => l.id === selectedLojaId);

  // Sync to URL
  const handleLojaChange = (lojaId: string | null) => {
    setSelectedLojaId(lojaId);
    const params = new URLSearchParams(searchParams);
    if (lojaId) {
      params.set("loja", lojaId);
    } else {
      params.delete("loja");
    }
    setSearchParams(params, { replace: true });
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    setSearchParams(params, { replace: true });
  };

  // Calculate stats across all or selected stores
  const stats = useMemo(() => {
    const pending = actionPlans.filter((ap) => ap.status === "pending").length;
    const inAnalysis = actionPlans.filter((ap) => ap.status === "in_analysis").length;
    const resolved = actionPlans.filter((ap) => ap.status === "resolved").length;
    const late = actionPlans.filter(
      (ap) => ap.status === "pending" && new Date(ap.deadline_at) < new Date()
    ).length;
    const graves = reclamacoes.filter((r) => r.is_grave).length;

    return { pending, inAnalysis, resolved, late, graves, total: reclamacoes.length };
  }, [actionPlans, reclamacoes]);

  const hasActiveFilters = selectedLojaId !== null;

  const clearFilters = () => {
    handleLojaChange(null);
  };

  // Only allow admin access
  if (!isAdmin) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Acesso Restrito</h3>
          <p className="text-muted-foreground">
            Esta visualização está disponível apenas para administradores.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isLoading = isLoadingLojas || isLoadingReclamacoes || isLoadingPlans;

  return (
    <div className="space-y-4">
      {/* Header with Unit Selector */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg uppercase">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Central de CX - Gestão de Reclamações
              </CardTitle>
              <CardDescription>
                {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })} • Análise consolidada
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Unit Selector */}
              <Select
                value={selectedLojaId || "all"}
                onValueChange={(value) => handleLojaChange(value === "all" ? null : value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-[260px] bg-background">
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">
                    <span className="font-medium">Todas as Unidades</span>
                  </SelectItem>

                  {Object.entries(groupedStores.groups).map(([brand, stores]) => (
                    <SelectGroup key={brand}>
                      <SelectLabel className="uppercase text-xs font-bold text-muted-foreground">
                        {brand}
                      </SelectLabel>
                      {stores.map((loja) => (
                        <SelectItem key={loja.id} value={loja.id}>
                          {loja.nome}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}

                  {groupedStores.ungrouped.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="uppercase text-xs font-bold text-muted-foreground">
                        Outras
                      </SelectLabel>
                      {groupedStores.ungrouped.map((loja) => (
                        <SelectItem key={loja.id} value={loja.id}>
                          {loja.nome}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}

              {/* PDF Export */}
              <CXPerformancePDF
                lojaId={selectedLojaId}
                lojaNome={selectedLoja?.nome || "Todas as Unidades"}
                reclamacoes={reclamacoes}
                actionPlans={actionPlans}
              />
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Queixas</p>
            </div>
            <div className="rounded-lg bg-destructive/10 p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{stats.graves}</p>
              <p className="text-xs text-muted-foreground">Graves</p>
            </div>
            <div className="rounded-lg bg-destructive/10 p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.inAnalysis}</p>
              <p className="text-xs text-muted-foreground">Aguardando</p>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolvidos</p>
            </div>
          </div>

          {/* Late Alert */}
          {stats.late > 0 && (
            <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <Clock className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive font-medium">
                {stats.late} plano{stats.late > 1 ? "s" : ""} de ação atrasado{stats.late > 1 ? "s" : ""} (&gt;24h sem resposta)
              </span>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid w-full ${isMobile ? "grid-cols-3" : "grid-cols-3"} mb-4`}>
          <TabsTrigger value={isMobile ? "pendencias" : "rede"} className="text-xs sm:text-sm">
            {isMobile ? (
              <>
                <Clock className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Pendências de Aprovação</span>
                <span className="sm:hidden">Pendências</span>
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 mr-1.5 hidden sm:inline" />
                Visão Geral da Rede
              </>
            )}
          </TabsTrigger>
          <TabsTrigger value={isMobile ? "rede" : "pendencias"} className="text-xs sm:text-sm">
            {isMobile ? (
              <>
                <Building2 className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Visão Geral da Rede</span>
                <span className="sm:hidden">Rede</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5 hidden sm:inline" />
                Pendências de Aprovação
                {stats.inAnalysis > 0 && (
                  <Badge variant="destructive" className="ml-2 text-xs">
                    {stats.inAnalysis}
                  </Badge>
                )}
              </>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs sm:text-sm">
            <FileText className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Arquivo Histórico</span>
            <span className="sm:hidden">Histórico</span>
          </TabsTrigger>
        </TabsList>

        {/* Network Overview Tab */}
        <TabsContent value="rede" className="space-y-4">
          {selectedLojaId ? (
            // Drill-down view for specific unit
            <div className="space-y-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base uppercase flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    {selectedLoja?.nome || "Unidade"}
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* Pareto Chart for this unit */}
              <DoresOperacaoPareto reclamacoes={reclamacoes} lojaId={selectedLojaId} />

              {/* Diagnostic Card with Action Plans */}
              <LeaderDiagnosticCard
                reclamacoes={reclamacoes}
                lojaId={selectedLojaId}
                lojaNome={selectedLoja?.nome}
              />
            </div>
          ) : (
            // Grid of all units
            <UnitSummaryGrid
              lojas={lojas}
              onSelectLoja={handleLojaChange}
              currentMonth={currentMonth}
            />
          )}
        </TabsContent>

        {/* Pending Validations Tab */}
        <TabsContent value="pendencias" className="space-y-4">
          <PendingValidationsList
            actionPlans={actionPlans.filter((ap) => ap.status === "in_analysis")}
            allActionPlans={actionPlans}
            lojas={lojas}
            onUpdate={async (input) => {
              await updateActionPlan.mutateAsync(input);
            }}
          />
        </TabsContent>

        {/* Historical Archive Tab */}
        <TabsContent value="historico" className="space-y-4">
          <CXHistoryArchive
            reclamacoes={reclamacoes}
            actionPlans={actionPlans.filter((ap) => ap.status === "resolved")}
            lojas={lojas}
            selectedLojaId={selectedLojaId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
