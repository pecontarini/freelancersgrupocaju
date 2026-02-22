import { useState, useEffect } from "react";
import { Link2, Copy, MessageCircle, ToggleLeft, ToggleRight, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SECTOR_POSITION_MAP, type AuditSector } from "@/lib/sectorPositionMapping";
import { format } from "date-fns";

interface ChecklistLinksPanelProps {
  lojaId: string;
  templateId: string;
  templateName: string;
}

interface SectorLink {
  id: string;
  sector_code: string;
  access_token: string;
  is_active: boolean;
  last_response?: { response_date: string; total_score: number; created_at: string } | null;
}

export function ChecklistLinksPanel({ lojaId, templateId, templateName }: ChecklistLinksPanelProps) {
  const [links, setLinks] = useState<SectorLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (lojaId && templateId) fetchLinks();
  }, [lojaId, templateId]);

  async function fetchLinks() {
    setLoading(true);
    const { data: linksData } = await supabase
      .from("checklist_sector_links")
      .select("*")
      .eq("loja_id", lojaId)
      .eq("template_id", templateId)
      .order("sector_code");

    if (!linksData) {
      setLinks([]);
      setLoading(false);
      return;
    }

    // Get latest response for each link
    const enriched: SectorLink[] = [];
    for (const link of linksData) {
      const { data: lastResp } = await supabase
        .from("checklist_responses")
        .select("response_date, total_score, created_at")
        .eq("link_id", link.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      enriched.push({ ...link, last_response: lastResp });
    }

    setLinks(enriched);
    setLoading(false);
  }

  async function generateLinks() {
    try {
      setGenerating(true);

      // Get all mapped sectors for this specific template
      const { data: items } = await supabase
        .from("checklist_template_items")
        .select("sector_code")
        .eq("template_id", templateId)
        .not("sector_code", "is", null);

      if (!items || items.length === 0) {
        toast.error("Nenhum item mapeado a setores neste template. Faça o mapeamento primeiro.");
        return;
      }

      const sectors = [...new Set(items.map((i) => i.sector_code).filter(Boolean))] as string[];

      // Get existing links for this template
      const { data: existing } = await supabase
        .from("checklist_sector_links")
        .select("sector_code")
        .eq("loja_id", lojaId)
        .eq("template_id", templateId);

      const existingSectors = new Set((existing || []).map((e) => e.sector_code));
      const newSectors = sectors.filter((s) => !existingSectors.has(s));

      if (newSectors.length === 0) {
        toast.info("Links já existem para todos os setores mapeados neste template");
        await fetchLinks();
        return;
      }

      const newLinks = newSectors.map((sector) => ({
        loja_id: lojaId,
        sector_code: sector,
        template_id: templateId,
        is_active: true,
      }));

      const { error } = await supabase.from("checklist_sector_links").insert(newLinks);
      if (error) throw error;

      toast.success(`${newLinks.length} links gerados para "${templateName}"!`);
      await fetchLinks();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar links");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleActive(linkId: string, currentActive: boolean) {
    const { error } = await supabase
      .from("checklist_sector_links")
      .update({ is_active: !currentActive })
      .eq("id", linkId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    setLinks((prev) =>
      prev.map((l) => (l.id === linkId ? { ...l, is_active: !currentActive } : l))
    );
  }

  function getPublicBaseUrl() {
    const origin = window.location.origin;
    // If on preview/dev URL, use the published URL instead
    if (origin.includes('lovableproject.com') || origin.includes('localhost')) {
      return 'https://freelancersgrupocaju.lovable.app';
    }
    return origin;
  }

  function copyLink(token: string) {
    const url = `${getPublicBaseUrl()}/checklist/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  function shareWhatsApp(token: string, sectorCode: string) {
    const sectorName = SECTOR_POSITION_MAP[sectorCode as AuditSector]?.displayName || sectorCode;
    const url = `${getPublicBaseUrl()}/checklist/${token}`;
    const text = `📋 Checklist Diário - ${sectorName}\n📄 ${templateName}\n\nAplique o checklist do seu setor:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (loading) {
    return (
      <div className="py-4 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          Links por Setor — {templateName}
        </h4>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchLinks} className="gap-1 h-7 text-xs">
            <RefreshCcw className="h-3 w-3" />
          </Button>
          <Button size="sm" onClick={generateLinks} disabled={generating} className="gap-1 h-7 text-xs">
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
            Gerar Links
          </Button>
        </div>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Nenhum link gerado. Mapeie os itens e clique "Gerar Links".
        </p>
      ) : (
        <div className="space-y-1.5">
          {links.map((link) => {
            const sectorName = SECTOR_POSITION_MAP[link.sector_code as AuditSector]?.displayName || link.sector_code;
            const lastScore = link.last_response?.total_score;
            const lastDate = link.last_response?.response_date;
            const scoreColor = lastScore && lastScore >= 90 ? "text-green-600" : lastScore && lastScore >= 70 ? "text-yellow-600" : "text-red-600";

            return (
              <div
                key={link.id}
                className="flex items-center gap-2 p-2 rounded-lg border bg-card text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{sectorName}</span>
                    <Badge variant={link.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {link.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {lastDate ? (
                      <>
                        Última: {format(new Date(lastDate), "dd/MM")} •{" "}
                        <span className={scoreColor}>{lastScore?.toFixed(0)}%</span>
                      </>
                    ) : (
                      "Sem respostas"
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyLink(link.access_token)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => shareWhatsApp(link.access_token, link.sector_code)}>
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => toggleActive(link.id, link.is_active)}
                  >
                    {link.is_active ? (
                      <ToggleRight className="h-4 w-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
