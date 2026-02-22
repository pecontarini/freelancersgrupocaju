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
}

interface SectorLink {
  id: string;
  sector_code: string;
  access_token: string;
  is_active: boolean;
  last_response?: { response_date: string; total_score: number; created_at: string } | null;
}

export function ChecklistLinksPanel({ lojaId }: ChecklistLinksPanelProps) {
  const [links, setLinks] = useState<SectorLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (lojaId) fetchLinks();
  }, [lojaId]);

  async function fetchLinks() {
    setLoading(true);
    const { data: linksData } = await supabase
      .from("checklist_sector_links")
      .select("*")
      .eq("loja_id", lojaId)
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

      // Get all mapped sectors for this store's templates
      const { data: items } = await supabase
        .from("checklist_template_items")
        .select("sector_code, checklist_templates!inner(loja_id, is_active)")
        .eq("checklist_templates.loja_id", lojaId)
        .not("sector_code", "is", null);

      if (!items || items.length === 0) {
        toast.error("Nenhum item mapeado a setores. Faça o mapeamento primeiro.");
        return;
      }

      const sectors = [...new Set(items.map((i) => i.sector_code).filter(Boolean))] as string[];

      // Get existing links
      const { data: existing } = await supabase
        .from("checklist_sector_links")
        .select("sector_code")
        .eq("loja_id", lojaId);

      const existingSectors = new Set((existing || []).map((e) => e.sector_code));
      const newSectors = sectors.filter((s) => !existingSectors.has(s));

      if (newSectors.length === 0) {
        toast.info("Links já existem para todos os setores mapeados");
        await fetchLinks();
        return;
      }

      const newLinks = newSectors.map((sector) => ({
        loja_id: lojaId,
        sector_code: sector,
        is_active: true,
      }));

      const { error } = await supabase.from("checklist_sector_links").insert(newLinks);
      if (error) throw error;

      toast.success(`${newLinks.length} links gerados!`);
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

  function copyLink(token: string) {
    const url = `${window.location.origin}/checklist/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  function shareWhatsApp(token: string, sectorCode: string) {
    const sectorName = SECTOR_POSITION_MAP[sectorCode as AuditSector]?.displayName || sectorCode;
    const url = `${window.location.origin}/checklist/${token}`;
    const text = `📋 Checklist Diário - ${sectorName}\n\nAplique o checklist do seu setor:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          Links por Setor
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchLinks} className="gap-1">
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={generateLinks} disabled={generating} className="gap-1">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Gerar Links
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum link gerado. Mapeie os itens e clique "Gerar Links".
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => {
              const sectorName = SECTOR_POSITION_MAP[link.sector_code as AuditSector]?.displayName || link.sector_code;
              const lastScore = link.last_response?.total_score;
              const lastDate = link.last_response?.response_date;
              const scoreColor = lastScore && lastScore >= 90 ? "text-green-600" : lastScore && lastScore >= 70 ? "text-yellow-600" : "text-red-600";

              return (
                <div
                  key={link.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{sectorName}</span>
                      <Badge variant={link.is_active ? "default" : "secondary"} className="text-xs">
                        {link.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
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

                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyLink(link.access_token)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => shareWhatsApp(link.access_token, link.sector_code)}>
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
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
      </CardContent>
    </Card>
  );
}
