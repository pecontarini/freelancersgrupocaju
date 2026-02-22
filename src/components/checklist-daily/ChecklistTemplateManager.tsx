import { useState, useEffect, useMemo } from "react";
import { Upload, Loader2, Wand2, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SECTOR_POSITION_MAP, categorizeItemToSector, type AuditSector } from "@/lib/sectorPositionMapping";

interface ExtractedItem {
  id?: string; // present when editing
  item_text: string;
  category: string;
  weight: number;
  item_order: number;
  sector_code?: string;
}

interface ChecklistTemplateManagerProps {
  lojaId: string;
  lojaName: string;
  editingTemplateId?: string | null;
  onTemplateCreated?: () => void;
  onCancelEdit?: () => void;
}

export function ChecklistTemplateManager({ lojaId, lojaName, editingTemplateId, onTemplateCreated, onCancelEdit }: ChecklistTemplateManagerProps) {
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const sectorOptions = useMemo(() => {
    return Object.entries(SECTOR_POSITION_MAP)
      .filter(([key]) => key !== "outros")
      .map(([key, config]) => ({ value: key, label: config.displayName }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const mappedCount = items.filter((i) => i.sector_code).length;
  const pendingCount = items.length - mappedCount;

  // Load template for editing
  useEffect(() => {
    if (editingTemplateId) {
      loadTemplate(editingTemplateId);
    } else {
      resetForm();
    }
  }, [editingTemplateId]);

  async function loadTemplate(templateId: string) {
    const { data: template } = await supabase
      .from("checklist_templates")
      .select("id, name")
      .eq("id", templateId)
      .single();

    if (!template) {
      toast.error("Template não encontrado");
      return;
    }

    const { data: templateItems } = await supabase
      .from("checklist_template_items")
      .select("id, item_text, item_order, weight, sector_code, original_category")
      .eq("template_id", templateId)
      .order("item_order");

    setTemplateName(template.name);
    setItems(
      (templateItems || []).map((item) => ({
        id: item.id,
        item_text: item.item_text,
        category: item.original_category || "",
        weight: item.weight,
        item_order: item.item_order,
        sector_code: item.sector_code || undefined,
      }))
    );
    setIsEditing(true);
  }

  function resetForm() {
    setTemplateName("");
    setItems([]);
    setIsEditing(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setExtracting(true);
      if (!templateName.trim()) {
        setTemplateName(`${lojaName} - ${file.name.replace(/\.pdf$/i, "")}`);
      }

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await supabase.functions.invoke("extract-checklist-items", {
        body: { pdfBase64: base64 },
      });

      if (res.error) {
        toast.error("Erro ao processar PDF");
        return;
      }

      const data = res.data;
      if (!data.success || !data.data?.items) {
        toast.error(data.error || "Falha na extração");
        return;
      }

      const extracted = data.data.items.map((item: any, idx: number) => ({
        item_text: item.item_text,
        category: item.category || "",
        weight: item.weight || 1,
        item_order: item.item_order || idx + 1,
        sector_code: undefined,
      }));

      setItems(extracted);
      toast.success(`${extracted.length} itens extraídos com sucesso!`);
    } catch {
      toast.error("Erro ao processar PDF");
    } finally {
      setExtracting(false);
    }
  }

  function autoMapSectors() {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        sector_code: categorizeItemToSector(item.item_text, item.category),
      }))
    );
    toast.success("Mapeamento automático aplicado");
  }

  function clearMapping() {
    setItems((prev) => prev.map((item) => ({ ...item, sector_code: undefined })));
  }

  function setSectorForItem(idx: number, sector: string) {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], sector_code: sector };
      return copy;
    });
  }

  function setWeightForItem(idx: number, weight: number) {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], weight };
      return copy;
    });
  }

  async function handleSave() {
    if (!templateName.trim()) {
      toast.error("Informe o nome do template");
      return;
    }
    if (items.length === 0) {
      toast.error("Nenhum item extraído");
      return;
    }

    try {
      setSaving(true);

      if (isEditing && editingTemplateId) {
        // Update existing template
        const { error: nameError } = await supabase
          .from("checklist_templates")
          .update({ name: templateName.trim() })
          .eq("id", editingTemplateId);

        if (nameError) throw nameError;

        // Delete old items and re-insert
        await supabase
          .from("checklist_template_items")
          .delete()
          .eq("template_id", editingTemplateId);

        const templateItems = items.map((item) => ({
          template_id: editingTemplateId,
          item_text: item.item_text,
          item_order: item.item_order,
          weight: item.weight,
          sector_code: item.sector_code || null,
          original_category: item.category || null,
        }));

        const { error: itemsError } = await supabase
          .from("checklist_template_items")
          .insert(templateItems);

        if (itemsError) throw itemsError;

        toast.success("Template atualizado com sucesso!");
      } else {
        // Create new template — save as active by default
        const { data: template, error: templateError } = await supabase
          .from("checklist_templates")
          .insert({
            loja_id: lojaId,
            name: templateName.trim(),
            is_active: true,
          })
          .select()
          .single();

        if (templateError) throw templateError;

        const templateItems = items.map((item) => ({
          template_id: template.id,
          item_text: item.item_text,
          item_order: item.item_order,
          weight: item.weight,
          sector_code: item.sector_code || null,
          original_category: item.category || null,
        }));

        const { error: itemsError } = await supabase
          .from("checklist_template_items")
          .insert(templateItems);

        if (itemsError) throw itemsError;

        toast.success("Template salvo e ativado!");
      }

      resetForm();
      onTemplateCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          {isEditing ? "Editar Template" : "Criar Novo Template"}
        </CardTitle>
        {isEditing && (
          <Button size="sm" variant="ghost" onClick={() => { resetForm(); onCancelEdit?.(); }} className="gap-1">
            <X className="h-4 w-4" />
            Cancelar Edição
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Name - always visible */}
        <div>
          <label className="text-sm font-medium mb-1 block">Nome do Template</label>
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={`Ex: Checklist ${lojaName} - Supervisão`}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Dica: inclua o nome da unidade e tipo (Supervisão, Fiscal, etc.) para facilitar a localização.
          </p>
        </div>

        {/* Upload - only show when not editing or to replace items */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">
              {isEditing ? "Substituir itens (upload novo PDF)" : "PDF do Checklist"}
            </label>
            <Input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={extracting}
            />
          </div>
          {extracting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Extraindo itens...
            </div>
          )}
        </div>

        {items.length > 0 && (
          <>
            {/* Stats + actions */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 text-sm">
                <Badge variant="secondary">{items.length} itens</Badge>
                <Badge variant="default" className="bg-green-600">{mappedCount} mapeados</Badge>
                {pendingCount > 0 && (
                  <Badge variant="destructive">{pendingCount} pendentes</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={autoMapSectors} className="gap-1">
                  <Wand2 className="h-3.5 w-3.5" />
                  Mapear Auto
                </Button>
                <Button size="sm" variant="ghost" onClick={clearMapping} className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              </div>
            </div>

            {/* Items table */}
            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 w-10">#</th>
                    <th className="text-left p-2">Item</th>
                    <th className="text-left p-2 w-[140px]">Setor</th>
                    <th className="text-left p-2 w-[70px]">Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2">
                        <p className="line-clamp-2">{item.item_text}</p>
                        {item.category && (
                          <span className="text-xs text-muted-foreground">{item.category}</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Select
                          value={item.sector_code || ""}
                          onValueChange={(v) => setSectorForItem(idx, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {sectorOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          className="h-8 w-16 text-xs"
                          value={item.weight}
                          min={0.1}
                          step={0.1}
                          onChange={(e) => setWeightForItem(idx, parseFloat(e.target.value) || 1)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save */}
            <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEditing ? "Atualizar Template" : "Salvar Template"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
