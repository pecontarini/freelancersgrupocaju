import { useState, useMemo, useRef } from "react";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  Store,
  Filter,
  X,
  Camera,
  Loader2,
  RefreshCw,
  FileText,
  Calendar,
  ChevronRight,
  History,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { useSupervisionAudits, SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Brand detection based on store name prefixes
const BRAND_PREFIXES: Record<string, string> = {
  "MULT": "Caminito",
  "NFE": "Nazo",
  "FB": "FOSTERS BURGUER",
  "FOSTER": "FOSTERS BURGUER",
  "CAJU": "Caju",
};

function detectBrand(storeName: string): string {
  for (const [prefix, brand] of Object.entries(BRAND_PREFIXES)) {
    if (storeName.toUpperCase().startsWith(prefix)) {
      return brand;
    }
  }
  return "Outras";
}

interface ActionPlanTabProps {
  selectedUnidadeId?: string | null;
}

export function ActionPlanTab({ selectedUnidadeId }: ActionPlanTabProps) {
  const { toast } = useToast();
  const { options: lojas } = useConfigLojas();
  const { isAdmin, unidades, isGerenteUnidade } = useUserProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [selectedLojaId, setSelectedLojaId] = useState<string | null>(selectedUnidadeId || null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("pending");
  const [showOnlyRecurring, setShowOnlyRecurring] = useState(false);

  // Modal states
  const [selectedFailure, setSelectedFailure] = useState<SupervisionFailure | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [justification, setJustification] = useState("");
  const [solution, setSolution] = useState("");
  const [expandedHistories, setExpandedHistories] = useState<Set<string>>(new Set());

  // Fetch supervision data
  const {
    failures,
    audits,
    pendingFailures,
    awaitingValidation,
    isLoadingFailures,
    resolveFailure,
    validateFailure,
    isRecurring,
  } = useSupervisionAudits(selectedLojaId);

  // Auto-select single store for managers
  const effectiveLojaId = useMemo(() => {
    if (selectedLojaId) return selectedLojaId;
    if (isGerenteUnidade && unidades.length === 1) return unidades[0].id;
    return null;
  }, [selectedLojaId, isGerenteUnidade, unidades]);

  // Calculate recurrence info with 60-day window
  const recurrenceMap = useMemo(() => {
    const sixtyDaysAgo = subDays(new Date(), 60);
    const recentFailures = failures.filter(
      (f) => new Date(f.created_at) >= sixtyDaysAgo
    );

    const map: Record<string, SupervisionFailure[]> = {};
    
    recentFailures.forEach((failure) => {
      // Normalize item name for better matching (trim, lowercase)
      const normalizedItemName = failure.item_name.trim().toLowerCase();
      const itemKey = `${failure.loja_id}-item-${normalizedItemName}`;
      if (!map[itemKey]) map[itemKey] = [];
      map[itemKey].push(failure);
    });

    return map;
  }, [failures]);

  const isRecurringEnhanced = (failure: SupervisionFailure): boolean => {
    const normalizedItemName = failure.item_name.trim().toLowerCase();
    const itemKey = `${failure.loja_id}-item-${normalizedItemName}`;
    return (recurrenceMap[itemKey]?.length || 0) > 1;
  };

  const getRecurrenceInfo = (failure: SupervisionFailure) => {
    const normalizedItemName = failure.item_name.trim().toLowerCase();
    const itemKey = `${failure.loja_id}-item-${normalizedItemName}`;
    const history = recurrenceMap[itemKey] || [];
    return {
      count: history.length,
      history: history.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    };
  };

  // Filter failures based on current month
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  const currentMonthAuditIds = useMemo(() => {
    return audits
      .filter((a) => {
        const auditDate = new Date(a.audit_date);
        return auditDate >= currentMonthStart && auditDate <= currentMonthEnd;
      })
      .map((a) => a.id);
  }, [audits, currentMonthStart, currentMonthEnd]);

  // Apply all filters
  const filteredFailures = useMemo(() => {
    let result = failures;

    // Filter by store if selected
    if (effectiveLojaId) {
      result = result.filter((f) => f.loja_id === effectiveLojaId);
    } else if (isGerenteUnidade && unidades.length > 0) {
      const unidadeIds = unidades.map((u) => u.id);
      result = result.filter((f) => unidadeIds.includes(f.loja_id));
    }

    // Filter by current month audits
    result = result.filter((f) => currentMonthAuditIds.includes(f.audit_id));

    // Status filter
    if (statusFilter === "pending") {
      result = result.filter((f) => f.status === "pending");
    } else if (statusFilter === "resolved") {
      result = result.filter((f) => f.status === "resolved");
    }

    // Recurring filter
    if (showOnlyRecurring) {
      result = result.filter((f) => isRecurringEnhanced(f));
    }

    // Sort by recurrence count when showing only recurring (highest frequency first)
    if (showOnlyRecurring) {
      result = result.sort((a, b) => {
        const countA = getRecurrenceInfo(a).count;
        const countB = getRecurrenceInfo(b).count;
        return countB - countA;
      });
    }

    return result;
  }, [failures, effectiveLojaId, statusFilter, showOnlyRecurring, currentMonthAuditIds, isGerenteUnidade, unidades, recurrenceMap]);

  // Group stores by brand
  const groupedLojas = useMemo(() => {
    const storeList = isAdmin ? lojas : unidades;
    const groups: Record<string, typeof storeList> = {};

    storeList.forEach((loja) => {
      const brand = detectBrand(loja.nome);
      if (!groups[brand]) {
        groups[brand] = [];
      }
      groups[brand].push(loja);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [lojas, unidades, isAdmin]);

  const getLojaName = (lojaId: string) => {
    return lojas.find((l) => l.id === lojaId)?.nome || "Desconhecida";
  };

  const toggleHistory = (failureId: string) => {
    setExpandedHistories((prev) => {
      const next = new Set(prev);
      if (next.has(failureId)) {
        next.delete(failureId);
      } else {
        next.add(failureId);
      }
      return next;
    });
  };

  const handleOpenDetailModal = (failure: SupervisionFailure) => {
    setSelectedFailure(failure);
    setIsDetailModalOpen(true);
    setPhotoPreview(null);
    setPhotoFile(null);
    setJustification("");
    setSolution("");
  };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleResolveItem = async () => {
    if (!selectedFailure) return;

    setIsUploading(true);

    try {
      let photoUrl: string | undefined;

      if (photoFile) {
        const fileName = `resolutions/${selectedFailure.id}/${Date.now()}_${photoFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("audit-photos")
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("audit-photos")
          .getPublicUrl(uploadData.path);
        photoUrl = urlData.publicUrl;
      }

      await resolveFailure({ failureId: selectedFailure.id, photoUrl });

      setIsDetailModalOpen(false);
      setSelectedFailure(null);
      toast({
        title: "Item marcado como corrigido",
        description: "Aguardando validação do administrador.",
      });
    } catch (error) {
      console.error("Error resolving item:", error);
      toast({
        title: "Erro ao resolver item",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleValidateItem = async (failure: SupervisionFailure) => {
    try {
      await validateFailure(failure.id);
    } catch (error) {
      console.error("Error validating item:", error);
    }
  };

  const clearFilters = () => {
    setSelectedLojaId(null);
    setStatusFilter("pending");
    setShowOnlyRecurring(false);
  };

  const hasActiveFilters = selectedLojaId !== null || statusFilter !== "pending" || showOnlyRecurring;

  // KPI counts
  const pendingCount = filteredFailures.filter((f) => f.status === "pending").length;
  const resolvedCount = filteredFailures.filter((f) => f.status === "resolved").length;
  const recurringCount = filteredFailures.filter((f) => isRecurringEnhanced(f) && f.status === "pending").length;

  if (isLoadingFailures) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold uppercase">
              Plano de Ação
            </h2>
            <p className="text-muted-foreground">
              {format(new Date(), "MMMM yyyy", { locale: ptBR })} • Não conformidades de auditoria
            </p>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl shadow-card cursor-pointer transition-colors hover:bg-muted/50" onClick={() => setStatusFilter("pending")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">aguardando correção</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card cursor-pointer transition-colors hover:bg-muted/50" onClick={() => setStatusFilter("resolved")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Em Validação
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedCount}</div>
            <p className="text-xs text-muted-foreground">corrigidos, aguardando validação</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card bg-gradient-to-br from-destructive/10 to-destructive/5 cursor-pointer transition-colors hover:from-destructive/15 hover:to-destructive/10" onClick={() => setShowOnlyRecurring(true)}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Recorrentes
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{recurringCount}</div>
            <p className="text-xs text-muted-foreground">prioridade máxima</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Store selector */}
            {!(isGerenteUnidade && unidades.length === 1) && (
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedLojaId || "all"}
                  onValueChange={(value) => setSelectedLojaId(value === "all" ? null : value)}
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        {isAdmin ? "Todas as unidades" : "Todas as minhas lojas"}
                      </span>
                    </SelectItem>
                    {groupedLojas.map(([brand, stores]) => (
                      <SelectGroup key={brand}>
                        <SelectLabel className="text-xs uppercase text-primary font-semibold">
                          {brand}
                        </SelectLabel>
                        {stores.map((loja) => (
                          <SelectItem key={loja.id} value={loja.id}>
                            {loja.nome}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Single store badge for managers */}
            {isGerenteUnidade && unidades.length === 1 && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Unidade:</span>
                <Badge variant="secondary">{unidades[0]?.nome}</Badge>
              </div>
            )}

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="resolved">Em Correção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recurring toggle */}
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <Switch
                id="recurring-filter"
                checked={showOnlyRecurring}
                onCheckedChange={setShowOnlyRecurring}
              />
              <Label htmlFor="recurring-filter" className="text-sm flex items-center gap-1.5 cursor-pointer">
                <RefreshCw className="h-4 w-4 text-destructive" />
                Apenas Recorrentes
              </Label>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Action Plan Cards */}
          {filteredFailures.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
              <h3 className="font-medium text-lg">Nenhuma pendência</h3>
              <p className="text-muted-foreground text-sm">
                Não há itens para os filtros selecionados neste mês.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFailures.map((failure) => {
                const recurring = isRecurringEnhanced(failure);
                const recurrenceInfo = getRecurrenceInfo(failure);
                const isHistoryExpanded = expandedHistories.has(failure.id);

                return (
                  <div
                    key={failure.id}
                    className={`rounded-xl border p-4 transition-colors cursor-pointer hover:bg-muted/50 ${
                      recurring
                        ? "border-destructive/50 bg-destructive/5"
                        : failure.status === "resolved"
                        ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
                        : "border-border bg-background"
                    }`}
                    onClick={() => handleOpenDetailModal(failure)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status indicator */}
                      <div className="flex-shrink-0 mt-1">
                        {failure.status === "pending" ? (
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-amber-500" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <p className="font-medium text-sm leading-tight">{failure.item_name}</p>
                          {recurring && (
                            <Badge variant="destructive" className="flex-shrink-0 text-xs gap-1 animate-pulse">
                              <RefreshCw className="h-3 w-3" />
                              🔁 RECORRENTE: {recurrenceInfo.count}x
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          {/* Store badge */}
                          <Badge variant="outline" className="text-xs">
                            <Store className="h-3 w-3 mr-1" />
                            {getLojaName(failure.loja_id)}
                          </Badge>
                          
                          {failure.category && (
                            <Badge variant="secondary" className="text-xs">
                              #{failure.category}
                            </Badge>
                          )}
                        </div>

                        {failure.status === "resolved" && failure.resolved_at && (
                          <p className="text-xs text-amber-600 mt-2">
                            Corrigido em{" "}
                            {format(new Date(failure.resolved_at), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </p>
                        )}

                        {/* History drill-down for recurring items */}
                        {recurring && recurrenceInfo.history.length > 1 && (
                          <Collapsible open={isHistoryExpanded} onOpenChange={() => toggleHistory(failure.id)}>
                            <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                              >
                                <History className="h-3.5 w-3.5" />
                                Ver histórico ({recurrenceInfo.history.length - 1} anteriores)
                                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isHistoryExpanded ? 'rotate-90' : ''}`} />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2" onClick={(e) => e.stopPropagation()}>
                              <div className="border-l-2 border-destructive/30 pl-3 space-y-2">
                                <p className="text-xs text-muted-foreground mb-2">
                                  🔁 Este item apareceu <strong className="text-destructive">{recurrenceInfo.count}x</strong> nos últimos 60 dias
                                </p>
                                {recurrenceInfo.history
                                  .filter((h) => h.id !== failure.id)
                                  .slice(0, 5)
                                  .map((historyItem) => (
                                    <div
                                      key={historyItem.id}
                                      className="text-xs p-3 rounded-lg bg-muted/50 border border-border/50"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <Badge
                                          variant={
                                            historyItem.status === "validated"
                                              ? "default"
                                              : historyItem.status === "resolved"
                                              ? "secondary"
                                              : "outline"
                                          }
                                          className="text-[10px] h-5"
                                        >
                                          {historyItem.status === "validated"
                                            ? "✓ Validado"
                                            : historyItem.status === "resolved"
                                            ? "⏳ Corrigido"
                                            : "⚠ Pendente"}
                                        </Badge>
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {format(new Date(historyItem.created_at), "dd/MM/yyyy", {
                                            locale: ptBR,
                                          })}
                                        </span>
                                      </div>
                                      {/* Show resolution photo link if available */}
                                      {historyItem.resolution_photo_url && (
                                        <a
                                          href={historyItem.resolution_photo_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-primary hover:underline"
                                        >
                                          <Camera className="h-3 w-3" />
                                          Ver foto da correção anterior
                                        </a>
                                      )}
                                      {historyItem.resolved_at && (
                                        <p className="text-muted-foreground mt-1">
                                          Corrigido em {format(new Date(historyItem.resolved_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {failure.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetailModal(failure);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Resolver
                          </Button>
                        )}
                        {failure.status === "resolved" && isAdmin && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleValidateItem(failure);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Validar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary footer */}
          {filteredFailures.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                  <span>{pendingCount} Pendentes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>{resolvedCount} Em Validação</span>
                </div>
                {showOnlyRecurring && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    <span>{filteredFailures.length} Recorrentes</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail / Resolution Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Detalhes da Não Conformidade
            </DialogTitle>
            <DialogDescription>
              Preencha a justificativa e solução para resolver este item.
            </DialogDescription>
          </DialogHeader>

          {selectedFailure && (
            <div className="space-y-4">
              {/* Failure info */}
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="flex items-start gap-3">
                  <Store className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{getLojaName(selectedFailure.loja_id)}</p>
                    <p className="text-xs text-muted-foreground">Unidade</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-semibold">{selectedFailure.item_name}</p>
                  {selectedFailure.category && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      #{selectedFailure.category}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Identificado em {format(new Date(selectedFailure.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
              </div>

              {selectedFailure.status === "pending" && (
                <>
                  {/* Justification */}
                  <div className="space-y-2">
                    <Label htmlFor="justification">Justificativa / Causa Raiz</Label>
                    <Textarea
                      id="justification"
                      placeholder="Descreva o que causou esta não conformidade..."
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Solution */}
                  <div className="space-y-2">
                    <Label htmlFor="solution">Ação Corretiva / Solução</Label>
                    <Textarea
                      id="solution"
                      placeholder="Descreva a ação tomada para corrigir..."
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Photo upload */}
                  <div className="space-y-2">
                    <Label>Evidência Fotográfica (opcional)</Label>
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                        photoPreview ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelect}
                        disabled={isUploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />

                      {photoPreview ? (
                        <div className="relative">
                          <img
                            src={photoPreview}
                            alt="Preview"
                            className="max-h-40 mx-auto rounded-lg"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-0 right-0 h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhotoPreview(null);
                              setPhotoFile(null);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Camera className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm">Tirar foto ou selecionar</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* View resolution details if already resolved */}
              {selectedFailure.status === "resolved" && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Aguardando Validação
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Corrigido em {format(new Date(selectedFailure.resolved_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {selectedFailure.resolution_photo_url && (
                    <a
                      href={selectedFailure.resolution_photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline mt-2 inline-block"
                    >
                      Ver foto anexada
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailModalOpen(false)}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            {selectedFailure?.status === "pending" && (
              <Button onClick={handleResolveItem} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar como Corrigido
                  </>
                )}
              </Button>
            )}
            {selectedFailure?.status === "resolved" && isAdmin && (
              <Button onClick={() => selectedFailure && handleValidateItem(selectedFailure)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Validar Correção
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
