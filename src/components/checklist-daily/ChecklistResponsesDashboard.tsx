import { useState, useEffect, useMemo } from "react";
import { BarChart3, Loader2, Calendar, ChevronDown, ChevronUp, Filter, FileWarning, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SECTOR_POSITION_MAP, type AuditSector } from "@/lib/sectorPositionMapping";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDF_COLORS, PDF_LAYOUT, addPageFooter, addContinuationHeader, addSignaturePage } from "@/lib/pdf/grupoCajuPdfTheme";
import { addChecklistCover, addCorrectionLinkBox } from "@/lib/pdf/checklistPdfHelpers";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface ChecklistResponsesDashboardProps {
  lojaId: string;
}

interface ResponseRow {
  id: string;
  sector_code: string;
  response_date: string;
  total_score: number;
  total_items: number;
  conforming_items: number;
  responded_by_name: string | null;
  created_at: string;
  template_id: string | null;
  link_id: string;
}

interface TemplateOption {
  id: string;
  name: string;
}

const SECTOR_COLORS: Record<string, string> = {
  bar: "#8b5cf6",
  cozinha: "#f97316",
  cozinha_quente: "#ef4444",
  saladas_sobremesas: "#22c55e",
  parrilla: "#dc2626",
  sushi: "#3b82f6",
  salao: "#10b981",
  estoque: "#6366f1",
  area_comum: "#64748b",
  delivery: "#eab308",
  recepcao: "#ec4899",
  lavagem: "#06b6d4",
  dml: "#a855f7",
  asg: "#84cc16",
  manutencao: "#f59e0b",
  brinquedoteca: "#14b8a6",
  documentos: "#78716c",
};

const PUBLISHED_URL = "https://freelancersgrupocaju.lovable.app";

