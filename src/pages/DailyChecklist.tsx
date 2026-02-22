import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, MessageSquare, MessageCircle, Loader2, Send, ChevronDown, ChevronUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { SECTOR_POSITION_MAP, type AuditSector } from "@/lib/sectorPositionMapping";
import logoImg from "@/assets/grupo-caju-logo.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { PDF_COLORS, PDF_LAYOUT, addPageFooter } from "@/lib/pdf/grupoCajuPdfTheme";

interface ChecklistItem {
  id: string;
  item_text: string;
  item_order: number;
  weight: number;
  original_category: string | null;
}

interface ItemResponse {
  template_item_id: string;
  is_conforming: boolean | null;
  observation: string;
  photo_url: string | null;
}

type SubmitResult = {
  total_score: number;
  total_items: number;
  conforming_items: number;
  sector_code: string;
  loja_name: string;
};

export default function DailyChecklist() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondedByName, setRespondedByName] = useState("");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [responses, setResponses] = useState<Record<string, ItemResponse>>({});
  const [expandedObs, setExpandedObs] = useState<Record<string, boolean>>({});
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [existingScore, setExistingScore] = useState<number | null>(null);

  const [linkId, setLinkId] = useState("");
  const [lojaName, setLojaName] = useState("");
  const [sectorCode, setSectorCode] = useState("");

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    fetchChecklist();
  }, [accessToken]);

  async function fetchChecklist() {
    try {
      setLoading(true);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-daily-checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch", access_token: accessToken }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Link inválido");
        return;
      }
      const { data } = json;
      setLinkId(data.link_id);
      setLojaName(data.loja_name);
      setSectorCode(data.sector_code);
      setItems(data.items);
      setAlreadySubmitted(data.already_submitted);
      setExistingScore(data.existing_score);

      const initial: Record<string, ItemResponse> = {};
      data.items.forEach((item: ChecklistItem) => {
        initial[item.id] = {
          template_item_id: item.id,
          is_conforming: null,
          observation: "",
          photo_url: null,
        };
      });
      setResponses(initial);
    } catch (err) {
      setError("Erro ao carregar checklist");
    } finally {
      setLoading(false);
    }
  }

  const answeredCount = useMemo(() => {
    return Object.values(responses).filter((r) => r.is_conforming !== null).length;
  }, [responses]);

  const progressPercent = items.length > 0 ? (answeredCount / items.length) * 100 : 0;
  const allAnswered = answeredCount === items.length && items.length > 0;

  const sectorDisplayName = SECTOR_POSITION_MAP[sectorCode as AuditSector]?.displayName || sectorCode;
  const today = format(new Date(), "dd 'de' MMMM, yyyy (EEEE)", { locale: ptBR });

  function setAnswer(itemId: string, conforming: boolean) {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], is_conforming: conforming },
    }));
  }

  function setObservation(itemId: string, obs: string) {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], observation: obs },
    }));
  }

  function toggleObs(itemId: string) {
    setExpandedObs((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  async function handleSubmit() {
    if (!respondedByName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }
    if (!allAnswered) {
      toast.error("Responda todos os itens antes de enviar");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-daily-checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          access_token: accessToken,
          responded_by_name: respondedByName.trim(),
          responses: Object.values(responses).map((r) => ({
            template_item_id: r.template_item_id,
            is_conforming: r.is_conforming,
            observation: r.observation || null,
            photo_url: r.photo_url || null,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Erro ao enviar checklist");
        return;
      }
      setSubmitResult(json.data);
    } catch {
      toast.error("Erro ao enviar checklist");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-4">
        <XCircle className="h-16 w-16 text-destructive" />
        <h1 className="text-xl font-bold">Link Inválido</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  function generateChecklistPDF(result: SubmitResult): jsPDF {
    const doc = new jsPDF("p", "mm", "a4");
    const margin = PDF_LAYOUT.margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    const dateStr = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const nonConforming = result.total_items - result.conforming_items;
    const scoreColor = result.total_score >= 90 ? PDF_COLORS.success : result.total_score >= 70 ? PDF_COLORS.warning : PDF_COLORS.danger;

    // Logo
    try {
      doc.addImage(LOGO_BASE64, "JPEG", centerX - 18, 12, 36, 25);
    } catch { /* fallback */ }

    // Institutional line
    doc.setDrawColor(...PDF_COLORS.institutional);
    doc.setLineWidth(1);
    doc.line(margin, 42, pageWidth - margin, 42);

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...PDF_COLORS.institutional);
    doc.text("Checklist Diário", centerX, 54, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...PDF_COLORS.graphite);
    doc.text(`${sectorDisplayName} — ${result.loja_name}`, centerX, 62, { align: "center" });

    // Info block
    let y = 74;
    doc.setFillColor(...PDF_COLORS.gray50);
    doc.setDrawColor(...PDF_COLORS.gray200);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text("APLICADO POR", margin + 6, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.graphite);
    doc.text(respondedByName, margin + 6, y + 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text("DATA", pageWidth - margin - 6, y + 8, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.graphite);
    doc.text(dateStr, pageWidth - margin - 6, y + 16, { align: "right" });

    // Score summary boxes
    y = 104;
    const boxW = (pageWidth - margin * 2 - 16) / 3;
    const boxH = 30;

    // Score box
    doc.setFillColor(...PDF_COLORS.white);
    doc.setDrawColor(...scoreColor);
    doc.setLineWidth(1.5);
    doc.roundedRect(margin, y, boxW, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text("NOTA", margin + boxW / 2, y + 9, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...scoreColor);
    doc.text(`${result.total_score.toFixed(0)}%`, margin + boxW / 2, y + 23, { align: "center" });

    // Conformes box
    const box2X = margin + boxW + 8;
    doc.setDrawColor(...PDF_COLORS.success);
    doc.roundedRect(box2X, y, boxW, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text("CONFORMES", box2X + boxW / 2, y + 9, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...PDF_COLORS.success);
    doc.text(String(result.conforming_items), box2X + boxW / 2, y + 23, { align: "center" });

    // Não conformes box
    const box3X = margin + (boxW + 8) * 2;
    doc.setDrawColor(...PDF_COLORS.danger);
    doc.roundedRect(box3X, y, boxW, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text("NÃO CONFORMES", box3X + boxW / 2, y + 9, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...PDF_COLORS.danger);
    doc.text(String(nonConforming), box3X + boxW / 2, y + 23, { align: "center" });

    // Items table
    y = 142;
    const tableData = items.map((item, idx) => {
      const resp = responses[item.id];
      const conformeText = resp?.is_conforming === true ? "Conforme" : resp?.is_conforming === false ? "Não Conforme" : "—";
      return [String(idx + 1), item.item_text, conformeText, resp?.observation || ""];
    });

    autoTable(doc, {
      startY: y,
      head: [["#", "Item", "Resultado", "Observação"]],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3, textColor: PDF_COLORS.graphite },
      headStyles: {
        fillColor: PDF_COLORS.institutional,
        textColor: PDF_COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 80 },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 52 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          if (data.cell.raw === "Não Conforme") {
            data.cell.styles.textColor = PDF_COLORS.danger;
            data.cell.styles.fontStyle = "bold";
          } else if (data.cell.raw === "Conforme") {
            data.cell.styles.textColor = PDF_COLORS.success;
          }
        }
      },
    });

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(doc, i, totalPages);
    }

    return doc;
  }

  function handleDownloadPDF(result: SubmitResult) {
    const doc = generateChecklistPDF(result);
    const fileName = `Checklist_${sectorDisplayName}_${result.loja_name}_${format(new Date(), "dd-MM-yyyy")}.pdf`;
    doc.save(fileName);
    toast.success("PDF baixado com sucesso!");
  }

  function handleWhatsAppPDF(result: SubmitResult) {
    // Download the PDF first
    handleDownloadPDF(result);

    // Open WhatsApp with summary message
    const scoreEmoji = result.total_score >= 90 ? "🟢" : result.total_score >= 70 ? "🟡" : "🔴";
    const nonConforming = result.total_items - result.conforming_items;
    let text = `📋 *Checklist Diário — ${sectorDisplayName}*\n`;
    text += `🏪 ${result.loja_name} • ${format(new Date(), "dd/MM/yyyy")}\n`;
    text += `${scoreEmoji} *Nota: ${result.total_score.toFixed(0)}%*\n`;
    text += `✅ ${result.conforming_items} conformes | ❌ ${nonConforming} não conformes\n\n`;
    text += `📎 _O PDF completo foi baixado. Por favor, anexe-o a esta conversa._`;

    setTimeout(() => {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }, 500);
  }

  if (submitResult) {
    const scoreColor = submitResult.total_score >= 90 ? "text-green-600" : submitResult.total_score >= 70 ? "text-yellow-600" : "text-red-600";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-6">
        <img src={logoImg} alt="Logo" className="h-16 object-contain" />
        <CheckCircle2 className="h-20 w-20 text-green-600" />
        <h1 className="text-2xl font-bold">Checklist Enviado!</h1>
        <div className={`text-5xl font-bold ${scoreColor}`}>
          {submitResult.total_score.toFixed(0)}%
        </div>
        <p className="text-lg font-medium">
          {sectorDisplayName} — {submitResult.loja_name}
        </p>
        <p className="text-muted-foreground">{format(new Date(), "dd/MM/yyyy")}</p>
        <div className="flex gap-8 text-sm">
          <div>
            <span className="font-bold text-green-600">{submitResult.conforming_items}</span>
            <span className="text-muted-foreground"> conformes</span>
          </div>
          <div>
            <span className="font-bold text-red-600">{submitResult.total_items - submitResult.conforming_items}</span>
            <span className="text-muted-foreground"> não conformes</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
          <Button
            className="gap-2"
            variant="outline"
            onClick={() => handleDownloadPDF(submitResult)}
          >
            <Download className="h-5 w-5" />
            Baixar PDF do Resultado
          </Button>
          <Button
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleWhatsAppPDF(submitResult)}
          >
            <MessageCircle className="h-5 w-5" />
            Enviar PDF por WhatsApp
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mt-2">Obrigado pela aplicação!</p>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-6">
        <img src={logoImg} alt="Logo" className="h-16 object-contain" />
        <CheckCircle2 className="h-16 w-16 text-green-600" />
        <h1 className="text-xl font-bold">Checklist já aplicado hoje</h1>
        {existingScore !== null && (
          <div className="text-4xl font-bold text-primary">{existingScore.toFixed(0)}%</div>
        )}
        <p className="text-muted-foreground">
          {sectorDisplayName} — {lojaName}<br />{today}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Logo" className="h-10 object-contain" />
          <div>
            <h1 className="text-lg font-bold uppercase">Checklist Diário — {sectorDisplayName}</h1>
            <p className="text-xs text-muted-foreground">{lojaName} • {today}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Name */}
        <div>
          <label className="text-sm font-medium mb-1 block">Seu nome</label>
          <Input
            placeholder="Nome de quem está aplicando"
            value={respondedByName}
            onChange={(e) => setRespondedByName(e.target.value)}
          />
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progresso: {answeredCount}/{items.length} itens</span>
            <span>{progressPercent.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Items */}
        <div className="space-y-3">
          {items.map((item, idx) => {
            const resp = responses[item.id];
            const isYes = resp?.is_conforming === true;
            const isNo = resp?.is_conforming === false;
            const showObs = expandedObs[item.id];

            return (
              <Card key={item.id} className="p-4 space-y-3">
                <div className="flex gap-2">
                  <span className="text-sm font-bold text-muted-foreground min-w-[28px]">{idx + 1}.</span>
                  <p className="text-sm font-medium flex-1">{item.item_text}</p>
                </div>

                {item.weight !== 1 && (
                  <span className="text-xs text-muted-foreground ml-8">Peso: {item.weight}</span>
                )}

                <div className="flex items-center gap-2 ml-8">
                  <Button
                    type="button"
                    size="sm"
                    variant={isYes ? "default" : "outline"}
                    className={`gap-1.5 ${isYes ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                    onClick={() => setAnswer(item.id, true)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    SIM
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isNo ? "default" : "outline"}
                    className={`gap-1.5 ${isNo ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                    onClick={() => setAnswer(item.id, false)}
                  >
                    <XCircle className="h-4 w-4" />
                    NÃO
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto gap-1"
                    onClick={() => toggleObs(item.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {showObs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>

                {showObs && (
                  <div className="ml-8">
                    <Textarea
                      placeholder="Observação (opcional)"
                      className="text-sm h-16"
                      value={resp?.observation || ""}
                      onChange={(e) => setObservation(item.id, e.target.value)}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Submit footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-lg mx-auto">
          <Button
            className="w-full gap-2 h-12 text-base"
            disabled={!allAnswered || !respondedByName.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            Enviar Checklist
          </Button>
        </div>
      </div>
    </div>
  );
}
