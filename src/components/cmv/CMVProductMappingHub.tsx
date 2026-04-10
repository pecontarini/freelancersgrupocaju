import { useState, useMemo } from "react";
import { Link2, Search, Package, Sparkles, Check, Loader2, ChevronRight, EyeOff, Globe, Eye, Filter, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAllSalesItems, SalesItemWithStatus, SalesItemStatus, CoverageStats } from "@/hooks/useAllSalesItems";
import { useCMVItems, useCMVSalesMappings } from "@/hooks/useCMV";
import { useCMVIgnoredItems } from "@/hooks/useCMVIgnoredItems";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters";

type ViewFilter = "pending" | "linked" | "ignored" | "all";

interface MappingFormState {
  selectedItems: Set<string>;
  targetItemId: string | null;
  multiplier: string;
  isGlobal: boolean;
}

export function CMVProductMappingHub() {
  const { effectiveUnidadeId } = useUnidade();
  const { data, isLoading: loadingItems, refetch } = useAllSalesItems(effectiveUnidadeId || undefined);
  const { items: inventoryItems, isLoading: loadingInventory } = useCMVItems();
  const { addMapping } = useCMVSalesMappings();
  const { ignoreItem } = useCMVIgnoredItems();

  const allItems = data?.items ?? [];
  const stats = data?.stats ?? { total: 0, linked: 0, pending: 0, ignored: 0, linkedPercent: 0, pendingPercent: 0, ignoredPercent: 0 };

  const [viewFilter, setViewFilter] = useState<ViewFilter>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [formState, setFormState] = useState<MappingFormState>({
    selectedItems: new Set(),
    targetItemId: null,
    multiplier: "1",
    isGlobal: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isIgnoring, setIsIgnoring] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);

  // Filter items by status and search
  const filteredItems = useMemo(() => {
    let items = allItems;

    // Search overrides status filter — show all matching items
    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      items = items.filter(item => item.item_name.includes(query));
    } else if (viewFilter !== "all") {
      items = items.filter(item => item.status === viewFilter);
    }

    return items;
  }, [allItems, viewFilter, searchQuery]);

  const activeInventoryItems = useMemo(() => {
    return inventoryItems.filter(item => item.ativo);
  }, [inventoryItems]);

  const selectedTargetItem = useMemo(() => {
    if (!formState.targetItemId) return null;
    return inventoryItems.find(i => i.id === formState.targetItemId);
  }, [formState.targetItemId, inventoryItems]);

  const handleSelectItem = (itemName: string) => {
    setFormState(prev => {
      const newSelected = new Set(prev.selectedItems);
      if (newSelected.has(itemName)) {
        newSelected.delete(itemName);
      } else {
        newSelected.add(itemName);
      }
      return { ...prev, selectedItems: newSelected };
    });
  };

  const selectableItems = filteredItems.filter(i => i.status === "pending");

  const handleSelectAll = () => {
    if (formState.selectedItems.size === selectableItems.length && selectableItems.length > 0) {
      setFormState(prev => ({ ...prev, selectedItems: new Set() }));
    } else {
      setFormState(prev => ({
        ...prev,
        selectedItems: new Set(selectableItems.map(i => i.item_name)),
      }));
    }
  };

  const handleSaveMapping = async () => {
    if (formState.selectedItems.size === 0 || !formState.targetItemId) {
      toast.error("Selecione itens de venda e um item de estoque");
      return;
    }

    const multiplier = parseFloat(formState.multiplier.replace(",", "."));
    if (isNaN(multiplier) || multiplier <= 0) {
      toast.error("Multiplicador deve ser um número positivo");
      return;
    }

    setIsSaving(true);

    try {
      const promises = Array.from(formState.selectedItems).map(itemName =>
        addMapping.mutateAsync({
          nome_venda: itemName,
          cmv_item_id: formState.targetItemId!,
          multiplicador: multiplier,
          is_global: formState.isGlobal,
        })
      );

      await Promise.all(promises);

      toast.success(
        `${formState.selectedItems.size} item(s) vinculado(s) a "${selectedTargetItem?.nome}"`
      );

      setFormState({
        selectedItems: new Set(),
        targetItemId: null,
        multiplier: "1",
        isGlobal: true,
      });
      refetch();
    } catch (error) {
      toast.error("Erro ao salvar vínculos");
    } finally {
      setIsSaving(false);
    }
  };

  const handleIgnoreItems = async () => {
    if (formState.selectedItems.size === 0) {
      toast.error("Selecione itens para ignorar");
      return;
    }

    setIsIgnoring(true);

    try {
      const promises = Array.from(formState.selectedItems).map(itemName =>
        ignoreItem.mutateAsync({ itemName, reason: "Não impacta CMV de Carnes" })
      );

      await Promise.all(promises);

      toast.success(`${formState.selectedItems.size} item(s) marcado(s) como ignorado(s)`);

      setFormState(prev => ({ ...prev, selectedItems: new Set() }));
      refetch();
    } catch (error) {
      // errors shown by hook
    } finally {
      setIsIgnoring(false);
    }
  };

  const isLoading = loadingItems || loadingInventory;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Coverage Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Mapeamento de Produtos (De-Para)
          </CardTitle>
          <CardDescription>
            Vincule itens de venda aos itens de estoque. Use o filtro de status para conferência total.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CoverageBar stats={stats} />
        </CardContent>
      </Card>

      {/* Main Content - Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Panel - Items List */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 border-b space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Itens de Venda
                <Badge variant="secondary" className="ml-1">
                  {filteredItems.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                {selectableItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs"
                  >
                    {formState.selectedItems.size === selectableItems.length
                      ? "Desmarcar"
                      : "Selecionar pendentes"}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Busca global (ignora filtro de status)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="linked">Vinculados</SelectItem>
                  <SelectItem value="ignored">Ignorados</SelectItem>
                  <SelectItem value="all">Todos (Raw)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[400px]">
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  {searchQuery ? (
                    <>
                      <Search className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">Nenhum item encontrado para "{searchQuery}"</p>
                    </>
                  ) : viewFilter === "pending" ? (
                    <>
                      <Check className="h-12 w-12 mx-auto mb-2 text-primary/50" />
                      <p className="font-medium">Todos os itens estão vinculados!</p>
                      <p className="text-sm">Importe mais vendas para ver novos itens aqui.</p>
                    </>
                  ) : (
                    <>
                      <Eye className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">Nenhum item neste status</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredItems.map(item => (
                    <SalesItemRow
                      key={item.item_name}
                      item={item}
                      isSelected={formState.selectedItems.has(item.item_name)}
                      onSelect={() => handleSelectItem(item.item_name)}
                      isSearchMode={!!searchQuery}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Panel - Mapping Form */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Vincular ao Estoque
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            {/* Selected Items Summary */}
            <div>
              <Label className="text-sm font-medium">Itens Selecionados</Label>
              {formState.selectedItems.size === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione itens pendentes na lista à esquerda
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-24 overflow-auto">
                  {Array.from(formState.selectedItems).slice(0, 10).map(name => (
                    <Badge key={name} variant="secondary" className="text-xs">
                      {name.length > 25 ? name.substring(0, 25) + "..." : name}
                    </Badge>
                  ))}
                  {formState.selectedItems.size > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{formState.selectedItems.size - 10} mais
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <ChevronRight className="h-8 w-8 text-muted-foreground/50" />
            </div>

            {/* Target Item Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Item de Estoque (Destino)</Label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {selectedTargetItem ? (
                      <span className="truncate">{selectedTargetItem.nome}</span>
                    ) : (
                      <span className="text-muted-foreground">Selecionar item de estoque...</span>
                    )}
                    <Package className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar item..." />
                    <CommandList>
                      <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                      <CommandGroup>
                        {activeInventoryItems.map(item => (
                          <CommandItem
                            key={item.id}
                            value={item.nome}
                            onSelect={() => {
                              setFormState(prev => ({
                                ...prev,
                                targetItemId: item.id,
                              }));
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                formState.targetItemId === item.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            <span>{item.nome}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {item.unidade}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Multiplier */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Multiplicador (Fator)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-help">(?)</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Quanto do item de estoque é consumido para 1 venda?
                        <br />
                        Ex: Se cada "Bife Ancho" usa 0.35kg, coloque 0.35
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                type="text"
                inputMode="decimal"
                value={formState.multiplier}
                onChange={e => setFormState(prev => ({ ...prev, multiplier: e.target.value }))}
                placeholder="1.0"
                className="max-w-[150px]"
              />
            </div>

            {/* Global Checkbox */}
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="isGlobal"
                checked={formState.isGlobal}
                onCheckedChange={(checked) =>
                  setFormState(prev => ({ ...prev, isGlobal: checked === true }))
                }
              />
              <div className="flex-1">
                <Label htmlFor="isGlobal" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-primary" />
                  Aplicar para TODAS as unidades
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Outras lojas usarão este vínculo automaticamente
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={handleSaveMapping}
                disabled={formState.selectedItems.size === 0 || !formState.targetItemId || isSaving}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Vincular {formState.selectedItems.size > 0 && `(${formState.selectedItems.size})`}
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleIgnoreItems}
                disabled={formState.selectedItems.size === 0 || isIgnoring}
                className="w-full text-muted-foreground"
              >
                {isIgnoring ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ignorando...
                  </>
                ) : (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Ignorar Selecionados
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Use para itens que não impactam CMV (bebidas, taxas, etc.)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Coverage Bar ──────────────────────────────────────────────
function CoverageBar({ stats }: { stats: CoverageStats }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Cobertura do Catálogo</span>
        <span className="text-muted-foreground ml-auto">
          Total de Itens Únicos: <strong>{stats.total}</strong>
        </span>
      </div>
      <Progress value={stats.linkedPercent} className="h-2.5" />
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" />
          Mapeados: <strong>{stats.linked}</strong>
          <span className="text-muted-foreground">({stats.linkedPercent}%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
          Pendentes: <strong>{stats.pending}</strong>
          <span className="text-muted-foreground">({stats.pendingPercent}%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
          Ignorados: <strong>{stats.ignored}</strong>
          <span className="text-muted-foreground">({stats.ignoredPercent}%)</span>
        </span>
      </div>
    </div>
  );
}

// ── Item Row ──────────────────────────────────────────────────
function SalesItemRow({
  item,
  isSelected,
  onSelect,
  isSearchMode,
}: {
  item: SalesItemWithStatus;
  isSelected: boolean;
  onSelect: () => void;
  isSearchMode: boolean;
}) {
  const isPending = item.status === "pending";
  const isLinked = item.status === "linked";
  const isIgnored = item.status === "ignored";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        isIgnored ? "opacity-50" : ""
      } ${isPending ? "cursor-pointer hover:bg-muted/50" : ""} ${
        isSelected ? "bg-primary/5" : ""
      }`}
      onClick={isPending ? onSelect : undefined}
    >
      {isPending ? (
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div className="w-4 h-4 flex items-center justify-center">
          {isLinked && <Check className="h-4 w-4 text-primary" />}
          {isIgnored && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{item.item_name}</span>
          {item.is_new && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
              <Sparkles className="h-2.5 w-2.5" />
              NOVO
            </Badge>
          )}
          {isSearchMode && (
            <StatusBadge status={item.status} />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{item.total_quantity.toFixed(0)} vendas</span>
          <span>•</span>
          <span>{item.days_count} dias</span>
          <span>•</span>
          <span>Desde {formatDate(item.first_seen)}</span>
          {isLinked && item.linked_to && (
            <>
              <span>•</span>
              <span className="text-primary">
                → {item.linked_to} (×{item.multiplier})
                {item.is_global && " 🌐"}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SalesItemStatus }) {
  switch (status) {
    case "linked":
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary text-primary">Vinculado</Badge>;
    case "ignored":
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">Ignorado</Badge>;
    case "pending":
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500 text-amber-500">Pendente</Badge>;
  }
}
