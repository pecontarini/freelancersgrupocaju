import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, Loader2, AlertTriangle, CheckCircle, HelpCircle, ShoppingCart, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useSalesExtraction, ExtractedSalesItem } from "@/hooks/useSalesExtraction";
import { useCMVItems, useCMVSalesMappings, useCMVInventory } from "@/hooks/useCMV";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { CMVSalesMappingModal } from "./CMVSalesMappingModal";

interface ProcessedSalesItem {
  salesItem: ExtractedSalesItem;
  cmvItemId: string | null;
  cmvItemName: string | null;
  multiplicador: number;
  quantidadeBaixa: number;
  mapped: boolean;
  needsMapping: boolean;
}

export function CMVSalesProcessor() {
  const { effectiveUnidadeId } = useUnidade();
  const { isExtracting, extractedData, extractionError, extractFromFile, clearExtractedData } = useSalesExtraction();
  const { items: cmvItems } = useCMVItems();
  const { mappings } = useCMVSalesMappings();
  const { inventory } = useCMVInventory(effectiveUnidadeId || undefined);
  
  const [processedItems, setProcessedItems] = useState<ProcessedSalesItem[]>([]);
  const [mappingModal, setMappingModal] = useState<{
    open: boolean;
    itemName: string;
  }>({ open: false, itemName: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await extractFromFile(file);
    if (data && data.items.length > 0) {
      const processed: ProcessedSalesItem[] = data.items.map(salesItem => {
        const existingMapping = mappings.find(m => 
          m.nome_venda.toLowerCase() === salesItem.nome.toLowerCase()
        );

        if (existingMapping) {
          const cmvItem = cmvItems.find(i => i.id === existingMapping.cmv_item_id);
          return {
            salesItem,
            cmvItemId: existingMapping.cmv_item_id,
            cmvItemName: cmvItem?.nome || "Item não encontrado",
            multiplicador: existingMapping.multiplicador,
            quantidadeBaixa: salesItem.quantidade * existingMapping.multiplicador,
            mapped: true,
            needsMapping: false,
          };
        }

        const directMatch = cmvItems.find(i => 
          i.nome.toLowerCase() === salesItem.nome.toLowerCase()
        );

        if (directMatch) {
          return {
            salesItem,
            cmvItemId: directMatch.id,
            cmvItemName: directMatch.nome,
            multiplicador: 1,
            quantidadeBaixa: salesItem.quantidade,
            mapped: true,
            needsMapping: false,
          };
        }

        return {
          salesItem,
          cmvItemId: null,
          cmvItemName: null,
          multiplicador: 1,
          quantidadeBaixa: salesItem.quantidade,
          mapped: false,
          needsMapping: true,
        };
      });

      setProcessedItems(processed);

      const unmappedCount = processed.filter(p => p.needsMapping).length;
      if (unmappedCount > 0) {
        toast.info(`${unmappedCount} item(s) precisam ser mapeados`);
      }
    }
    e.target.value = "";
  };

  const handleMappingComplete = () => {
    // Refresh processed items to pick up new mapping
    const itemName = mappingModal.itemName;
    const newMapping = mappings.find(m => m.nome_venda.toLowerCase() === itemName.toLowerCase());
    
    if (newMapping) {
      const cmvItem = cmvItems.find(i => i.id === newMapping.cmv_item_id);
      
      setProcessedItems(prev => prev.map(p => {
        if (p.salesItem.nome === itemName) {
          return {
            ...p,
            cmvItemId: newMapping.cmv_item_id,
            cmvItemName: cmvItem?.nome || "Item",
            multiplicador: newMapping.multiplicador,
            quantidadeBaixa: p.salesItem.quantidade * newMapping.multiplicador,
            mapped: true,
            needsMapping: false,
          };
        }
        return p;
      }));
    }

    setMappingModal({ open: false, itemName: "" });
  };

  const handleProcessSales = async () => {
    if (!effectiveUnidadeId) {
      toast.error("Selecione uma unidade");
      return;
    }

    const mappedItems = processedItems.filter(p => p.mapped && p.cmvItemId);
    if (mappedItems.length === 0) {
      toast.error("Nenhum item mapeado para processar");
      return;
    }

    const unmappedItems = processedItems.filter(p => p.needsMapping);
    if (unmappedItems.length > 0) {
      toast.warning(`${unmappedItems.length} item(s) não mapeados serão ignorados`);
    }

    setIsProcessing(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const today = new Date().toISOString().split("T")[0];

      const consolidatedItems = mappedItems.reduce((acc, item) => {
        const key = item.cmvItemId!;
        if (!acc[key]) {
          acc[key] = { ...item, quantidadeBaixa: 0 };
        }
        acc[key].quantidadeBaixa += item.quantidadeBaixa;
        return acc;
      }, {} as Record<string, ProcessedSalesItem>);

      const movements = Object.values(consolidatedItems).map(item => ({
        cmv_item_id: item.cmvItemId!,
        loja_id: effectiveUnidadeId,
        tipo_movimento: "saida",
        quantidade: item.quantidadeBaixa,
        data_movimento: today,
        referencia: `Vendas ${extractedData?.data_referencia || today}`,
        created_by: user.user?.id,
      }));

      const { error: movError } = await supabase.from("cmv_movements").insert(movements);
      if (movError) throw movError;

      for (const item of Object.values(consolidatedItems)) {
        const currentInv = inventory.find(i => i.cmv_item_id === item.cmvItemId);
        const newQty = Math.max(0, (currentInv?.quantidade_atual || 0) - item.quantidadeBaixa);

        await supabase.from("cmv_inventory").upsert({
          cmv_item_id: item.cmvItemId!,
          loja_id: effectiveUnidadeId,
          quantidade_atual: newQty,
        }, { onConflict: "cmv_item_id,loja_id" });
      }

      toast.success(`Baixa de ${mappedItems.length} itens processada!`);
      clearExtractedData();
      setProcessedItems([]);
    } catch (error) {
      toast.error("Erro ao processar vendas");
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

  const totalBaixa = processedItems
    .filter(p => p.mapped)
    .reduce((sum, p) => sum + p.quantidadeBaixa, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Processador de Vendas (Saídas)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sales-upload">Upload do Relatório de Vendas (PDF/Imagem)</Label>
            <Input
              id="sales-upload"
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
              Processando relatório com IA...
            </div>
          )}

          {extractionError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{extractionError}</AlertDescription>
            </Alert>
          )}

          {extractedData && processedItems.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Relatório de Vendas | {processedItems.length} itens detectados
                  </p>
                  {extractedData.data_referencia && (
                    <p className="text-xs text-muted-foreground">
                      Data de referência: {extractedData.data_referencia}
                    </p>
                  )}
                </div>
                {getConfidenceBadge(extractedData.confidence)}
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Vendido</TableHead>
                      <TableHead className="w-[80px]">Qtd</TableHead>
                      <TableHead className="w-[180px]">Porcionado Estoque</TableHead>
                      <TableHead className="w-[80px]">Multi.</TableHead>
                      <TableHead className="w-[100px]">Baixa</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedItems.map((item, index) => (
                      <TableRow key={index} className={item.needsMapping ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                        <TableCell className="font-medium">{item.salesItem.nome}</TableCell>
                        <TableCell>{item.salesItem.quantidade}</TableCell>
                        <TableCell>
                          {item.mapped ? (
                            <span className="text-sm">{item.cmvItemName}</span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setMappingModal({ open: true, itemName: item.salesItem.nome })}
                            >
                              <HelpCircle className="h-3 w-3 mr-1" />
                              Mapear
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>{item.multiplicador}x</TableCell>
                        <TableCell>
                          {item.mapped && (
                            <span className="flex items-center gap-1 text-red-600">
                              <ArrowDown className="h-3 w-3" />
                              {item.quantidadeBaixa}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.mapped ? (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total de baixa teórica: </span>
                  <span className="font-semibold text-red-600">{totalBaixa} unidades</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearExtractedData();
                      setProcessedItems([]);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleProcessSales}
                    disabled={isProcessing || processedItems.every(p => !p.mapped)}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-4 w-4 mr-2" />
                        Processar Baixa
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CMVSalesMappingModal
        isOpen={mappingModal.open}
        onClose={() => setMappingModal({ open: false, itemName: "" })}
        unknownItemName={mappingModal.itemName}
        onMappingComplete={handleMappingComplete}
      />
    </div>
  );
}
