import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUp, Loader2, Sparkles, CheckCircle2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { findBestMatch } from "@/lib/fuzzyMatch";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

type CatalogItem = { id: string; name: string; code: string; foto_url: string | null; fornecedor_sugerido: string | null };

type Match = {
  catalog_id: string;
  catalog_name: string;
  pdf_name: string;
  score: number;
  cropDataUrl: string;
  selected: boolean;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  catalog: CatalogItem[];
  onApplied?: () => void;
}

export function PdfPhotosImportDialog({ open, onOpenChange, catalog, onApplied }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [matches, setMatches] = useState<Match[]>([]);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);

  const reset = () => {
    setFile(null); setStep(1); setProgress({ done: 0, total: 0, label: "" });
    setMatches([]); setRunning(false); setApplying(false);
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf") { toast.error("Selecione um PDF"); return; }
    if (f.size > 30 * 1024 * 1024) { toast.error("PDF muito grande (máx 30MB)"); return; }
    setFile(f);
  };

  const handleExtract = async () => {
    if (!file) return;
    setRunning(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
      const total = pdf.numPages;
      setProgress({ done: 0, total, label: "Renderizando páginas..." });

      const allMatches: Match[] = [];
      const seenCatalog = new Set<string>();

      for (let p = 1; p <= total; p++) {
        setProgress({ done: p - 1, total, label: `Analisando página ${p}/${total}...` });
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        const pageDataUrl = canvas.toDataURL("image/jpeg", 0.85);

        // Ask AI to find utensil names + bboxes
        let pageItems: { nome: string; bbox: [number, number, number, number] }[] = [];
        try {
          const { data, error } = await supabase.functions.invoke("locate-utensilios-in-page", {
            body: { image_data_url: pageDataUrl },
          });
          if (error) throw error;
          pageItems = data?.items || [];
        } catch (e: any) {
          console.error("page", p, e?.message);
          continue;
        }

        for (const it of pageItems) {
          const m = findBestMatch(it.nome, catalog.map(c => ({ id: c.id, nome: c.name })));
          if (!m.matchId || m.similarity < 0.7) continue;
          if (seenCatalog.has(m.matchId)) continue;
          seenCatalog.add(m.matchId);
          const cat = catalog.find(c => c.id === m.matchId)!;
          // Crop using bbox (percentages 0-100)
          const [x, y, w, h] = it.bbox;
          const cx = Math.max(0, (x / 100) * canvas.width);
          const cy = Math.max(0, (y / 100) * canvas.height);
          const cw = Math.min(canvas.width - cx, (w / 100) * canvas.width);
          const ch = Math.min(canvas.height - cy, (h / 100) * canvas.height);
          if (cw < 20 || ch < 20) continue;
          const crop = document.createElement("canvas");
          crop.width = cw; crop.height = ch;
          crop.getContext("2d")!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
          allMatches.push({
            catalog_id: cat.id,
            catalog_name: cat.name,
            pdf_name: it.nome,
            score: m.similarity,
            cropDataUrl: crop.toDataURL("image/jpeg", 0.9),
            selected: !cat.foto_url,
          });
        }
      }

      setProgress({ done: total, total, label: "Concluído" });
      setMatches(allMatches);
      setStep(2);
      toast.success(`${allMatches.length} fotos identificadas`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha ao processar PDF");
    } finally {
      setRunning(false);
    }
  };

  const handleApply = async () => {
    const selected = matches.filter(m => m.selected);
    if (selected.length === 0) { toast.error("Nenhuma foto selecionada"); return; }
    setApplying(true);
    try {
      let done = 0;
      for (const m of selected) {
        const blob = await (await fetch(m.cropDataUrl)).blob();
        const path = `pdf-crop/${m.catalog_id}-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from("utensilios-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("utensilios-photos").getPublicUrl(path);
        await supabase.from("items_catalog").update({ foto_url: pub.publicUrl }).eq("id", m.catalog_id);
        done++;
        setProgress({ done, total: selected.length, label: "Salvando..." });
      }
      toast.success(`${done} fotos vinculadas`);
      onApplied?.();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setApplying(false); }
  };

  const selCount = matches.filter(m => m.selected).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !running && !applying) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Importar Fotos do PDF (IA)
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm">Arquivo PDF (mesmo da matriz de utensílios)</Label>
                <Input type="file" accept="application/pdf" onChange={e => handleFile(e.target.files?.[0] ?? null)} disabled={running} />
                {file && <Badge variant="outline" className="text-xs"><FileUp className="h-3 w-3 mr-1" />{file.name}</Badge>}
                <p className="text-xs text-muted-foreground">
                  O PDF é processado no seu navegador página por página. A IA identifica o nome impresso e a região da foto, depois cruza com seu catálogo.
                </p>
              </CardContent>
            </Card>

            {running && (
              <div className="space-y-1.5">
                <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
                <p className="text-xs text-center text-muted-foreground">{progress.label} ({progress.done}/{progress.total})</p>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleExtract} disabled={!file || running}>
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {running ? "Processando..." : "Extrair fotos do PDF"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{matches.length} fotos identificadas</Badge>
              <Badge className="bg-primary text-primary-foreground">{selCount} selecionadas</Badge>
              <Button size="sm" variant="ghost" onClick={() => setMatches(prev => prev.map(m => ({ ...m, selected: true })))}>Marcar todas</Button>
              <Button size="sm" variant="ghost" onClick={() => setMatches(prev => prev.map(m => ({ ...m, selected: false })))}>Desmarcar</Button>
            </div>
            <ScrollArea className="flex-1 pr-2">
              {matches.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum match encontrado</CardContent></Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {matches.map((m, i) => (
                    <Card key={i} className={`overflow-hidden ${m.selected ? "ring-2 ring-primary" : ""}`}>
                      <div className="aspect-square bg-muted/40 relative">
                        <img src={m.cropDataUrl} alt={m.catalog_name} className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1">
                          <Checkbox checked={m.selected} onCheckedChange={(v) =>
                            setMatches(prev => prev.map((mm, j) => j === i ? { ...mm, selected: !!v } : mm))} />
                        </div>
                        <Badge className="absolute top-1 right-1 text-[10px] bg-black/60 text-white">
                          {Math.round(m.score * 100)}%
                        </Badge>
                      </div>
                      <CardContent className="p-2">
                        <p className="text-xs font-medium leading-tight line-clamp-2">{m.catalog_name}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">PDF: {m.pdf_name}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
            {applying && (
              <div className="space-y-1.5">
                <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
                <p className="text-xs text-center text-muted-foreground">{progress.label} ({progress.done}/{progress.total})</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)} disabled={applying}>Voltar</Button>
              <Button onClick={handleApply} disabled={selCount === 0 || applying}>
                {applying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Aplicar {selCount} foto(s)
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
