import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquareWarning, Star, Filter, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { useReclamacoesConfig } from "@/hooks/useReclamacoesConfig";
import { format } from "date-fns";
import { PlanoAcaoDialog } from "./PlanoAcaoDialog";

interface Comentario {
  id: string;
  loja_codigo: string | null;
  canal: string | null;
  nota: number | null;
  data_comentario: string | null;
  autor: string | null;
  comentario: string;
  tags: string[];
  status: string;
}

export function ReclamacoesCommentsWall({ restrictToLojaCodigo }: { restrictToLojaCodigo?: string | null }) {
  const { config } = useReclamacoesConfig();
  const [busca, setBusca] = useState("");
  const [canal, setCanal] = useState<string>("all");
  const [notaMax, setNotaMax] = useState<number>(3);
  const [dataDe, setDataDe] = useState<string>("");
  const [dataAte, setDataAte] = useState<string>("");
  const [planoAlvo, setPlanoAlvo] = useState<Comentario | null>(null);

  const { data: comentarios = [], isLoading } = useQuery({
    queryKey: ["reclamacoes_comentarios", restrictToLojaCodigo],
    enabled: !!config?.enabled,
    queryFn: async () => {
      let q = supabase
        .from("reclamacoes_comentarios")
        .select("*")
        .order("data_comentario", { ascending: false })
        .limit(200);
      if (restrictToLojaCodigo) q = q.eq("loja_codigo", restrictToLojaCodigo);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Comentario[];
    },
  });

  // Carrega ids de comentarios que já têm plano de ação
  const { data: planosSet = new Set<string>() } = useQuery({
    queryKey: ["planos_acao_count", comentarios.map(c => c.id).join(",")],
    enabled: comentarios.length > 0,
    queryFn: async () => {
      const ids = comentarios.map(c => c.id);
      const { data, error } = await supabase
        .from("planos_acao")
        .select("comentario_id")
        .in("comentario_id", ids);
      if (error) throw error;
      return new Set((data || []).map((r: { comentario_id: string }) => r.comentario_id));
    },
  });

  const canais = useMemo(() => {
    const s = new Set<string>();
    comentarios.forEach((c) => c.canal && s.add(c.canal));
    return Array.from(s);
  }, [comentarios]);

  const filtered = useMemo(() => {
    return comentarios.filter((c) => {
      if (canal !== "all" && c.canal !== canal) return false;
      if (c.nota !== null && c.nota > notaMax) return false;
      if (busca && !c.comentario.toLowerCase().includes(busca.toLowerCase())) return false;
      if (dataDe && c.data_comentario && c.data_comentario < dataDe) return false;
      if (dataAte && c.data_comentario && c.data_comentario > dataAte) return false;
      return true;
    });
  }, [comentarios, canal, notaMax, busca, dataDe, dataAte]);

  if (!config?.enabled) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm uppercase tracking-wide">Mural de Comentários</CardTitle>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {filtered.length} comentários
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filtros de período */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            type="date"
            value={dataDe}
            onChange={(e) => setDataDe(e.target.value)}
            className="h-8 w-auto text-xs"
            placeholder="De"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={dataAte}
            onChange={(e) => setDataAte(e.target.value)}
            className="h-8 w-auto text-xs"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setDataDe(""); setDataAte(""); setBusca(""); setCanal("all"); setNotaMax(3); }}
          >
            Limpar filtros
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Buscar no texto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-xs h-8 text-xs"
          />
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            className="h-8 rounded-md border bg-background text-xs px-2"
          >
            <option value="all">Todos canais</option>
            {canais.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={notaMax}
            onChange={(e) => setNotaMax(Number(e.target.value))}
            className="h-8 rounded-md border bg-background text-xs px-2"
          >
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>até {n}★</option>)}
          </select>
          <Filter className="h-3 w-3 text-muted-foreground" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Nenhum comentário registrado ainda. Sincronize a planilha em Configurações.
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {filtered.map((c) => {
              const temPlano = planosSet.has(c.id);
              return (
                <div key={c.id} className="rounded-lg border bg-card/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {c.nota !== null && (
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                        c.nota >= 4 ? "bg-emerald-100 text-emerald-700" :
                        c.nota === 3 ? "bg-amber-100 text-amber-700" :
                        "bg-rose-100 text-rose-700"
                      }`}>
                        <Star className="h-3 w-3 fill-current" />{c.nota}
                      </span>
                    )}
                    {c.canal && <Badge variant="outline" className="text-[10px]">{c.canal}</Badge>}
                    {c.loja_codigo && <span className="font-mono">{c.loja_codigo}</span>}
                    {c.data_comentario && <span>· {format(new Date(c.data_comentario), "dd/MM/yyyy")}</span>}
                    <span className="ml-auto">{c.autor || "Anônimo"}</span>
                  </div>
                  <p className="text-xs leading-snug">{c.comentario}</p>
                  {c.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1 pt-1 items-center">
                    {temPlano ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Plano criado
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                        onClick={() => setPlanoAlvo(c)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Plano de Ação
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {planoAlvo && (
        <PlanoAcaoDialog
          open={!!planoAlvo}
          onOpenChange={(v) => !v && setPlanoAlvo(null)}
          comentarioId={planoAlvo.id}
          comentarioTexto={planoAlvo.comentario}
        />
      )}
    </Card>
  );
}
