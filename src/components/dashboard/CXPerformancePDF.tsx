import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { type ActionPlan } from "@/hooks/useActionPlans";
import type { Reclamacao } from "@/hooks/useReclamacoes";
import { useState } from "react";

interface CXPerformancePDFProps {
  lojaId: string | null;
  lojaNome: string;
  reclamacoes: Reclamacao[];
  actionPlans: ActionPlan[];
}

export function CXPerformancePDF({
  lojaId,
  lojaNome,
  reclamacoes,
  actionPlans,
}: CXPerformancePDFProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const stats = useMemo(() => {
    const total = reclamacoes.length;
    const graves = reclamacoes.filter((r) => r.is_grave).length;
    const salao = reclamacoes.filter((r) => r.tipo_operacao === "salao").length;
    const delivery = reclamacoes.filter((r) => r.tipo_operacao === "delivery").length;

    const pending = actionPlans.filter((ap) => ap.status === "pending").length;
    const inAnalysis = actionPlans.filter((ap) => ap.status === "in_analysis").length;
    const resolved = actionPlans.filter((ap) => ap.status === "resolved").length;

    const resolutionRate = actionPlans.length > 0 
      ? Math.round((resolved / actionPlans.length) * 100) 
      : 0;

    return { total, graves, salao, delivery, pending, inAnalysis, resolved, resolutionRate };
  }, [reclamacoes, actionPlans]);

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const currentDate = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
      const fileName = `Performance_CX_${lojaNome.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM")}.pdf`;

      // Header with logo
      try {
        doc.addImage(LOGO_BASE64, "PNG", 14, 10, 40, 15);
      } catch (e) {
        console.warn("Logo not loaded", e);
      }

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DE PERFORMANCE CX", 105, 20, { align: "center" });

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(lojaNome.toUpperCase(), 105, 28, { align: "center" });
      doc.text(currentDate.toUpperCase(), 105, 34, { align: "center" });

      // Summary Section
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("RESUMO EXECUTIVO", 14, 48);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const summaryData = [
        ["Total de Reclamações", String(stats.total)],
        ["Reclamações Graves", String(stats.graves)],
        ["Salão", String(stats.salao)],
        ["Delivery", String(stats.delivery)],
        ["", ""],
        ["Planos Pendentes", String(stats.pending)],
        ["Em Análise", String(stats.inAnalysis)],
        ["Resolvidos", String(stats.resolved)],
        ["Taxa de Resolução", `${stats.resolutionRate}%`],
      ];

      autoTable(doc, {
        startY: 52,
        head: [["Métrica", "Valor"]],
        body: summaryData,
        theme: "striped",
        headStyles: { fillColor: [220, 38, 38] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 40, halign: "center" },
        },
      });

      // Reclamações Table
      const tableY = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DETALHAMENTO DE RECLAMAÇÕES", 14, tableY);

      const reclamacoesData = reclamacoes.slice(0, 20).map((rec) => [
        format(new Date(rec.data_reclamacao), "dd/MM"),
        rec.fonte.toUpperCase(),
        rec.tipo_operacao.toUpperCase(),
        String(rec.nota_reclamacao),
        rec.is_grave ? "GRAVE" : "NORMAL",
        (rec.resumo_ia || rec.texto_original || "—").substring(0, 50) + "...",
      ]);

      autoTable(doc, {
        startY: tableY + 4,
        head: [["Data", "Fonte", "Tipo", "Nota", "Status", "Resumo"]],
        body: reclamacoesData,
        theme: "striped",
        headStyles: { fillColor: [220, 38, 38] },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 12, halign: "center" },
          4: { cellWidth: 18 },
          5: { cellWidth: "auto" },
        },
      });

      // Action Plans Table
      if (actionPlans.length > 0) {
        const plansY = (doc as any).lastAutoTable.finalY + 10;

        // Check if we need a new page
        if (plansY > 250) {
          doc.addPage();
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text("PLANOS DE AÇÃO", 14, 20);

          const plansData = actionPlans.slice(0, 15).map((plan) => [
            plan.pain_tag,
            plan.status === "pending"
              ? "PENDENTE"
              : plan.status === "in_analysis"
              ? "EM ANÁLISE"
              : "RESOLVIDO",
            (plan.causa_raiz || "—").substring(0, 40),
            (plan.medida_tomada || "—").substring(0, 40),
          ]);

          autoTable(doc, {
            startY: 24,
            head: [["Dor", "Status", "Causa Raiz", "Medida"]],
            body: plansData,
            theme: "striped",
            headStyles: { fillColor: [220, 38, 38] },
            styles: { fontSize: 8 },
          });
        } else {
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text("PLANOS DE AÇÃO", 14, plansY);

          const plansData = actionPlans.slice(0, 10).map((plan) => [
            plan.pain_tag,
            plan.status === "pending"
              ? "PENDENTE"
              : plan.status === "in_analysis"
              ? "EM ANÁLISE"
              : "RESOLVIDO",
            (plan.causa_raiz || "—").substring(0, 40),
            (plan.medida_tomada || "—").substring(0, 40),
          ]);

          autoTable(doc, {
            startY: plansY + 4,
            head: [["Dor", "Status", "Causa Raiz", "Medida"]],
            body: plansData,
            theme: "striped",
            headStyles: { fillColor: [220, 38, 38] },
            styles: { fontSize: 8 },
          });
        }
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} • Página ${i} de ${pageCount}`,
          105,
          290,
          { align: "center" }
        );
      }

      // Save
      doc.save(fileName);

      toast({
        title: "PDF gerado com sucesso!",
        description: fileName,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={generatePDF} disabled={isGenerating}>
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <FileDown className="h-4 w-4 mr-2" />
      )}
      Gerar PDF CX
    </Button>
  );
}
