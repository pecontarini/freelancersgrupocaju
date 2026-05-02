import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUp, Loader2, Sparkles, CheckCircle2, AlertTriangle, ImageIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUtensiliosCatalog, useBulkImportUtensiliosItems } from "@/hooks/useUtensilios";
import { findBestMatch, normalizeString } from "@/lib/fuzzyMatch";
import { SETORES_UTENSILIOS } from "./SectorFilter";

type ExtractedItem = {
  nome: string;
  qtd_minima: number;
  custo_unitario: number | null;
  fornecedor: string | null;
  setor: string | null;
};

type ReviewRow = ExtractedItem & {
  catalog_item_id: string | null; // null = create new
  setor_aplicado: string;          // Front | Back
  isNew: boolean;
  matchScore: number;              // 0..1
  generating?: boolean;
  foto_url?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SETOR_TO_AREA: Record<string, "Front" | "Back"> = {
  "BAR": "Front", "SALÃO": "Front", "SALAO": "Front", "APV": "Front",
  "APOIO À VENDA": "Front", "APOIO A VENDA": "Front", "DELIVERY": "Front",
  "IFOOD": "Front", "FINALIZAÇÃO": "Front", "FINALIZACAO": "Front",
  "PARRILLA": "Back", "FOGÃO": "Back", "FOGAO": "Back", "SALADA": "Back",
  "PRODUÇÃO": "Back", "PRODUCAO": "Back", "ESTOQUE": "Back", "LAVAGEM": "Back",
};

function inferArea(setor: string | null): "Front" | "Back" {
  if (!setor) return "Back";
  const up = setor.toUpperCase();
  for (const k of Object.keys(SETOR_TO_AREA)) {
    if (up.includes(k)) return SETOR_TO_AREA[k];
  }
  return "Back";
}

export function UtensiliosImportPDFDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [selectedLojas, setSelectedLojas] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [confirmText, setConfirmText] = useState("");

  const { data: catalog } = useUtensiliosCatalog();
  const bulkImport = useBulkImportUtensiliosItems();

  const { data: lojas } = useQuery({
    queryKey: ["config_lojas_all_pdf_import"],
    queryFn: async () => {
      const { data, error } = await supabase.from("config_lojas").select("id, nome").order("nome");
      if (error) throw error;
      return data as Array<{ id: string; nome: string }>;
    },
  });

  const reset = () => {
    setStep(1); setFile(null); setSelectedLojas(new Set());
    setRows([]); setExtracting(false); setConfirmText("");
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Selecione um arquivo PDF");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("PDF muito grande (máx 20MB)");
      return;
    }
    setFile(f);
  };

  const toggleLoja = (id: string) => {
    setSelectedLojas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllLojas = () => {
    if (!lojas) return;
    setSelectedLojas(new Set(lojas.map(l => l.id)));
  };

  const handleExtract = async () => {
    if (!file || selectedLojas.size === 0 || !catalog) {
      toast.error("Selecione PDF e ao menos 1 loja");
      return;
    }
    setExtracting(true);
    try {
      const buf = await file.arrayBuffer();
      // Convert to base64 in chunks to avoid stack overflow
      const bytes = new Uint8Array(buf);
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
      }
      const b64 = btoa(bin);

      const { data, error } = await supabase.functions.invoke("extract-utensilios-pdf", {
        body: { pdf_base64: b64 },
      });
      if (error) throw error;
      const items: ExtractedItem[] = data?.items || [];
      if (items.length === 0) {
        toast.error("Nenhum utensílio encontrado no PDF.");
        setExtracting(false);
        return;
      }

      // Match against catalog
      const catalogOptions = catalog.map((c: any) => ({ id: c.id, nome: c.name }));
      const reviewRows: ReviewRow[] = items.map(it => {
        const match = findBestMatch(it.nome, catalogOptions);
        const matched = match.matchId && match.similarity >= 0.78
          ? catalog.find((c: any) => c.id === match.matchId) : null;
        return {
          ...it,
          catalog_item_id: matched?.id ?? null,
          setor_aplicado: inferArea(it.setor),
          isNew: !matched,
          matchScore: match.similarity || 0,
          foto_url: matched?.foto_url ?? null,
        };
      });

      setRows(reviewRows);
      setStep(2);
      toast.success(`${items.length} itens extraídos`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha ao processar PDF");
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateImage = async (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, generating: true } : r));
    try {
      const r = rows[idx];
      const { data, error } = await supabase.functions.invoke("generate-utensilio-image", {
        body: { nome: r.nome, fornecedor: r.fornecedor },
      });
      if (error) throw error;
      setRows(prev => prev.map((rr, i) => i === idx
        ? { ...rr, generating: false, foto_url: data?.foto_url || null } : rr));
      toast.success("Imagem gerada");
    } catch (e: any) {
      setRows(prev => prev.map((rr, i) => i === idx ? { ...rr, generating: false } : rr));
      toast.error(e.message || "Falha ao gerar imagem");
    }
  };

  const stats = useMemo(() => {
    const newCount = rows.filter(r => r.isNew && !r.catalog_item_id).length;
    const updateCount = rows.filter(r => r.catalog_item_id).length;
    return { newCount, updateCount, total: rows.length };
  }, [rows]);

  const handleConfirmImport = async () => {
    if (confirmText.trim().toUpperCase() !== "IMPORTAR") {
      toast.error('Digite "IMPORTAR" para confirmar');
      return;
    }
    try {
      // 1) Create new catalog items where needed
      const newItems = rows.filter(r => !r.catalog_item_id);
      if (newItems.length > 0) {
        const codePrefix = `UT-${Date.now().toString(36).slice(-4).toUpperCase()}`;
        const inserts = newItems.map((r, i) => ({
          code: `${codePrefix}-${String(i + 1).padStart(3, "0")}`,
          name: r.nome,
          unit: "UN",
          item_type: "utensilio",
          is_utensilio: true,
          is_active: true,
          preco_custo: r.custo_unitario ?? 0,
          fornecedor_sugerido: r.fornecedor,
          foto_url: r.foto_url || null,
        }));
        const { data: created, error: insErr } = await supabase
          .from("items_catalog").insert(inserts).select("id, name");
        if (insErr) throw insErr;
        // map back created ids to rows
        const map = new Map<string, string>();
        created?.forEach((c: any) => map.set(c.name, c.id));
        rows.forEach(r => {
          if (!r.catalog_item_id && map.has(r.nome)) {
            r.catalog_item_id = map.get(r.nome)!;
          }
        });
      }

      // 2) For matched-existing rows: update catalog with photo / cost / fornecedor if missing
      const updates = rows.filter(r => r.catalog_item_id && !r.isNew);
      for (const r of updates) {
        const existing = catalog?.find((c: any) => c.id === r.catalog_item_id);
        const patch: any = {};
        if (r.foto_url && !existing?.foto_url) patch.foto_url = r.foto_url;
        if (r.fornecedor && !existing?.fornecedor_sugerido) patch.fornecedor_sugerido = r.fornecedor;
        if (r.custo_unitario && !existing?.preco_custo) patch.preco_custo = r.custo_unitario;
        if (Object.keys(patch).length) {
          await supabase.from("items_catalog").update(patch).eq("id", r.catalog_item_id);
        }
      }

      // 3) Build cartesian items × lojas and bulk upsert utensilios_items
      const lojasArr = Array.from(selectedLojas);
      const payload = rows
        .filter(r => r.catalog_item_id && r.qtd_minima > 0)
        .flatMap(r => lojasArr.map(loja_id => ({
          catalog_item_id: r.catalog_item_id!,
          loja_id,
          estoque_minimo: r.qtd_minima,
          valor_unitario: r.custo_unitario ?? 0,
          area_responsavel: r.setor_aplicado,
        })));

      await bulkImport.mutateAsync(payload);
      toast.success(`${rows.length} itens aplicados em ${lojasArr.length} loja(s)`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha ao importar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar Estoque Mínimo via PDF (IA)
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step >= 1 ? "text-foreground font-medium" : ""}>1. PDF & Lojas</span>
          <span>→</span>
          <span className={step >= 2 ? "text-foreground font-medium" : ""}>2. Revisar</span>
          <span>→</span>
          <span className={step >= 3 ? "text-foreground font-medium" : ""}>3. Confirmar</span>
        </div>

        {/* STEP 1 — Upload + lojas */}
        {step === 1 && (
          <div className="space-y-4 overflow-auto">
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-medium">Arquivo PDF</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                {file && (
                  <Badge variant="outline" className="text-xs">
                    <FileUp className="h-3 w-3 mr-1" /> {file.name}
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Aplicar nas lojas ({selectedLojas.size} selecionada{selectedLojas.size !== 1 ? "s" : ""})
                  </Label>
                  <Button size="sm" variant="ghost" onClick={selectAllLojas}>Marcar todas</Button>
                </div>
                {!lojas ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lojas.map(l => (
                      <label key={l.id} className="flex items-center gap-2 p-2 rounded-md border hover:bg-accent/40 cursor-pointer">
                        <Checkbox
                          checked={selectedLojas.has(l.id)}
                          onCheckedChange={() => toggleLoja(l.id)}
                        />
                        <span className="text-sm">{l.nome}</span>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <DialogFooter>
              <Button
                onClick={handleExtract}
                disabled={!file || selectedLojas.size === 0 || extracting}
              >
                {extracting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {extracting ? "Extraindo com IA..." : "Extrair itens do PDF"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2 — Review */}
        {step === 2 && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{stats.total} itens</Badge>
              <Badge className="bg-emerald-600 text-white">{stats.updateCount} match no catálogo</Badge>
              <Badge className="bg-amber-600 text-white">{stats.newCount} serão criados</Badge>
              <Badge variant="outline">{selectedLojas.size} loja(s)</Badge>
            </div>

            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-2">
                {rows.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded-md bg-card">
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {r.foto_url ? (
                        <img src={r.foto_url} alt={r.nome} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{r.nome}</p>
                        {r.isNew ? (
                          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">NOVO</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700">
                            {Math.round(r.matchScore * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.fornecedor || "—"} · Setor: {r.setor || "—"}
                      </p>
                    </div>
                    <Select
                      value={r.setor_aplicado}
                      onValueChange={(v) => setRows(prev => prev.map((rr, i) => i === idx ? { ...rr, setor_aplicado: v } : rr))}
                    >
                      <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SETORES_UTENSILIOS.filter(s => s !== "Todos").map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number" min={0}
                      className="w-16 h-8 text-right"
                      value={r.qtd_minima}
                      onChange={(e) => setRows(prev => prev.map((rr, i) => i === idx
                        ? { ...rr, qtd_minima: parseInt(e.target.value) || 0 } : rr))}
                    />
                    <Input
                      type="number" min={0} step="0.01"
                      className="w-20 h-8 text-right"
                      placeholder="R$"
                      value={r.custo_unitario ?? ""}
                      onChange={(e) => setRows(prev => prev.map((rr, i) => i === idx
                        ? { ...rr, custo_unitario: parseFloat(e.target.value) || 0 } : rr))}
                    />
                    <Button
                      size="sm" variant="ghost"
                      title="Gerar imagem com IA"
                      disabled={r.generating}
                      onClick={() => handleGenerateImage(idx)}
                    >
                      {r.generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => setStep(3)} disabled={stats.total === 0}>
                Avançar para Confirmação
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3 — Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <Card className="border-amber-300 bg-amber-50/40">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm space-y-1">
                    <p>Esta ação irá:</p>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                      <li><strong>Criar {stats.newCount}</strong> novos itens no catálogo (com fotos quando disponíveis).</li>
                      <li><strong>Atualizar {stats.updateCount}</strong> itens existentes (custo/foto/fornecedor faltantes).</li>
                      <li>Aplicar estoque mínimo em <strong>{selectedLojas.size}</strong> loja(s).</li>
                      <li>Total de linhas em <code>utensilios_items</code>: <strong>{stats.total * selectedLojas.size}</strong></li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label className="text-sm">Digite <code className="font-mono">IMPORTAR</code> para confirmar:</Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="IMPORTAR"
                className="mt-1 font-mono"
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
              <Button
                onClick={handleConfirmImport}
                disabled={confirmText.trim().toUpperCase() !== "IMPORTAR" || bulkImport.isPending}
              >
                {bulkImport.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar importação
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
