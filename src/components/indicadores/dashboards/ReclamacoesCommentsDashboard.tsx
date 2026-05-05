import { useMemo, useState } from "react";
import { IndicadorDashboardShell } from "../IndicadorDashboardShell";
import type { BaseAvaliacoesData } from "@/lib/indicadores-parsers";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Search } from "lucide-react";
import { cn } from "@/lib/utils";

function notaColor(n: number) {
  if (n <= 2) return "bg-red-500 text-white";
  if (n === 3) return "bg-amber-500 text-white";
  return "bg-emerald-500 text-white";
}

function Mural({ data }: { data: BaseAvaliacoesData }) {
  const [busca, setBusca] = useState("");
  const [loja, setLoja] = useState<string>("__all__");
  const [filtro, setFiltro] = useState<"baixas" | "todas">("baixas");

  const lojas = useMemo(() => {
    const set = new Set(data.avaliacoes.map((a) => a.loja).filter(Boolean));
    return Array.from(set).sort();
  }, [data.avaliacoes]);

  const filtrados = useMemo(() => {
    return data.avaliacoes.filter((a) => {
      if (filtro === "baixas" && a.nota > 3) return false;
      if (loja !== "__all__" && a.loja !== loja) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (
          !a.comentario?.toLowerCase().includes(q) &&
          !a.autor?.toLowerCase().includes(q) &&
          !a.loja?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [data.avaliacoes, busca, loja, filtro]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar comentário, autor ou loja…" className="pl-8" />
        </div>
        <Select value={loja} onValueChange={setLoja}>
          <SelectTrigger className="md:w-56"><SelectValue placeholder="Todas lojas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas lojas</SelectItem>
            {lojas.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtro} onValueChange={(v: any) => setFiltro(v)}>
          <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="baixas">Apenas ≤ 3</SelectItem>
            <SelectItem value="todas">Todas as notas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">
        {filtrados.length} de {data.totalLinhas} avaliações
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtrados.map((a, i) => (
          <div key={i} className="rounded-xl border bg-white/70 backdrop-blur-md p-3 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1", notaColor(a.nota))}>
                <Star className="h-3 w-3 fill-current" /> {a.nota}
              </span>
              <span className="text-xs text-muted-foreground">{a.data}</span>
            </div>
            <div className="text-xs text-amber-700 font-medium truncate">{a.loja}</div>
            <p className="text-sm text-foreground/90 leading-snug line-clamp-5">{a.comentario || <em className="text-muted-foreground">(sem comentário)</em>}</p>
            {a.autor && <div className="text-xs text-muted-foreground truncate">— {a.autor}</div>}
          </div>
        ))}
        {filtrados.length === 0 && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-10">
            Nenhuma avaliação encontrada com os filtros atuais
          </div>
        )}
      </div>
    </div>
  );
}

export function ReclamacoesCommentsDashboard() {
  return (
    <IndicadorDashboardShell<BaseAvaliacoesData>
      metaKey="reclamacoes"
      subtitle="Mural de comentários — filtre por nota, loja e busca textual"
      render={(d) => <Mural data={d} />}
    />
  );
}
