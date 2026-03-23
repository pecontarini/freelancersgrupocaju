import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, AlertCircle } from "lucide-react";
import { useCheckinBudgetEntries, CheckinBudgetEntry } from "@/hooks/useCheckinBudgetEntries";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  lojaId: string;
  date: string;
  unitName: string;
  pendingApprovalCount?: number;
}

export function CheckinPaymentOrder({ lojaId, date, unitName, pendingApprovalCount = 0 }: Props) {
  const monthYear = date.slice(0, 7);
  const { entries } = useCheckinBudgetEntries(lojaId || undefined, monthYear);

  // Filter entries for the specific date
  const dayEntries = entries.filter((e) => e.data_servico === date);

  const generatePdf = () => {
    const doc = new jsPDF();
    const dateFormatted = format(new Date(date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });

    doc.setFontSize(16);
    doc.text("Ordem de Pagamento — Freelancers", 14, 20);
    doc.setFontSize(10);
    doc.text(`Unidade: ${unitName || "—"} | Data: ${dateFormatted}`, 14, 28);

    const rows = dayEntries.map((e) => [
      e.freelancer_name,
      e.cpf,
      e.tipo_chave_pix ? `${e.tipo_chave_pix}: ${e.chave_pix || "—"}` : "—",
      e.checkin_at ? format(new Date(e.checkin_at), "HH:mm") : "—",
      e.checkout_at ? format(new Date(e.checkout_at), "HH:mm") : "—",
      `R$ ${e.valor.toFixed(2)}`,
    ]);

    const total = dayEntries.reduce((sum, e) => sum + e.valor, 0);

    autoTable(doc, {
      startY: 34,
      head: [["Nome", "CPF", "Chave Pix", "Entrada", "Saída", "Valor Aprovado"]],
      body: rows,
      foot: [["", "", "", "", "TOTAL", `R$ ${total.toFixed(2)}`]],
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`ordem-pagamento-${date}.pdf`);
  };

  if (pendingApprovalCount > 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
          <p className="text-sm font-medium text-foreground">
            Existem {pendingApprovalCount} registro(s) pendentes de aprovação.
          </p>
          <p className="text-xs text-muted-foreground">
            A ordem de pagamento só pode ser gerada após o gestor assinar a lista de presença.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (dayEntries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum registro promovido ao budget para gerar ordem de pagamento nesta data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ordem de Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {dayEntries.length} freelancer(s) no budget — Total: R$ {dayEntries.reduce((s, e) => s + e.valor, 0).toFixed(2)}
        </p>
        <Button onClick={generatePdf} className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" /> Gerar PDF
        </Button>
      </CardContent>
    </Card>
  );
}
