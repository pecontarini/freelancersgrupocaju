import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Search, Filter, MessageSquare } from "lucide-react";
import { IndicadorDashboardShell } from "../IndicadorDashboardShell";
import { MetricCard, KpiBlock, CountUp } from "../shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { BaseAvaliacoesData, AvaliacaoItem } from "@/lib/indicadores-parsers";
import { cn } from "@/lib/utils";

const PAGE = 24;

function Stars({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i <= n ? "text-amber-400 fill-amber-400" : "text-white/20",
          )}
        />
      ))}
    </div>
  );
}

function CommentCard({ a, idx }: { a: AvaliacaoItem; idx: number }) {
  const [expand, setExpand] = useState(false);
  const long = (a.comentario?.length ?? 0) > 220;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(idx, 10) * 0.02 }}
      className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 space-y-2 hover:border-amber-500/20 transition"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-amber-400 truncate">{a.loja}</span>
        <span className="text-[11px] text-white/40">{a.data}</span>
      </div>
      <Stars n={a.nota} />
      <motion.p
        layout
        className={cn(
          "text-sm text-white/85 leading-snug",
          !expand && long && "line-clamp-4",
        )}
      >
        {a.comentario || <em className="text-white/40">(sem comentário)</em>}
      </motion.p>
      {long && (
        <button
          onClick={() => setExpand((s) => !s)}
          className="text-xs text-amber-400 hover:text-amber-300"
        >
          {expand ? "ver menos" : "ver mais"}
        </button>
      )}
      {a.autor && <div className="text-[11px] text-white/40 italic truncate">— {a.autor}</div>}
    </motion.div>
  );
}

function Mural({ data }: { data: BaseAvaliacoesData }) {
  const [busca, setBusca] = useState("");
  const [loja, setLoja] = useState("__all__");
  const [filtro, setFiltro] = useState<"baixas" | "todas">("baixas");
  const [openFilters, setOpenFilters] = useState(true);
  const [page, setPage] = useState(1);

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

  const visible = filtrados.slice(0, page * PAGE);

  // KPIs
  const kpis = useMemo(() => {
    const total = data.avaliacoes.length;
    const nota1 = data.avaliacoes.filter((a) => a.nota === 1).length;
    const pctNota1 = total > 0 ? (nota1 / total) * 100 : 0;
    const counts = new Map<string, number>();
    for (const a of data.avaliacoes) {
      if (a.nota <= 3) counts.set(a.loja, (counts.get(a.loja) ?? 0) + 1);
    }
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return { total, pctNota1, ofensor: top?.[0] ?? "—", ofensorN: top?.[1] ?? 0 };
  }, [data.avaliacoes]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiBlock
          index={0}
          label="Total avaliações"
          value={<CountUp value={kpis.total} />}
          color="#F59E0B"
        />
        <KpiBlock
          index={1}
          label="% Nota 1"
          value={<CountUp value={kpis.pctNota1} decimals={1} suffix="%" />}
          color="#EF4444"
        />
        <KpiBlock
          index={2}
          label="Loja com mais reclamações"
          value={<span className="text-xl">{kpis.ofensor}</span>}
          hint={`${kpis.ofensorN} avaliações ≤3`}
          color="#F59E0B"
        />
      </div>

      <MetricCard className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setOpenFilters((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-amber-400 transition"
          >
            <Filter className="h-4 w-4" />
            Filtros
            <span className="text-xs text-white/40">
              ({filtrados.length} de {data.totalLinhas})
            </span>
          </button>
        </div>
        <AnimatePresence>
          {openFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col md:flex-row gap-2 pt-1">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <Input
                    value={busca}
                    onChange={(e) => { setBusca(e.target.value); setPage(1); }}
                    placeholder="Buscar comentário, autor ou loja…"
                    className="pl-8 bg-white/[0.04] border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <Select value={loja} onValueChange={(v) => { setLoja(v); setPage(1); }}>
                  <SelectTrigger className="md:w-56 bg-white/[0.04] border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas lojas</SelectItem>
                    {lojas.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtro} onValueChange={(v: any) => { setFiltro(v); setPage(1); }}>
                  <SelectTrigger className="md:w-44 bg-white/[0.04] border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixas">Apenas ≤ 3</SelectItem>
                    <SelectItem value="todas">Todas as notas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </MetricCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence>
          {visible.map((a, i) => <CommentCard key={`${a.loja}-${a.data}-${i}`} a={a} idx={i} />)}
        </AnimatePresence>
        {filtrados.length === 0 && (
          <div className="col-span-full text-center py-12">
            <MessageSquare className="h-10 w-10 mx-auto text-white/20 mb-2" />
            <p className="text-sm text-white/50">Nenhuma avaliação encontrada</p>
          </div>
        )}
      </div>

      {visible.length < filtrados.length && (
        <div className="flex justify-center pt-2">
          <Button
            onClick={() => setPage((p) => p + 1)}
            variant="outline"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          >
            Carregar mais {Math.min(PAGE, filtrados.length - visible.length)}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ReclamacoesCommentsDashboard() {
  return (
    <IndicadorDashboardShell<BaseAvaliacoesData>
      metaKey="reclamacoes"
      subtitle="Mural de comentários — filtros, busca e expansão"
      render={(d) => <Mural data={d} />}
    />
  );
}
