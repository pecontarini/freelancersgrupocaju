import { useState } from "react";
import { Link2, AlertTriangle, CheckCircle, Search, Trash2, ArrowRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCMVItems, useCMVSalesMappings } from "@/hooks/useCMV";
import { useCMVPendingItems, normalizeItemName } from "@/hooks/useCMVPendingItems";
import { toast } from "sonner";

export function CMVSalesMappingHub() {
  const { items: cmvItems } = useCMVItems();
  const { mappings, isLoading: mappingsLoading, addMapping, deleteMapping } = useCMVSalesMappings();
  const { pendingItems, isLoading: pendingLoading, removePendingItem, ignorePendingItem } = useCMVPendingItems();

  const [searchMapped, setSearchMapped] = useState("");
  const [selectedPending, setSelectedPending] = useState<string[]>([]);
  const [bulkItemId, setBulkItemId] = useState("");
  const [bulkMultiplier, setBulkMultiplier] = useState("1");
  
  // Individual mapping state
  const [pendingMappings, setPendingMappings] = useState<Record<string, { itemId: string; multiplier: string }>>({});

  const activeItems = cmvItems.filter((i) => i.ativo);

  // Filter mapped items by search
  const filteredMappings = mappings.filter((m) =>
    m.nome_venda.toLowerCase().includes(searchMapped.toLowerCase()) ||
    m.cmv_item?.nome?.toLowerCase().includes(searchMapped.toLowerCase())
  );

  // Toggle selection for bulk operations
  const toggleSelection = (id: string) => {
    setSelectedPending((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedPending.length === pendingItems.length) {
      setSelectedPending([]);
    } else {
      setSelectedPending(pendingItems.map((p) => p.id));
    }
  };

  // Handle individual mapping
  const handleSingleMapping = async (pendingItem: { id: string; nome_venda_original: string; nome_venda_normalizado: string }) => {
    const mapping = pendingMappings[pendingItem.id];
    if (!mapping?.itemId) {
      toast.error("Selecione um item de estoque");
      return;
    }

    try {
      await addMapping.mutateAsync({
        nome_venda: pendingItem.nome_venda_original,
        cmv_item_id: mapping.itemId,
        multiplicador: parseFloat(mapping.multiplier) || 1,
      });

      // Remove from pending list
      await removePendingItem.mutateAsync(pendingItem.nome_venda_normalizado);

      // Clear local state
      setPendingMappings((prev) => {
        const next = { ...prev };
        delete next[pendingItem.id];
        return next;
      });

      toast.success(`Vínculo criado: ${pendingItem.nome_venda_original}`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar vínculo");
    }
  };

  // Handle bulk mapping
  const handleBulkMapping = async () => {
    if (!bulkItemId) {
      toast.error("Selecione um item de estoque para vínculo em massa");
      return;
    }

    if (selectedPending.length === 0) {
      toast.error("Selecione pelo menos um item pendente");
      return;
    }

    const selectedItems = pendingItems.filter((p) => selectedPending.includes(p.id));
    let successCount = 0;

    for (const item of selectedItems) {
      try {
        await addMapping.mutateAsync({
          nome_venda: item.nome_venda_original,
          cmv_item_id: bulkItemId,
          multiplicador: parseFloat(bulkMultiplier) || 1,
        });
        await removePendingItem.mutateAsync(item.nome_venda_normalizado);
        successCount++;
      } catch (error) {
        console.error(`Erro ao vincular ${item.nome_venda_original}:`, error);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} vínculos criados com sucesso!`);
      setSelectedPending([]);
      setBulkItemId("");
      setBulkMultiplier("1");
    }
  };

  // Delete existing mapping
  const handleDeleteMapping = async (id: string) => {
    if (confirm("Remover este mapeamento? O item voltará a aparecer como pendente na próxima importação.")) {
      await deleteMapping.mutateAsync(id);
    }
  };

  const selectedItem = activeItems.find((i) => i.id === bulkItemId);

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold uppercase">
              Central de Vínculos de Vendas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Gerencie vínculos entre itens de venda e estoque porcionado
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pendentes
              {pendingItems.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {pendingItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="mapped" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Mapeados
              <Badge variant="secondary" className="ml-1">
                {mappings.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* PENDENTES TAB */}
          <TabsContent value="pending" className="space-y-4">
            {pendingLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : pendingItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                <p className="font-medium">Nenhum item pendente de vínculo!</p>
                <p className="text-sm">
                  Todos os itens de venda estão mapeados corretamente.
                </p>
              </div>
            ) : (
              <>
                {/* Bulk Action Bar */}
                {selectedPending.length > 0 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Layers className="h-4 w-4" />
                      Vínculo em Massa ({selectedPending.length} selecionados)
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <Label className="text-xs">Item de Estoque</Label>
                        <Select value={bulkItemId} onValueChange={setBulkItemId}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {activeItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.nome}
                                {item.peso_padrao_g && ` (${item.peso_padrao_g}g)`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Multiplicador</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0.1"
                          value={bulkMultiplier}
                          onChange={(e) => setBulkMultiplier(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <Button onClick={handleBulkMapping} className="h-9">
                        Vincular {selectedPending.length} Itens
                      </Button>
                    </div>
                    {selectedItem && (
                      <p className="text-xs text-muted-foreground">
                        Todos serão vinculados a: <strong>{selectedItem.nome}</strong> com multiplicador {bulkMultiplier}x
                      </p>
                    )}
                  </div>
                )}

                {/* Pending Items Table */}
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedPending.length === pendingItems.length && pendingItems.length > 0}
                            onCheckedChange={selectAll}
                          />
                        </TableHead>
                        <TableHead>Item no PDF</TableHead>
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="min-w-[180px]">Item Estoque</TableHead>
                        <TableHead className="w-20">Multi.</TableHead>
                        <TableHead className="w-16">Vezes</TableHead>
                        <TableHead className="text-right w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingItems.map((item) => (
                        <TableRow key={item.id} className="bg-yellow-50/50 dark:bg-yellow-950/10">
                          <TableCell>
                            <Checkbox
                              checked={selectedPending.includes(item.id)}
                              onCheckedChange={() => toggleSelection(item.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{item.nome_venda_original}</span>
                              <p className="text-xs text-muted-foreground">
                                Última: {new Date(item.ultima_ocorrencia).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={pendingMappings[item.id]?.itemId || ""}
                              onValueChange={(val) =>
                                setPendingMappings((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], itemId: val, multiplier: prev[item.id]?.multiplier || "1" },
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {activeItems.map((cmv) => (
                                  <SelectItem key={cmv.id} value={cmv.id}>
                                    {cmv.nome}
                                    {cmv.peso_padrao_g && ` (${cmv.peso_padrao_g}g)`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.5"
                              min="0.1"
                              value={pendingMappings[item.id]?.multiplier || "1"}
                              onChange={(e) =>
                                setPendingMappings((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], itemId: prev[item.id]?.itemId || "", multiplier: e.target.value },
                                }))
                              }
                              className="h-8 w-16 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.total_ocorrencias}x</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs"
                                onClick={() => handleSingleMapping(item)}
                                disabled={!pendingMappings[item.id]?.itemId}
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() => ignorePendingItem.mutate(item.id)}
                              >
                                Ignorar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>

          {/* MAPEADOS TAB */}
          <TabsContent value="mapped" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome de venda ou estoque..."
                value={searchMapped}
                onChange={(e) => setSearchMapped(e.target.value)}
                className="pl-10"
              />
            </div>

            {mappingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>
                  {searchMapped
                    ? "Nenhum mapeamento encontrado para a busca"
                    : "Nenhum mapeamento configurado ainda"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome no Relatório</TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Item de Estoque</TableHead>
                      <TableHead className="w-24">Multiplicador</TableHead>
                      <TableHead className="text-right w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {mapping.nome_venda}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="font-medium">
                          {mapping.cmv_item?.nome || "-"}
                          {mapping.cmv_item?.peso_padrao_g && (
                            <span className="text-muted-foreground ml-2">
                              ({mapping.cmv_item.peso_padrao_g}g)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={mapping.multiplicador !== 1 ? "default" : "secondary"}>
                            {mapping.multiplicador}x
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMapping(mapping.id)}
                            disabled={deleteMapping.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
