import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { FreelancerCheckin } from "@/hooks/useFreelancerCheckins";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  checkins: FreelancerCheckin[];
  date: string;
  unitName: string;
}

export function CheckinPaymentOrder({ checkins, date, unitName }: Props) {
  const generatePdf = () => {
    const doc = new jsPDF();
    const dateFormatted = format(new Date(date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });

    doc.setFontSize(16);
    doc.text("Ordem de Pagamento — Freelancers", 14, 20);
    doc.setFontSize(10);
    doc.text(`Unidade: ${unitName || "—"} | Data: ${dateFormatted}`, 14, 28);

    const rows = checkins.map((c) => [
      c.freelancer_profiles?.nome_completo || "—",
      c.freelancer_profiles?.cpf || "—",
      format(new Date(c.checkin_at), "HH:mm"),
      c.checkout_at ? format(new Date(c.checkout_at), "HH:mm") : "—",
      `R$ ${(c.valor_aprovado ?? 0).toFixed(2)}`,
    ]);

    const total = checkins.reduce((sum, c) => sum + (c.valor_aprovado ?? 0), 0);

    autoTable(doc, {
      startY: 34,
      head: [["Nome", "CPF", "Entrada", "Saída", "Valor Aprovado"]],
      body: rows,
      foot: [["", "", "", "TOTAL", `R$ ${total.toFixed(2)}`]],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`ordem-pagamento-${date}.pdf`);
  };

  if (checkins.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum registro com presença e valor aprovados para gerar ordem de pagamento.
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
          {checkins.length} freelancer(s) aprovados — Total: R$ {checkins.reduce((s, c) => s + (c.valor_aprovado ?? 0), 0).toFixed(2)}
        </p>
        <Button onClick={generatePdf} className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" /> Gerar PDF
        </Button>
      </CardContent>
    </Card>
  );
}