export function ChecklistResponsesDashboard({ lojaId }: ChecklistResponsesDashboardProps) {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const [responseItems, setResponseItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("all");
  const [corrections, setCorrections] = useState<Record<string, any>>({});
  const [lojaDisplayName, setLojaDisplayName] = useState("");

  useEffect(() => {
    if (lojaId) {
      fetchTemplates();
      fetchResponses();
      supabase.from("config_lojas").select("nome").eq("id", lojaId).single().then(({ data }) => {
        if (data) setLojaDisplayName(data.nome);
      });
    }
  }, [lojaId]);

  async function fetchTemplates() {
    const { data } = await supabase
      .from("checklist_templates")
      .select("id, name")
      .eq("loja_id", lojaId)
      .order("name");
    setTemplates(data || []);
  }

  async function fetchResponses() {
    setLoading(true);
    const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const { data } = await supabase
      .from("checklist_responses")
      .select("*")
      .eq("loja_id", lojaId)
      .gte("response_date", from)
      .order("response_date", { ascending: false });

    setResponses((data as ResponseRow[]) || []);
    setLoading(false);
  }

  // Merge template options from DB + from responses (covers cases where template was deleted but responses exist)
  const allTemplateOptions = useMemo(() => {
    const map = new Map<string, string>();
    templates.forEach((t) => map.set(t.id, t.name));
    responses.forEach((r) => {
      if (r.template_id && !map.has(r.template_id)) {
        map.set(r.template_id, `Template ${r.template_id.slice(0, 6)}…`);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [templates, responses]);

  const filteredResponses = useMemo(() => {
    if (selectedTemplateId === "all") return responses;
    return responses.filter((r) => r.template_id === selectedTemplateId);
  }, [responses, selectedTemplateId]);

  async function toggleDrillDown(responseId: string) {
    if (expandedResponse === responseId) {
      setExpandedResponse(null);
      setResponseItems([]);
      setCorrections({});
      return;
    }
    setExpandedResponse(responseId);
    setLoadingItems(true);

    const [itemsRes, correctionsRes] = await Promise.all([
      supabase
        .from("checklist_response_items")
        .select("*, checklist_template_items(item_text, weight)")
        .eq("response_id", responseId),
      supabase
        .from("checklist_corrections")
        .select("*")
        .eq("response_id", responseId),
    ]);

    setResponseItems(itemsRes.data || []);

    const corrMap: Record<string, any> = {};
    (correctionsRes.data || []).forEach((c: any) => {
      corrMap[c.response_item_id] = c;
    });
    setCorrections(corrMap);
    setLoadingItems(false);
  }

  function getAccessTokenForResponse(response: ResponseRow): string | null {
    // We need to look up the link's access_token
    // Since we have link_id on the response, we can fetch it
    return null; // Will be fetched async
  }

  async function generateNCReport(response: ResponseRow) {
    // Fetch the access_token from the link
    const { data: link } = await supabase
      .from("checklist_sector_links")
      .select("access_token")
      .eq("id", response.link_id)
      .single();

    if (!link) {
      toast.error("Erro ao buscar dados do link");
      return;
    }

    const ncItems = responseItems.filter((item: any) => !item.is_conforming);
    if (ncItems.length === 0) {
      toast.error("Nenhum item não conforme nesta resposta");
      return;
    }

    const sectorName = SECTOR_POSITION_MAP[response.sector_code as AuditSector]?.displayName || response.sector_code;
    const correctionUrl = `${PUBLISHED_URL}/checklist-corrections/${response.id}/${link.access_token}`;
    const dateStr = format(new Date(response.response_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });

    const doc = new jsPDF("p", "mm", "a4");
    const margin = PDF_LAYOUT.margin;

    // === PAGE 1: EXECUTIVE COVER ===
    addChecklistCover(doc, {
      title: "Relatório de Não Conformidades",
      subtitle: `${sectorName} — ${getLojaNameForPdf()}`,
      sectorName,
      unitName: getLojaNameForPdf(),
      appliedBy: response.responded_by_name || "Anônimo",
      date: dateStr,
      score: response.total_score,
      conforming: response.conforming_items,
      nonConforming: ncItems.length,
    });

    // === PAGE 2: NC TABLE ===
    doc.addPage();
    let y = addContinuationHeader(doc, "Não Conformidades");

    // Section title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.institutional);
    doc.text("Itens Não Conformes", margin, y);
    y += 4;
    doc.setDrawColor(...PDF_COLORS.institutional);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + 50, y);
    y += 10;

    const tableData = ncItems.map((item: any, idx: number) => {
      const corr = corrections[item.id];
      return [
        String(idx + 1),
        item.checklist_template_items?.item_text || "Item",
        String(item.checklist_template_items?.weight || 1),
        item.observation || "—",
        corr ? `Corrigido` : "Pendente",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["#", "Item", "Peso", "Observação", "Status"]],
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
        1: { cellWidth: 60 },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 50 },
        4: { cellWidth: 36, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          if (data.cell.raw === "Corrigido") {
            data.cell.styles.textColor = PDF_COLORS.success;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = PDF_COLORS.successLight;
          } else {
            data.cell.styles.textColor = PDF_COLORS.danger;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = PDF_COLORS.dangerLight;
          }
        }
      },
    });

    // === CORRECTION LINK SECTION ===
    let linkY = (doc as any).lastAutoTable?.finalY || 200;
    linkY += 16;

    const pageHeight = doc.internal.pageSize.getHeight();
    if (linkY + 70 > pageHeight) {
      doc.addPage();
      linkY = addContinuationHeader(doc, "Link de Correção");
    }

    addCorrectionLinkBox(doc, linkY, correctionUrl);

    // === FINAL PAGE: SIGNATURE ===
    doc.addPage();
    addSignaturePage(doc);

    // === FOOTER on all pages ===
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(doc, i, totalPages);
    }

    const fileName = `NC_${sectorName}_${dateStr.replace(/\//g, "-")}.pdf`;
    doc.save(fileName);
    toast.success("Relatório NC baixado!");
  }

  function getLojaNameForPdf(): string {
    return lojaDisplayName || "Unidade";
  }

  const chartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    filteredResponses.forEach((r) => {
      if (!byDate[r.response_date]) byDate[r.response_date] = {};
      byDate[r.response_date][r.sector_code] = r.total_score;
    });

    return Object.entries(byDate)
      .map(([date, sectors]) => ({ date: format(new Date(date), "dd/MM"), ...sectors }))
      .reverse();
  }, [filteredResponses]);

  const activeSectors = useMemo(() => {
    return [...new Set(filteredResponses.map((r) => r.sector_code))];
  }, [filteredResponses]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template filter */}
      {allTemplateOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger className="w-[250px] h-9">
              <SelectValue placeholder="Filtrar por template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Templates</SelectItem>
              {allTemplateOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTemplateId !== "all" && (
            <Badge variant="secondary" className="text-xs">
              {filteredResponses.length} resultado{filteredResponses.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      {/* Evolution chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Evolução de Notas por Setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                {activeSectors.map((sector) => (
                  <Line
                    key={sector}
                    type="monotone"
                    dataKey={sector}
                    name={SECTOR_POSITION_MAP[sector as AuditSector]?.displayName || sector}
                    stroke={SECTOR_COLORS[sector] || "#8884d8"}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Responses list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Respostas Recentes (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredResponses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma resposta registrada nos últimos 30 dias.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredResponses.map((r) => {
                const sectorName = SECTOR_POSITION_MAP[r.sector_code as AuditSector]?.displayName || r.sector_code;
                const scoreColor = r.total_score >= 90 ? "text-green-600" : r.total_score >= 70 ? "text-yellow-600" : "text-red-600";
                const isExpanded = expandedResponse === r.id;
                const tplName = templates.find((t) => t.id === r.template_id)?.name;
                const ncCount = r.total_items - r.conforming_items;

                return (
                  <div key={r.id}>
                    <button
                      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleDrillDown(r.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{sectorName}</span>
                          <span className={`font-bold text-sm ${scoreColor}`}>
                            {r.total_score.toFixed(0)}%
                          </span>
                          {ncCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {ncCount} NC
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(r.response_date), "dd/MM/yyyy", { locale: ptBR })} •{" "}
                          {r.responded_by_name || "Anônimo"} •{" "}
                          {r.conforming_items}/{r.total_items} conformes
                          {tplName && ` • 📄 ${tplName}`}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {isExpanded && (
                      <div className="ml-4 mt-1 border-l-2 pl-4 py-2 space-y-1">
                        {loadingItems ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            {/* NC Report button */}
                            {responseItems.some((item: any) => !item.is_conforming) && (
                              <div className="mb-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                  onClick={() => generateNCReport(r)}
                                >
                                  <FileWarning className="h-4 w-4" />
                                  Relatório NC (PDF + Link de Correção)
                                </Button>
                                {/* Correction summary */}
                                {(() => {
                                  const ncItems = responseItems.filter((item: any) => !item.is_conforming);
                                  const corrected = ncItems.filter((item: any) => corrections[item.id]);
                                  if (ncItems.length > 0) {
                                    return (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        {corrected.length}/{ncItems.length} corrigidos
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}

                            {responseItems.map((item: any) => {
                              const corr = corrections[item.id];
                              return (
                                <div key={item.id} className="flex items-start gap-2 text-sm">
                                  <Badge
                                    variant={item.is_conforming ? "default" : "destructive"}
                                    className="text-xs mt-0.5 shrink-0"
                                  >
                                    {item.is_conforming ? "OK" : "NC"}
                                  </Badge>
                                  <div className="flex-1">
                                    <span>{item.checklist_template_items?.item_text || "Item"}</span>
                                    {item.observation && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        💬 {item.observation}
                                      </p>
                                    )}
                                    {item.photo_url && (
                                      <a href={item.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-0.5 block">
                                        📷 Ver foto
                                      </a>
                                    )}
                                    {/* Correction badge */}
                                    {!item.is_conforming && corr && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                                        <span className="text-xs text-green-600 font-medium">
                                          Corrigido por {corr.corrected_by_name} em {format(new Date(corr.corrected_at), "dd/MM HH:mm")}
                                        </span>
                                        <a href={corr.correction_photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-1">
                                          📷
                                        </a>
                                      </div>
                                    )}
                                    {!item.is_conforming && !corr && (
                                      <span className="text-xs text-red-500 mt-1 block">⏳ Correção pendente</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
