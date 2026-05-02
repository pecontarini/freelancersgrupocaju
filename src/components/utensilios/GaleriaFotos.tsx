import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon, Upload, Wand2, Loader2, Search, Sparkles, FileUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
import { PdfPhotosImportDialog } from "./PdfPhotosImportDialog";

type CatalogItem = {
  id: string;
  name: string;
  code: string;
  fornecedor_sugerido: string | null;
  foto_url: string | null;
};

async function uploadToStorage(file: Blob, ext: string, slug: string): Promise<string> {
  const path = `manual/${slug}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("utensilios-photos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("utensilios-photos").getPublicUrl(path);
  return data.publicUrl;
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function GaleriaFotos() {
  const { isAdmin, isGerenteUnidade } = useUserProfile();
  const canEdit = isAdmin || isGerenteUnidade;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"sem" | "com" | "todos">("sem");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [bulkRunning, setBulkRunning] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: catalog, isLoading } = useQuery({
    queryKey: ["utensilios_catalog_gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items_catalog")
        .select("id, name, code, fornecedor_sugerido, foto_url")
        .eq("is_utensilio", true).eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CatalogItem[];
    },
  });

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = search.toLowerCase();
    return catalog.filter(c => {
      if (filter === "sem" && c.foto_url) return false;
      if (filter === "com" && !c.foto_url) return false;
      if (q && !(c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [catalog, search, filter]);

  const counts = useMemo(() => {
    const total = catalog?.length || 0;
    const com = catalog?.filter(c => !!c.foto_url).length || 0;
    return { total, com, sem: total - com };
  }, [catalog]);

  const updateFotoMut = useMutation({
    mutationFn: async ({ id, foto_url }: { id: string; foto_url: string | null }) => {
      const { error } = await supabase.from("items_catalog").update({ foto_url }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["utensilios_catalog_gallery"] }),
  });

  const handleManualUpload = async (item: CatalogItem, file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return; }
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const url = await uploadToStorage(file, ext, slugify(item.name));
      await updateFotoMut.mutateAsync({ id: item.id, foto_url: url });
      toast.success("Foto atualizada");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAIGenerate = async (item: CatalogItem) => {
    setGeneratingId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-utensilio-image", {
        body: { nome: item.name, fornecedor: item.fornecedor_sugerido },
      });
      if (error) throw error;
      if (!data?.foto_url) throw new Error("IA não retornou imagem");
      await updateFotoMut.mutateAsync({ id: item.id, foto_url: data.foto_url });
      toast.success("Imagem gerada");
    } catch (e: any) { toast.error(e.message || "Falha ao gerar"); }
    finally { setGeneratingId(null); }
  };

  const handleBulkGenerate = async () => {
    const targets = (catalog || []).filter(c => !c.foto_url);
    if (targets.length === 0) { toast.info("Nenhum item sem foto"); return; }
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length, errors: 0 });

    const concurrency = 3;
    let idx = 0;
    let errors = 0;
    const worker = async () => {
      while (idx < targets.length) {
        const i = idx++;
        const it = targets[i];
        try {
          const { data, error } = await supabase.functions.invoke("generate-utensilio-image", {
            body: { nome: it.name, fornecedor: it.fornecedor_sugerido },
          });
          if (error) throw error;
          if (data?.foto_url) {
            await supabase.from("items_catalog").update({ foto_url: data.foto_url }).eq("id", it.id);
          } else { errors++; }
        } catch (e: any) {
          errors++;
          console.error("bulk gen", it.name, e?.message);
        }
        setBulkProgress(p => ({ done: p.done + 1, total: targets.length, errors }));
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    setBulkRunning(false);
    qc.invalidateQueries({ queryKey: ["utensilios_catalog_gallery"] });
    toast.success(`Concluído: ${targets.length - errors} geradas, ${errors} falharam`);
  };

  if (!canEdit) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
      Apenas administradores e gerentes podem editar fotos.
    </CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar utensílio..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sem">Sem foto ({counts.sem})</SelectItem>
              <SelectItem value="com">Com foto ({counts.com})</SelectItem>
              <SelectItem value="todos">Todos ({counts.total})</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setPdfOpen(true)}>
            <FileUp className="h-4 w-4 mr-2" /> Importar fotos do PDF
          </Button>
          <Button onClick={() => setBulkOpen(true)} disabled={counts.sem === 0}>
            <Sparkles className="h-4 w-4 mr-2" /> Gerar todas com IA ({counts.sem})
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum item.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(item => (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-square bg-muted/40 flex items-center justify-center relative">
                {item.foto_url ? (
                  <img src={item.foto_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>
              <CardContent className="p-2 space-y-1.5">
                <p className="text-xs font-medium leading-tight line-clamp-2 min-h-[2.2em]">{item.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.fornecedor_sugerido || item.code}
                </p>
                <div className="flex items-center gap-1">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={el => (fileInputs.current[item.id] = el)}
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleManualUpload(item, f);
                      e.target.value = "";
                    }}
                  />
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs px-1"
                    onClick={() => fileInputs.current[item.id]?.click()}
                    title={item.foto_url ? "Substituir foto" : "Subir foto"}>
                    {item.foto_url ? <RefreshCw className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs px-1"
                    disabled={generatingId === item.id}
                    onClick={() => handleAIGenerate(item)} title="Gerar com IA">
                    {generatingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk AI dialog */}
      <Dialog open={bulkOpen} onOpenChange={(v) => { if (!bulkRunning) setBulkOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gerar todas faltantes com IA</DialogTitle></DialogHeader>
          {!bulkRunning && bulkProgress.total === 0 && (
            <div className="space-y-2 text-sm">
              <p>Serão geradas <strong>{counts.sem}</strong> imagens via IA. Pode levar alguns minutos.</p>
              <p className="text-xs text-muted-foreground">Cada imagem consome créditos do gateway. Itens com erro serão pulados.</p>
            </div>
          )}
          {(bulkRunning || bulkProgress.total > 0) && (
            <div className="space-y-2">
              <Progress value={bulkProgress.total ? (bulkProgress.done / bulkProgress.total) * 100 : 0} />
              <p className="text-xs text-center text-muted-foreground">
                {bulkProgress.done} / {bulkProgress.total} {bulkProgress.errors > 0 && `· ${bulkProgress.errors} erros`}
              </p>
            </div>
          )}
          <DialogFooter>
            {!bulkRunning && (
              <>
                <Button variant="ghost" onClick={() => { setBulkOpen(false); setBulkProgress({ done: 0, total: 0, errors: 0 }); }}>
                  Fechar
                </Button>
                {bulkProgress.total === 0 && (
                  <Button onClick={handleBulkGenerate}>
                    <Sparkles className="h-4 w-4 mr-2" /> Iniciar
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPhotosImportDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        catalog={catalog || []}
        onApplied={() => qc.invalidateQueries({ queryKey: ["utensilios_catalog_gallery"] })}
      />
    </div>
  );
}
