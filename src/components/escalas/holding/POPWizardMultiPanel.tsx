// Aba "Multi-unidade" do POP Wizard: COO anexa um POP único e a IA gera
// a Tabela Mínima para todas as unidades operacionais selecionadas.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Paperclip,
  Loader2,
  FileText,
  Image as ImageIcon,
  X,
  PlayCircle,
  Check,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractAttachment,
  MAX_FILE_SIZE,
  type ExtractedAttachment,
} from "@/lib/extract-attachment-text";
import { deriveBrand, ALL_BRANDS, type Brand } from "@/lib/holding/sectors";
import { buildMatchReport } from "@/lib/holding/sheet-matcher";
import { usePOPWizardBatch, type UnitTarget } from "@/hooks/usePOPWizardBatch";
import { UnitProposalCard } from "./UnitProposalCard";
import {
  parseMinimumScaleWorkbook,
  type ParseResult,
} from "@/lib/holding/minimum-scale-parser";
import {
  resolveUnitsFromSheets,
  type ResolveResult,
} from "@/lib/holding/unit-sheet-resolver";
import { MinimumScaleImportReview } from "./MinimumScaleImportReview";

const ACCEPTED_FILES =
  ".pdf,.xlsx,.xls,.xlsm,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,image/*,text/*";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface UnitRow {
  id: string;
  nome: string;
}

function useOperationalUnits() {
  return useQuery({
    queryKey: ["pop_wizard_operational_units"],
    queryFn: async (): Promise<UnitTarget[]> => {
      const { data, error } = await supabase
        .from("config_lojas")
        .select("id, nome")
        .order("nome", { ascending: true })
        .range(0, 199);
      if (error) throw error;
      const rows = (data ?? []) as UnitRow[];
      const targets: UnitTarget[] = [];
      for (const r of rows) {
        const brand = deriveBrand(r.nome);
        if (!brand) continue;
        targets.push({ unitId: r.id, unitName: r.nome, brand });
      }
      return targets;
    },
    staleTime: 60_000,
  });
}

interface POPWizardMultiPanelProps {
  monthYear: string;
}

