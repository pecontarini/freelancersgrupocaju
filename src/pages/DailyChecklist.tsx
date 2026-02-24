import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, MessageSquare, MessageCircle, Loader2, Send, ChevronDown, ChevronUp, Download, Camera, ImageIcon } from "lucide-react";
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
import { PDF_COLORS, PDF_LAYOUT, addPageFooter, addContinuationHeader } from "@/lib/pdf/grupoCajuPdfTheme";
import { addChecklistCover, addPhotoEvidenceSection, type PhotoItem } from "@/lib/pdf/checklistPdfHelpers";


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
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);

  const [linkId, setLinkId] = useState("");
  const [lojaName, setLojaName] = useState("");
  const [sectorCode, setSectorCode] = useState("");
  const [templateName, setTemplateName] = useState("");

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
      setTemplateName(data.template_name || "");
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

  const photosCount = useMemo(() => {
    return Object.values(responses).filter((r) => r.photo_url).length;
  }, [responses]);

  const progressPercent = items.length > 0 ? (answeredCount / items.length) * 100 : 0;
  const allAnswered = answeredCount === items.length && items.length > 0;

  // Check that all non-conforming items have an observation
  const allNonConformingHaveObs = useMemo(() => {
    return Object.values(responses).every(
      (r) => r.is_conforming !== false || (r.observation && r.observation.trim().length > 0)
    );
  }, [responses]);

  // Check that all non-conforming items have a photo
  const allNonConformingHavePhoto = useMemo(() => {
    return Object.values(responses).every(
      (r) => r.is_conforming !== false || (r.photo_url && r.photo_url.length > 0)
    );
  }, [responses]);

  const canSubmit = allAnswered && allNonConformingHaveObs && allNonConformingHavePhoto && respondedByName.trim().length > 0;

  const sectorDisplayName = SECTOR_POSITION_MAP[sectorCode as AuditSector]?.displayName || sectorCode;
  const today = format(new Date(), "dd 'de' MMMM, yyyy (EEEE)", { locale: ptBR });

  function setAnswer(itemId: string, conforming: boolean) {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], is_conforming: conforming },
    }));
    // Auto-expand observation when marking as non-conforming
    if (!conforming) {
      setExpandedObs((prev) => ({ ...prev, [itemId]: true }));
    }
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

  async function handlePhotoUpload(itemId: string, file: File) {
    try {
      setUploadingPhoto(itemId);

      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data:...;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-daily-checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload-photo",
          access_token: accessToken,
          file_base64: base64,
          file_name: file.name,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Erro ao enviar foto");
        return;
      }

      setResponses((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], photo_url: json.data.public_url },
      }));

      toast.success("Foto anexada!");
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploadingPhoto(null);
    }
  }

  function triggerFileInput(itemId: string) {
    fileInputRefs.current[itemId]?.click();
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
    if (!allNonConformingHaveObs) {
      toast.error("Preencha a observação em todos os itens marcados como NÃO");
      return;
    }
    if (!allNonConformingHavePhoto) {
      toast.error("Anexe uma foto em todos os itens marcados como NÃO");
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

  async function generateChecklistPDF(result: SubmitResult): Promise<jsPDF> {
    const doc = new jsPDF("p", "mm", "a4");
    const margin = PDF_LAYOUT.margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const dateStr = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const nonConforming = result.total_items - result.conforming_items;

    // === PAGE 1: EXECUTIVE COVER ===
    addChecklistCover(doc, {
      title: "Checklist Diário",
      subtitle: `${sectorDisplayName} — ${result.loja_name}`,
      sectorName: sectorDisplayName,
      unitName: result.loja_name,
      appliedBy: respondedByName,
      date: dateStr,
      templateName: templateName || undefined,
      score: result.total_score,
      conforming: result.conforming_items,
      nonConforming,
    });

    // === PAGE 2+: RESULTS TABLE ===
    doc.addPage();
    let y = addContinuationHeader(doc, "Resultado do Checklist");

    const tableData = items.map((item, idx) => {
      const resp = responses[item.id];
      const conformeText = resp?.is_conforming === true ? "✓" : resp?.is_conforming === false ? "✗" : "—";
      return [String(idx + 1), item.item_text, conformeText, resp?.observation || ""];
    });

    autoTable(doc, {
      startY: y,
      head: [["#", "Item", "Status", "Observação"]],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3.5, textColor: PDF_COLORS.graphite },
      headStyles: {
        fillColor: PDF_COLORS.institutional,
        textColor: PDF_COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: PDF_COLORS.gray50,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 80 },
        2: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 62 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          if (data.cell.raw === "✗") {
            data.cell.styles.textColor = PDF_COLORS.danger;
            data.cell.styles.fontSize = 12;
          } else if (data.cell.raw === "✓") {
            data.cell.styles.textColor = PDF_COLORS.success;
            data.cell.styles.fontSize = 12;
          }
        }
      },
    });

    // === PHOTO EVIDENCE SECTION ===
    const ncItems = items.filter((item) => {
      const resp = responses[item.id];
      return resp?.is_conforming === false && resp?.photo_url;
    });

    if (ncItems.length > 0) {
      const photoY = (doc as any).lastAutoTable?.finalY ?? 200;
      const photos: PhotoItem[] = ncItems.map((item) => {
        const resp = responses[item.id];
        return {
          itemText: item.item_text,
          photoUrl: resp.photo_url!,
          observation: resp.observation || undefined,
        };
      });

      await addPhotoEvidenceSection(doc, photoY + 12, photos);
    }

    // === FOOTER on all pages ===
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(doc, i, totalPages);
    }

    return doc;
  }

  async function handleDownloadPDF(result: SubmitResult) {
    const doc = await generateChecklistPDF(result);
    const fileName = `Checklist_${sectorDisplayName}_${result.loja_name}_${format(new Date(), "dd-MM-yyyy")}.pdf`;
    doc.save(fileName);
    toast.success("PDF baixado com sucesso!");
  }

  async function handleWhatsAppPDF(result: SubmitResult) {
    await handleDownloadPDF(result);
    const scoreEmoji = result.total_score >= 90 ? "🟢" : result.total_score >= 70 ? "🟡" : "🔴";
    const nonConforming = result.total_items - result.conforming_items;
    let text = `📋 *Checklist Diário — ${sectorDisplayName}*\n`;
    if (templateName) text += `📄 *${templateName}*\n`;
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
        {templateName && (
          <p className="text-sm text-muted-foreground">📄 {templateName}</p>
        )}
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
            <p className="text-xs text-muted-foreground">
              {lojaName} • {today}
              {templateName && ` • 📄 ${templateName}`}
            </p>
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
            const hasPhoto = !!resp?.photo_url;
            const isUploading = uploadingPhoto === item.id;

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

                {/* Photo upload (optional) */}
                {(showObs || isNo) && (
                  <div className="ml-8 space-y-2">
                    <Textarea
                      placeholder={isNo ? "Descreva o problema encontrado *" : "Observação (opcional)"}
                      className={`text-sm h-16 ${isNo && !(resp?.observation?.trim()) ? "border-red-400" : ""}`}
                      value={resp?.observation || ""}
                      onChange={(e) => setObservation(item.id, e.target.value)}
                    />
                    {isNo && !(resp?.observation?.trim()) && (
                      <p className="text-xs text-red-500">⚠ Observação obrigatória para itens não conformes</p>
                    )}
                    
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[item.id] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(item.id, file);
                          e.target.value = "";
                        }}
                      />
                      {hasPhoto ? (
                        <div className="relative">
                          <img
                            src={resp.photo_url!}
                            alt="Foto do item"
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="absolute bottom-2 right-2 gap-1 h-7 text-xs"
                            onClick={() => triggerFileInput(item.id)}
                          >
                            <Camera className="h-3 w-3" />
                            Trocar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`gap-2 ${isNo && !hasPhoto ? "border-red-400 text-red-600" : ""}`}
                          onClick={() => triggerFileInput(item.id)}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Camera className="h-4 w-4" />
                              <span className="text-xs">{isNo ? "Anexar foto *" : "Anexar foto (opcional)"}</span>
                            </>
                          )}
                        </Button>
                      )}
                      {isNo && !hasPhoto && (
                        <p className="text-xs text-red-500">⚠ Foto obrigatória para itens não conformes</p>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Submit footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-lg mx-auto space-y-1">
          {!canSubmit && items.length > 0 && (
            <p className="text-xs text-center text-muted-foreground">
              {!allAnswered && `Responda todos os ${items.length} itens. `}
              {!allNonConformingHaveObs && "Preencha observação nos itens NÃO. "}
              {!allNonConformingHavePhoto && "Anexe foto nos itens NÃO. "}
              {!respondedByName.trim() && "Informe seu nome."}
            </p>
          )}
          <Button
            className="w-full gap-2 h-12 text-base"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            Enviar Checklist ({answeredCount}/{items.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
