import { useState } from "react";
import { Lightbulb, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCMVItems, useCMVSalesMappings } from "@/hooks/useCMV";

interface CMVSalesMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  unknownItemName: string;
  onMappingComplete?: () => void;
}

export function CMVSalesMappingModal({
  isOpen,
  onClose,
  unknownItemName,
  onMappingComplete,
}: CMVSalesMappingModalProps) {
  const { items } = useCMVItems();
  const { addMapping } = useCMVSalesMappings();
  
  const [selectedItemId, setSelectedItemId] = useState("");
  const [multiplicador, setMultiplicador] = useState("1");
  const [notas, setNotas] = useState("");

  const handleSubmit = async () => {
    if (!selectedItemId) return;

    await addMapping.mutateAsync({
      nome_venda: unknownItemName,
      cmv_item_id: selectedItemId,
      multiplicador: parseFloat(multiplicador) || 1,
      notas: notas || undefined,
    });

    setSelectedItemId("");
    setMultiplicador("1");
    setNotas("");
    onMappingComplete?.();
    onClose();
  };

  const selectedItem = items.find(i => i.id === selectedItemId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600">
            <Lightbulb className="h-5 w-5" />
            <span className="text-sm font-medium uppercase">Modo Aprendizado</span>
          </div>
          <DialogTitle className="mt-2">Item Novo Detectado</DialogTitle>
          <DialogDescription>
            O sistema encontrou um item que ainda não está mapeado. Configure a correspondência para automatizar as próximas leituras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Unknown Item Display */}
          <div className="rounded-lg bg-muted p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">
              Item no Relatório de Vendas
            </p>
            <p className="font-semibold text-lg">{unknownItemName}</p>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          {/* Mapping Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Corresponde a qual item do estoque? *</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o item porcionado..." />
                </SelectTrigger>
                <SelectContent>
                  {items.filter(i => i.ativo).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <span>{item.nome}</span>
                        {item.peso_padrao_g && (
                          <Badge variant="outline" className="text-xs">
                            {item.peso_padrao_g}g
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="multiplicador">
                Multiplicador (quantas unidades do estoque?)
              </Label>
              <Input
                id="multiplicador"
                type="number"
                step="0.5"
                min="0.1"
                value={multiplicador}
                onChange={(e) => setMultiplicador(e.target.value)}
                placeholder="Ex: 2 (para 500g = 2x 250g)"
              />
              <p className="text-xs text-muted-foreground">
                Ex: Se o item vendido é um "Combo 500g" e o estoque é porcionado em 250g, use multiplicador 2.
              </p>
            </div>

            {selectedItem && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm">
                  <span className="font-medium">{unknownItemName}</span>
                  {" → "}
                  <span className="text-primary font-semibold">
                    {multiplicador}x {selectedItem.nome}
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notas">Observações (opcional)</Label>
              <Textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Anotações sobre este mapeamento..."
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedItemId || addMapping.isPending}
          >
            Salvar Mapeamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
