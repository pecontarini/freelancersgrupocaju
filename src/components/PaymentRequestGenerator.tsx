import { useState } from "react";
import { Copy, FileText, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { FreelancerEntry } from "@/types/freelancer";
import { formatCurrency, formatDate, parseDateString } from "@/lib/formatters";

interface PaymentRequestGeneratorProps {
  entries: FreelancerEntry[];
}

interface GroupedData {
  [lojaDate: string]: {
    loja: string;
    date: string;
    entries: FreelancerEntry[];
    total: number;
  };
}

interface FuncaoTotals {
  [funcao: string]: {
    total: number;
    count: number;
  };
}

export function PaymentRequestGenerator({ entries }: PaymentRequestGeneratorProps) {
  const [copied, setCopied] = useState(false);

  // Group entries by loja and date
  const groupedData = entries.reduce<GroupedData>((acc, entry) => {
    const key = `${entry.loja}_${entry.data_pop}`;
    
    if (!acc[key]) {
      acc[key] = {
        loja: entry.loja,
        date: entry.data_pop,
        entries: [],
        total: 0,
      };
    }
    
    acc[key].entries.push(entry);
    acc[key].total += entry.valor;
    
    return acc;
  }, {});

  // Calculate totals by funcao
  const funcaoTotals = entries.reduce<FuncaoTotals>((acc, entry) => {
    if (!acc[entry.funcao]) {
      acc[entry.funcao] = { total: 0, count: 0 };
    }
    acc[entry.funcao].total += entry.valor;
    acc[entry.funcao].count += 1;
    return acc;
  }, {});

  const generateRequestText = () => {
    const groups = Object.values(groupedData).sort((a, b) => {
      const dateCompare = parseDateString(b.date).getTime() - parseDateString(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.loja.localeCompare(b.loja);
    });

    let text = "";
    let grandTotal = 0;

    groups.forEach((group, groupIndex) => {
      const formattedDate = formatDate(group.date);
      
      text += `📋 *Requisição de Pagamento*\n`;
      text += `📍 Loja: ${group.loja}\n`;
      text += `📅 Data: ${formattedDate}\n`;
      text += `${"─".repeat(40)}\n\n`;

      group.entries.forEach((entry, index) => {
        text += `${index + 1}. ${entry.nome_completo} | Função: ${entry.funcao} | CPF: ${entry.cpf} | PIX: ${entry.chave_pix} | Valor: ${formatCurrency(entry.valor)}\n`;
      });

      text += `\n${"─".repeat(40)}\n`;
      text += `💰 *Subtotal: ${formatCurrency(group.total)}*\n\n`;
      
      grandTotal += group.total;

      if (groupIndex < groups.length - 1) {
        text += "\n";
      }
    });

    // Add totals by funcao
    if (Object.keys(funcaoTotals).length > 0) {
      text += `${"═".repeat(40)}\n`;
      text += `📊 *Subtotal por Função:*\n`;
      
      Object.entries(funcaoTotals)
        .sort((a, b) => b[1].total - a[1].total)
        .forEach(([funcao, data]) => {
          text += `  • ${funcao}: ${formatCurrency(data.total)} (${data.count} lançamento${data.count > 1 ? 's' : ''})\n`;
        });
      
      text += `${"═".repeat(40)}\n`;
    }

    text += `💵 *TOTAL GERAL: ${formatCurrency(grandTotal)}*\n`;

    return text;
  };

  const handleCopy = async () => {
    const text = generateRequestText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Requisição copiada para a área de transferência!");
    
    setTimeout(() => setCopied(false), 2000);
  };

  const totalGeral = entries.reduce((sum, e) => sum + e.valor, 0);

  if (entries.length === 0) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <FileText className="h-4 w-4" />
          Gerar Modelo de Requisição
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Modelo de Requisição de Pagamento
          </DialogTitle>
          <DialogDescription>
            Copie o texto abaixo para enviar via WhatsApp ou E-mail
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-4">
          <Card className="bg-muted/50">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Resumo</span>
                <span className="text-primary">{formatCurrency(totalGeral)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0 pb-3">
              <div className="text-xs text-muted-foreground">
                {entries.length} lançamento(s) • {Object.keys(groupedData).length} grupo(s) • {Object.keys(funcaoTotals).length} função(ões)
              </div>
            </CardContent>
          </Card>

          <div className="flex-1 overflow-hidden">
            <Textarea
              value={generateRequestText()}
              readOnly
              className="h-full min-h-[300px] resize-none font-mono text-sm"
            />
          </div>

          <Button onClick={handleCopy} className="w-full gap-2">
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar para Área de Transferência
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
