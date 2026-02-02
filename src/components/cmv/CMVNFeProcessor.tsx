import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, Loader2, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Package, Scale, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { useNFeExtraction, ExtractedNFeItem } from "@/hooks/useNFeExtraction";
import { useCMVItems } from "@/hooks/useCMV";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

interface ItemMapping {
  nfeItem: ExtractedNFeItem;
  cmvItemId: string | null;
  priceChanged: boolean;
  currentPrice: number | null;
  selected: boolean;
  // Conversion fields
  isKgItem: boolean;
  suggestedUnits: number | null;
  manualUnits: string;
  finalUnits: number;
  standardWeightG: number | null;
}

export function CMVNFeProcessor() {
  const { effectiveUnidadeId } = useUnidade();
  const { isExtracting, extractedData, extractionError, extractFromFile, clearExtractedData } = useNFeExtraction();
  const { items: cmvItems, updateItem } = useCMVItems();
  
  const [itemMappings, setItemMappings] = useState<ItemMapping[]>([]);
  const [priceUpdateDialog, setPriceUpdateDialog] = useState<{
    open: boolean;
    item: ExtractedNFeItem | null;
    cmvItemId: string | null;
    oldPrice: number;
    newPrice: number;
  }>({ open: false, item: null, cmvItemId: null, oldPrice: 0, newPrice: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const calculateConversion = (nfeItem: ExtractedNFeItem, cmvItem: typeof cmvItems[0] | undefined) => {
    const isKg = nfeItem.unidade?.toLowerCase() === "kg" || 
                 nfeItem.nome.toLowerCase().includes("kg") ||
                 cmvItem?.unidade === "kg";
    
    if (!isKg || !cmvItem?.peso_padrao_g) {
      return {
        isKgItem: false,
        suggestedUnits: null,
        manualUnits: "",
        finalUnits: nfeItem.quantidade,
        standardWeightG: cmvItem?.peso_padrao_g || null,
      };
    }

    // Convert KG quantity to units based on standard weight
    const kgQuantity = nfeItem.quantidade;
    const standardWeightKg = cmvItem.peso_padrao_g / 1000;
    const suggestedUnits = Math.round(kgQuantity / standardWeightKg);

    return {
      isKgItem: true,
      suggestedUnits,
      manualUnits: "",
      finalUnits: suggestedUnits,
      standardWeightG: cmvItem.peso_padrao_g,
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await extractFromFile(file);
    if (data && data.items.length > 0) {
      const mappings: ItemMapping[] = data.items.map(nfeItem => {
        const matchedItem = cmvItems.find(cmv => 
          cmv.nome.toLowerCase().includes(nfeItem.nome.toLowerCase().split(" ")[0]) ||
          nfeItem.nome.toLowerCase().includes(cmv.nome.toLowerCase().split(" ")[0])
        );
        
        const priceChanged = matchedItem 
          ? Math.abs(matchedItem.preco_custo_atual - nfeItem.valor_unitario) > 0.01
          : false;

        const conversion = calculateConversion(nfeItem, matchedItem);

        return {
          nfeItem,
          cmvItemId: matchedItem?.id || null,
          priceChanged,
          currentPrice: matchedItem?.preco_custo_atual || null,
          selected: !!matchedItem, // Auto-select if matched
          ...conversion,
        };
      });
      setItemMappings(mappings);
    }
    e.target.value = "";
  };

  const handleMappingChange = (index: number, cmvItemId: string) => {
    const cmvItem = cmvItems.find(i => i.id === cmvItemId);
    const nfeItem = itemMappings[index].nfeItem;
    
    const priceChanged = cmvItem 
      ? Math.abs(cmvItem.preco_custo_atual - nfeItem.valor_unitario) > 0.01
      : false;

    const conversion = calculateConversion(nfeItem, cmvItem);

    setItemMappings(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        cmvItemId,
        priceChanged,
        currentPrice: cmvItem?.preco_custo_atual || null,
        selected: true, // Auto-select when mapping
        ...conversion,
      };
      return updated;
    });
  };

  const handleSelectionChange = (index: number, checked: boolean) => {
    setItemMappings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: checked };
      return updated;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setItemMappings(prev => prev.map(m => ({ ...m, selected: checked })));
  };

  const handleManualUnitsChange = (index: number, value: string) => {
    setItemMappings(prev => {
      const updated = [...prev];
      const mapping = updated[index];
      const numValue = parseFloat(value) || 0;
      updated[index] = {
        ...mapping,
        manualUnits: value,
        finalUnits: value ? numValue : (mapping.suggestedUnits || mapping.nfeItem.quantidade),
      };
      return updated;
    });
  };

  const handleUpdatePrice = async () => {
    if (!priceUpdateDialog.cmvItemId) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      await supabase.from("cmv_price_history").insert({
        cmv_item_id: priceUpdateDialog.cmvItemId,
        preco_anterior: priceUpdateDialog.oldPrice,
        preco_novo: priceUpdateDialog.newPrice,
        fonte: "nfe",
        referencia_nf: extractedData?.numero_nf || undefined,
        created_by: user.user?.id,
      });

      await updateItem.mutateAsync({
        id: priceUpdateDialog.cmvItemId,
        preco_custo_atual: priceUpdateDialog.newPrice,
      });

      setItemMappings(prev => prev.map(m => 
        m.cmvItemId === priceUpdateDialog.cmvItemId 
          ? { ...m, priceChanged: false, currentPrice: priceUpdateDialog.newPrice }
          : m
      ));

      toast.success("Preço atualizado com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar preço");
    } finally {
      setPriceUpdateDialog({ open: false, item: null, cmvItemId: null, oldPrice: 0, newPrice: 0 });
    }
  };

  const handleProcessEntry = async () => {
    if (!effectiveUnidadeId) {
      toast.error("Selecione uma unidade");
      return;
    }

    // Only process selected items with valid mappings
    const validMappings = itemMappings.filter(m => m.selected && m.cmvItemId);
    if (validMappings.length === 0) {
      toast.error("Selecione e vincule pelo menos um item");
      return;
    }

    setIsProcessing(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      // Create movements with final confirmed units
      const movements = validMappings.map(m => ({
        cmv_item_id: m.cmvItemId!,
        loja_id: effectiveUnidadeId,
        tipo_movimento: "entrada",
        quantidade: m.finalUnits, // Use the final confirmed quantity
        preco_unitario: m.isKgItem 
          ? (m.nfeItem.valor_total / m.finalUnits) // Calculate unit price from total
          : m.nfeItem.valor_unitario,
        data_movimento: new Date().toISOString().split("T")[0],
        referencia: extractedData?.numero_nf || "NFe importada",
        created_by: user.user?.id,
      }));

      const { error } = await supabase.from("cmv_movements").insert(movements);
      if (error) throw error;

      // Update inventory with final quantities
      for (const m of validMappings) {
        const { data: currentInv } = await supabase
          .from("cmv_inventory")
          .select("quantidade_atual")
          .eq("cmv_item_id", m.cmvItemId!)
          .eq("loja_id", effectiveUnidadeId)
          .single();

        const newQty = (currentInv?.quantidade_atual || 0) + m.finalUnits;

        await supabase.from("cmv_inventory").upsert({
          cmv_item_id: m.cmvItemId!,
          loja_id: effectiveUnidadeId,
          quantidade_atual: newQty,
          ultima_contagem: new Date().toISOString().split("T")[0],
        }, { onConflict: "cmv_item_id,loja_id" });

        // Update cost price if it changed (calculate per-unit cost)
        if (m.priceChanged && m.currentPrice !== null) {
          const newUnitPrice = m.isKgItem 
            ? (m.nfeItem.valor_total / m.finalUnits)
            : m.nfeItem.valor_unitario;
          
          await supabase.from("cmv_price_history").insert({
            cmv_item_id: m.cmvItemId!,
            preco_anterior: m.currentPrice,
            preco_novo: newUnitPrice,
            fonte: "nfe",
            referencia_nf: extractedData?.numero_nf || undefined,
            created_by: user.user?.id,
          });

          await updateItem.mutateAsync({
            id: m.cmvItemId!,
            preco_custo_atual: newUnitPrice,
          });
        }
      }

      toast.success(`${validMappings.length} itens registrados no estoque!`);
      clearExtractedData();
      setItemMappings([]);
    } catch (error) {
      toast.error("Erro ao processar entrada");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <Badge className="bg-green-500">Alta Confiança</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Média Confiança</Badge>;
      default:
        return <Badge className="bg-red-500">Baixa Confiança</Badge>;
    }
  };

  const selectedCount = itemMappings.filter(m => m.selected).length;
  const allSelected = itemMappings.length > 0 && itemMappings.every(m => m.selected);
  const someSelected = itemMappings.some(m => m.selected) && !allSelected;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Scanner de NFe (Entradas VPJ)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="nfe-upload">Upload de PDF/Foto da Nota Fiscal</Label>
            <Input
              id="nfe-upload"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              disabled={isExtracting}
              className="mt-1"
            />
          </div>

          {isExtracting && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando documento com IA...
            </div>
          )}

          {extractionError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{extractionError}</AlertDescription>
            </Alert>
          )}

          {extractedData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    NFe: {extractedData.numero_nf || "N/A"} | {extractedData.fornecedor || "Fornecedor não identificado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Data: {extractedData.data_emissao || "N/A"} | CNPJ: {extractedData.cnpj_fornecedor || "N/A"}
                  </p>
                </div>
                {getConfidenceBadge(extractedData.confidence)}
              </div>

              {itemMappings.length > 0 && (
                <>
                  <Alert>
                    <Scale className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Conversão KG → Unidades:</strong> Para itens em KG, o sistema sugere a conversão automática baseada no peso padrão. 
                      Você pode ajustar manualmente se a contagem física diferir.
                    </AlertDescription>
                  </Alert>

                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={allSelected}
                              ref={(ref) => {
                                if (ref) {
                                  (ref as any).indeterminate = someSelected;
                                }
                              }}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Item NFe</TableHead>
                          <TableHead className="w-[100px]">Qtd NFe</TableHead>
                          <TableHead className="w-[120px]">Valor Total</TableHead>
                          <TableHead className="w-[200px]">Vincular a</TableHead>
                          <TableHead className="w-[180px]">Conversão → Unid</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemMappings.map((mapping, index) => (
                          <TableRow 
                            key={index} 
                            className={!mapping.selected ? "opacity-50 bg-muted/30" : ""}
                          >
                            <TableCell>
                              <Checkbox
                                checked={mapping.selected}
                                onCheckedChange={(checked) => handleSelectionChange(index, !!checked)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {mapping.nfeItem.nome}
                            </TableCell>
                            <TableCell>
                              {mapping.nfeItem.quantidade} {mapping.nfeItem.unidade || "un"}
                            </TableCell>
                            <TableCell>
                              R$ {mapping.nfeItem.valor_total.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={mapping.cmvItemId || ""}
                                onValueChange={(value) => handleMappingChange(index, value)}
                                disabled={!mapping.selected}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Selecionar item" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cmvItems.filter(i => i.ativo).map(item => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.nome} ({item.peso_padrao_g ? `${item.peso_padrao_g}g` : item.unidade})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {mapping.isKgItem && mapping.cmvItemId ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    Sugestão: {mapping.suggestedUnits}
                                  </span>
                                  <Input
                                    type="number"
                                    placeholder={String(mapping.suggestedUnits)}
                                    value={mapping.manualUnits}
                                    onChange={(e) => handleManualUnitsChange(index, e.target.value)}
                                    className="h-7 w-16 text-center"
                                    disabled={!mapping.selected}
                                  />
                                  {mapping.manualUnits && (
                                    <Edit3 className="h-3 w-3 text-blue-500" />
                                  )}
                                </div>
                              ) : mapping.cmvItemId ? (
                                <span className="text-sm text-muted-foreground">
                                  {mapping.finalUnits} un
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {!mapping.selected ? (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Ignorado
                                </Badge>
                              ) : mapping.cmvItemId ? (
                                mapping.priceChanged ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs text-orange-600 border-orange-300"
                                    onClick={() => setPriceUpdateDialog({
                                      open: true,
                                      item: mapping.nfeItem,
                                      cmvItemId: mapping.cmvItemId,
                                      oldPrice: mapping.currentPrice || 0,
                                      newPrice: mapping.isKgItem 
                                        ? (mapping.nfeItem.valor_total / mapping.finalUnits)
                                        : mapping.nfeItem.valor_unitario,
                                    })}
                                  >
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Preço
                                  </Button>
                                ) : (
                                  <Badge variant="outline" className="text-green-600">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    OK
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Pendente
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedCount} de {itemMappings.length} itens selecionados
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearExtractedData();
                      setItemMappings([]);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleProcessEntry}
                    disabled={isProcessing || !itemMappings.some(m => m.selected && m.cmvItemId)}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4 mr-2" />
                        Processar Selecionados ({selectedCount})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={priceUpdateDialog.open} onOpenChange={(open) => !open && setPriceUpdateDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Preço Alterado na Nota
            </DialogTitle>
            <DialogDescription>
              O preço deste item na NFe é diferente do preço cadastrado no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Preço Atual (por unidade)</p>
                <p className="text-lg font-semibold flex items-center gap-1">
                  R$ {priceUpdateDialog.oldPrice.toFixed(2)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <p className="text-xs text-muted-foreground">Preço na NFe (por unidade)</p>
                <p className="text-lg font-semibold flex items-center gap-1">
                  R$ {priceUpdateDialog.newPrice.toFixed(2)}
                  {priceUpdateDialog.newPrice > priceUpdateDialog.oldPrice ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-green-500" />
                  )}
                </p>
              </div>
            </div>
            <p className="text-sm">
              Diferença: <span className={priceUpdateDialog.newPrice > priceUpdateDialog.oldPrice ? "text-red-500" : "text-green-500"}>
                {priceUpdateDialog.newPrice > priceUpdateDialog.oldPrice ? "+" : ""}
                {priceUpdateDialog.oldPrice > 0 
                  ? ((priceUpdateDialog.newPrice - priceUpdateDialog.oldPrice) / priceUpdateDialog.oldPrice * 100).toFixed(1)
                  : "N/A"
                }%
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceUpdateDialog(prev => ({ ...prev, open: false }))}>
              Manter Preço Atual
            </Button>
            <Button onClick={handleUpdatePrice}>
              Atualizar para R$ {priceUpdateDialog.newPrice.toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