export function POPWizardMultiPanel({ monthYear }: POPWizardMultiPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<ExtractedAttachment | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedBrands, setCollapsedBrands] = useState<Set<Brand>>(new Set());
  const [autoApply, setAutoApply] = useState(true);

  // Parser determinístico para .xlsx (caminho principal — sem IA)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [resolveResult, setResolveResult] = useState<ResolveResult | null>(null);

  const { data: units = [], isLoading } = useOperationalUnits();
  const batch = usePOPWizardBatch();

  // Por padrão, marca todas as unidades operacionais
  useEffect(() => {
    if (!units.length || selectedIds.size > 0) return;
    setSelectedIds(new Set(units.map((u) => u.unitId)));
  }, [units, selectedIds.size]);

  const grouped = useMemo(() => {
    const map = new Map<Brand, UnitTarget[]>();
    for (const b of ALL_BRANDS) map.set(b, []);
    for (const u of units) map.get(u.brand)?.push(u);
    return map;
  }, [units]);

  const totalSelected = selectedIds.size;
  const targets = useMemo(
    () => units.filter((u) => selectedIds.has(u.unitId)),
    [units, selectedIds],
  );

  // Mapeamento aba→unidade (só Excel multi-aba). Calculado em tempo real.
  const matchReport = useMemo(() => {
    if (!attachment?.sheets?.length || !targets.length) return null;
    return buildMatchReport(attachment.sheets, targets);
  }, [attachment, targets]);
  const matchedCount = matchReport?.filter((m) => m.match).length ?? 0;

  const handleFilePick = () => {
    if (extracting || batch.running) return;
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `${file.name} tem ${(file.size / 1024 / 1024).toFixed(1)} MB — limite ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      );
      return;
    }
    setExtracting(true);
    setParseResult(null);
    setResolveResult(null);
    try {
      const att = await extractAttachment(file);
      setAttachment(att);
      // Caminho determinístico para .xlsx — sem IA.
      const isXlsx = /\.(xlsx|xls|xlsm)$/i.test(file.name);
      if (isXlsx) {
        const parsed = await parseMinimumScaleWorkbook(file);
        setParseResult(parsed);
        toast.success(
          `${att.name} lido: ${parsed.totalBlocks} blocos · ${parsed.totalCells} células.`,
        );
      } else {
        toast.success(`${att.name} pronto.`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao ler arquivo.");
    } finally {
      setExtracting(false);
    }
  };

  // Re-resolve sempre que muda planilha ou seleção de unidades
  useEffect(() => {
    if (!parseResult) {
      setResolveResult(null);
      return;
    }
    setResolveResult(resolveUnitsFromSheets(parseResult.sheets, units));
  }, [parseResult, units]);

  const handleRun = async () => {
    if (!attachment) {
      toast.error("Anexe um POP primeiro.");
      return;
    }
    if (targets.length === 0) {
      toast.error("Selecione pelo menos uma unidade.");
      return;
    }
    await batch.run({ attachment, targets, monthYear, concurrency: 3, autoApply });
  };

  const toggleUnit = (unitId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const toggleBrand = (brand: Brand, all: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const list = grouped.get(brand) ?? [];
      for (const u of list) {
        if (all) next.add(u.unitId);
        else next.delete(u.unitId);
      }
      return next;
    });
  };

  const selectAll = (all: boolean) => {
    if (all) setSelectedIds(new Set(units.map((u) => u.unitId)));
    else setSelectedIds(new Set());
  };

  const toggleCollapseBrand = (brand: Brand) => {
    setCollapsedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  };

  const hasJobs = batch.jobs.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_FILES}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="overflow-y-auto p-4 space-y-4 flex-1 min-h-0">
        {/* Aviso */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
          <p className="font-semibold text-foreground mb-1">Como funciona</p>
          <p>
            Anexe <strong>um único POP</strong> (PDF, Excel, foto ou texto). A IA
            lê o arquivo e gera uma proposta de Tabela Mínima para cada unidade
            selecionada, respeitando os setores válidos de cada marca. Você
            revisa e aprova unidade por unidade.
          </p>
          <p className="mt-1.5 text-muted-foreground">
            Mês de referência: <strong className="text-foreground">{monthYear}</strong>
          </p>
        </div>

        {/* Anexo */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            1. Anexar POP global
          </div>
          {!attachment ? (
            <button
              type="button"
              onClick={handleFilePick}
              disabled={extracting || batch.running}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5",
                "p-4 text-left text-sm hover:bg-primary/10 hover:border-primary/60 transition-colors",
                "disabled:opacity-50",
              )}
            >
              {extracting ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Paperclip className="h-5 w-5 text-primary" />
              )}
              <div>
                <div className="font-semibold text-foreground">
                  {extracting ? "Lendo arquivo..." : "Clique para anexar"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  PDF, Excel, foto ou texto — até {MAX_FILE_SIZE / 1024 / 1024} MB.
                </div>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 p-2.5">
              {attachment.kind === "image" ? (
                <ImageIcon className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-primary shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{attachment.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {formatSize(attachment.size)}
                  {attachment.truncated && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      truncado
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAttachment(null);
                  setParseResult(null);
                  setResolveResult(null);
                }}
                disabled={batch.running}
                className="h-7"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {attachment?.sheets && attachment.sheets.length > 0 && (
            <div className="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">
                {attachment.sheets.length} aba(s) detectada(s):
              </span>{" "}
              {attachment.sheets.map((s) => s.name).join(" · ")}
            </div>
          )}
        </div>

        {/* Revisão da importação determinística (.xlsx) */}
        {resolveResult && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2. Revisão da importação
            </div>
            <MinimumScaleImportReview
              result={resolveResult}
              monthYear={monthYear}
              selectedUnitIds={selectedIds}
              onApplied={() => {
                /* mantém o painel aberto pra confirmação visual */
              }}
            />
          </div>
        )}

        {/* Mapeamento aba ↔ unidade — apenas no fluxo IA (PDF/imagem/texto) */}
        {!resolveResult && matchReport && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mapeamento detectado
              </div>
              <Badge
                variant={matchedCount === targets.length ? "default" : "secondary"}
                className="text-[10px]"
              >
                {matchedCount}/{targets.length} com aba
              </Badge>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/40 p-2 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                {matchReport.map((r) => (
                  <div key={r.unitId} className="flex items-center gap-1.5 truncate">
                    {r.match ? (
                      <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                    ) : (
                      <X className="h-3 w-3 text-amber-600 shrink-0" />
                    )}
                    <span className="font-medium uppercase truncate">{r.unitName}</span>
                    <span className="text-muted-foreground truncate">
                      {r.match ? `→ ${r.match.sheet.name}` : "→ POP global"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {matchedCount < targets.length && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Unidades sem aba específica receberão o anexo inteiro como POP
                global (mais lento, menos preciso).
              </p>
            )}
          </div>
        )}

        {/* Unidades */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2. Unidades-alvo
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {totalSelected}/{units.length}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => selectAll(true)}
                disabled={batch.running}
                className="h-6 text-[11px] px-2"
              >
                Todas
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => selectAll(false)}
                disabled={batch.running}
                className="h-6 text-[11px] px-2"
              >
                Nenhuma
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando unidades...
            </div>
          ) : (
            <div className="space-y-1.5">
              {ALL_BRANDS.map((brand) => {
                const list = grouped.get(brand) ?? [];
                if (!list.length) return null;
                const allChecked = list.every((u) => selectedIds.has(u.unitId));
                const someChecked = list.some((u) => selectedIds.has(u.unitId));
                const collapsed = collapsedBrands.has(brand);
                return (
                  <div
                    key={brand}
                    className="rounded-lg border border-border/50 bg-background/40 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 border-b border-border/40">
                      <Checkbox
                        checked={allChecked ? true : someChecked ? "indeterminate" : false}
                        onCheckedChange={(v) => toggleBrand(brand, !!v)}
                        disabled={batch.running}
                      />
                      <button
                        type="button"
                        onClick={() => toggleCollapseBrand(brand)}
                        className="flex-1 text-left text-xs font-semibold uppercase tracking-wide text-foreground hover:text-primary"
                      >
                        {brand}{" "}
                        <span className="text-muted-foreground font-normal normal-case">
                          ({list.filter((u) => selectedIds.has(u.unitId)).length}/{list.length})
                        </span>
                      </button>
                    </div>
                    {!collapsed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/30">
                        {list.map((u) => (
                          <label
                            key={u.unitId}
                            className={cn(
                              "flex items-center gap-2 px-2.5 py-1.5 bg-background/60 cursor-pointer text-xs",
                              "hover:bg-primary/5 transition-colors",
                              batch.running && "cursor-not-allowed opacity-60",
                            )}
                          >
                            <Checkbox
                              checked={selectedIds.has(u.unitId)}
                              onCheckedChange={() => toggleUnit(u.unitId)}
                              disabled={batch.running}
                            />
                            <span className="truncate font-medium uppercase">{u.unitName}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Auto-apply toggle (apenas no fluxo IA — Excel já tem revisão própria) */}
        {!resolveResult && (
          <label
            className={cn(
              "flex items-start gap-2.5 rounded-lg border border-border/60 bg-background/40 p-2.5 cursor-pointer",
              "hover:bg-primary/5 transition-colors",
              batch.running && "cursor-not-allowed opacity-60",
            )}
          >
            <Checkbox
              checked={autoApply}
              onCheckedChange={(v) => setAutoApply(!!v)}
              disabled={batch.running}
              className="mt-0.5"
            />
            <div className="text-xs">
              <div className="font-semibold text-foreground">Aplicar automaticamente</div>
              <div className="text-muted-foreground mt-0.5">
                Salva cada proposta no banco assim que a IA termina de gerar — sem
                precisar revisar uma por uma. Desligue para revisar manualmente
                antes de aplicar.
              </div>
            </div>
          </label>
        )}

        {hasJobs && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                3. Propostas geradas
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  {batch.summary.ready} pronta(s) · {batch.summary.applied} aplicada(s)
                  {batch.summary.failed > 0 && (
                    <> · <span className="text-destructive">{batch.summary.failed} falha(s)</span></>
                  )}
                </span>
                {batch.summary.ready > 0 && !batch.running && (
                  <Button
                    size="sm"
                    onClick={batch.applyAllReady}
                    className="h-7 text-xs"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Aplicar todas pendentes
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {batch.jobs.map((j) => (
                <UnitProposalCard
                  key={j.unitId}
                  job={j}
                  onApply={batch.applyOne}
                  onDiscard={batch.discardOne}
                  onRetry={batch.retryOne}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer fixo: Run button */}
      <div className="border-t border-border/60 p-3 bg-background/80 backdrop-blur-md flex items-center justify-between gap-2">
        {hasJobs && !batch.running && (
          <Button
            variant="ghost"
            size="sm"
            onClick={batch.reset}
            className="h-9 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Limpar resultados
          </Button>
        )}
        <Button
          onClick={handleRun}
          disabled={!attachment || totalSelected === 0 || batch.running || extracting}
          className="ml-auto h-9"
        >
          {batch.running ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Processando {batch.summary.streaming}/{batch.summary.total}...
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4 mr-1.5" />
              Aplicar a {totalSelected} unidade{totalSelected === 1 ? "" : "s"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
