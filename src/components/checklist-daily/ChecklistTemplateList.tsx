import { useState, useEffect } from "react";
import { Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, FileText, Link2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChecklistLinksPanel } from "./ChecklistLinksPanel";

interface Template {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  item_count: number;
  mapped_count: number;
}

interface ChecklistTemplateListProps {
  lojaId: string;
  refreshKey?: number;
  onEdit: (templateId: string) => void;
}

export function ChecklistTemplateList({ lojaId, refreshKey, onEdit }: ChecklistTemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedLinks, setExpandedLinks] = useState<string | null>(null);

  useEffect(() => {
    if (lojaId) fetchTemplates();
  }, [lojaId, refreshKey]);

  async function fetchTemplates() {
    setLoading(true);
    const { data, error } = await supabase
      .from("checklist_templates")
      .select("id, name, is_active, created_at")
      .eq("loja_id", lojaId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    const enriched: Template[] = [];
    for (const t of data) {
      const { count: itemCount } = await supabase
        .from("checklist_template_items")
        .select("id", { count: "exact", head: true })
        .eq("template_id", t.id);

      const { count: mappedCount } = await supabase
        .from("checklist_template_items")
        .select("id", { count: "exact", head: true })
        .eq("template_id", t.id)
        .not("sector_code", "is", null);

      enriched.push({
        ...t,
        item_count: itemCount || 0,
        mapped_count: mappedCount || 0,
      });
    }

    setTemplates(enriched);
    setLoading(false);
  }

  async function toggleActive(id: string, currentActive: boolean) {
    const { error } = await supabase
      .from("checklist_templates")
      .update({ is_active: !currentActive })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_active: !currentActive } : t))
    );
    toast.success(!currentActive ? "Template ativado!" : "Template desativado");
  }

  async function handleDelete() {
    if (!deleteId) return;
    // Delete links, items, then template
    await supabase.from("checklist_sector_links").delete().eq("template_id", deleteId);
    await supabase.from("checklist_template_items").delete().eq("template_id", deleteId);
    const { error } = await supabase.from("checklist_templates").delete().eq("id", deleteId);
    if (error) {
      toast.error("Erro ao excluir template");
    } else {
      toast.success("Template excluído");
      setTemplates((prev) => prev.filter((t) => t.id !== deleteId));
      if (expandedLinks === deleteId) setExpandedLinks(null);
    }
    setDeleteId(null);
  }

  function toggleLinksPanel(templateId: string) {
    setExpandedLinks((prev) => (prev === templateId ? null : templateId));
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

  if (templates.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Templates Criados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="space-y-0">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.name}</span>
                    <Badge variant={t.is_active ? "default" : "secondary"} className="text-xs">
                      {t.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.item_count} itens • {t.mapped_count} mapeados
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => toggleLinksPanel(t.id)}
                    title="Ver Links"
                  >
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    {expandedLinks === t.id ? (
                      <ChevronUp className="h-3 w-3 absolute bottom-0.5 right-0.5" />
                    ) : (
                      <ChevronDown className="h-3 w-3 absolute bottom-0.5 right-0.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => toggleActive(t.id, t.is_active)}
                    title={t.is_active ? "Desativar" : "Ativar"}
                  >
                    {t.is_active ? (
                      <ToggleRight className="h-4 w-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => onEdit(t.id)}
                    title="Editar"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteId(t.id)}
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expanded links panel */}
              {expandedLinks === t.id && (
                <div className="ml-4 mt-1 border-l-2 border-primary/20 pl-4 pb-2">
                  <ChecklistLinksPanel
                    lojaId={lojaId}
                    templateId={t.id}
                    templateName={t.name}
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os itens e links do template serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
