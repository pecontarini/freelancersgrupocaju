import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquareWarning, Star, Filter, Loader2 } from "lucide-react";
import { useReclamacoesConfig } from "@/hooks/useReclamacoesConfig";
import { format } from "date-fns";

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

/**
 * Mural de Comentários — visível somente quando reclamacoes_config.enabled = true.
 */
export function ReclamacoesCommentsWall({ restrictToLojaCodigo }: { restrictToLojaCodigo?: string | null }) {
  const { config } = useReclamacoesConfig();
  const [busca, setBusca] = useState("");
  const [canal, setCanal] = useState<string>("all");
  const [notaMax, setNotaMax] = useState<number>(3);

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
      return true;
    });
  }, [comentarios, canal, notaMax, busca]);

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
            {filtered.map((c) => (
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
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2">Em análise</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2">Plano de ação</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
