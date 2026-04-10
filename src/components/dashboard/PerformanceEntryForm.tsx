import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, TrendingUp, DollarSign, MessageSquareWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, parseCurrencyInput, formatCurrencyInput } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { usePerformanceEntries, type PerformanceEntryInput } from "@/hooks/usePerformanceEntries";

interface PerformanceEntryFormProps {
  selectedUnidadeId?: string | null;
}

export function PerformanceEntryForm({ selectedUnidadeId }: PerformanceEntryFormProps) {
  const { options: lojas } = useConfigLojas();
  const { addEntry } = usePerformanceEntries();

  const [selectedLojaId, setSelectedLojaId] = useState<string>(selectedUnidadeId || "");
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [faturamentoSalaoDisplay, setFaturamentoSalaoDisplay] = useState("");
  const [faturamentoDeliveryDisplay, setFaturamentoDeliveryDisplay] = useState("");
  const [reclamacoesSalao, setReclamacoesSalao] = useState("");
  const [reclamacoesIfood, setReclamacoesIfood] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFaturamentoSalaoChange = (value: string) => {
    setFaturamentoSalaoDisplay(formatCurrencyInput(value));
  };

  const handleFaturamentoDeliveryChange = (value: string) => {
    setFaturamentoDeliveryDisplay(formatCurrencyInput(value));
  };

  const resetForm = () => {
    setFaturamentoSalaoDisplay("");
    setFaturamentoDeliveryDisplay("");
    setReclamacoesSalao("");
    setReclamacoesIfood("");
    setNotes("");
    setEntryDate(new Date());
  };

  const handleSubmit = async () => {
    if (!selectedLojaId) return;

    setIsSubmitting(true);

    const input: PerformanceEntryInput = {
      loja_id: selectedLojaId,
      entry_date: format(entryDate, "yyyy-MM-dd"),
      faturamento_salao: parseCurrencyInput(faturamentoSalaoDisplay),
      faturamento_delivery: parseCurrencyInput(faturamentoDeliveryDisplay),
      reclamacoes_salao: parseInt(reclamacoesSalao) || 0,
      reclamacoes_ifood: parseInt(reclamacoesIfood) || 0,
      notes: notes || undefined,
    };

    try {
      await addEntry.mutateAsync(input);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = selectedLojaId && (
    parseCurrencyInput(faturamentoSalaoDisplay) > 0 || 
    parseCurrencyInput(faturamentoDeliveryDisplay) > 0
  );

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardTitle className="flex items-center gap-2 text-base uppercase">
          <TrendingUp className="h-5 w-5 text-primary" />
          Lançar Performance Semanal
        </CardTitle>
        <CardDescription>
          Adicione dados de faturamento e reclamações. Os valores serão acumulados automaticamente para o mês.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Store Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium uppercase">Unidade</Label>
            <Select value={selectedLojaId} onValueChange={setSelectedLojaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {lojas.map((loja) => (
                  <SelectItem key={loja.id} value={loja.id}>
                    {loja.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entry Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium uppercase">Data de Referência</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !entryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {entryDate ? format(entryDate, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={entryDate}
                  onSelect={(date) => date && setEntryDate(date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Faturamento Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium uppercase flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              Faturamento Salão
            </Label>
            <Input
              type="text"
              placeholder="R$ 0,00"
              value={faturamentoSalaoDisplay}
              onChange={(e) => handleFaturamentoSalaoChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium uppercase flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-sky-500" />
              Faturamento Delivery
            </Label>
            <Input
              type="text"
              placeholder="R$ 0,00"
              value={faturamentoDeliveryDisplay}
              onChange={(e) => handleFaturamentoDeliveryChange(e.target.value)}
            />
          </div>
        </div>

        {/* Reclamações Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium uppercase flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-amber-500" />
              Reclamações Salão
            </Label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={reclamacoesSalao}
              onChange={(e) => setReclamacoesSalao(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium uppercase flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-sky-500" />
              Reclamações iFood
            </Label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={reclamacoesIfood}
              onChange={(e) => setReclamacoesIfood(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label className="text-sm font-medium uppercase">Observações (opcional)</Label>
          <Textarea
            placeholder="Ex: Semana 1 de janeiro, período de férias escolares..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {isSubmitting ? "Salvando..." : "Adicionar Lançamento"}
        </Button>

        {/* Info Text */}
        <p className="text-xs text-muted-foreground text-center">
          Você pode lançar dados várias vezes por semana. O sistema soma automaticamente para gerar o ranking mensal atualizado.
        </p>
      </CardContent>
    </Card>
  );
}
