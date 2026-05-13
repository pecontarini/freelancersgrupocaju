import { useMemo, useState } from "react";
import { Crown, Medal, Award, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useSheetsBlocks } from "@/hooks/useSheetsBlocks";
import { normalizeLojaCode } from "@/hooks/usePayoutSnapshot";

interface RankItem {
  posicao: number;
  loja_codigo: string;
  valor: number;
}

interface CategoryBlock {
  key: string;
  label: string;
  periodo: string;
  suffix: string;
  itens: RankItem[];
}

function pctColor(v: number): string {
  if (v <= 0) return "hsl(var(--muted-foreground))";
  if (v >= 90) return "#10B981";
  if (v >= 80) return "#F59E0B";
  if (v >= 70) return "#F97316";
  return "#EF4444";
}
function pctTier(v: number): string {
  if (v <= 0) return "Não auditada";
  if (v >= 90) return "Excelente";
  if (v >= 80) return "Bom";
  if (v >= 70) return "Atenção";
  return "Crítico";
}

const lojaNomeMap: Record<string, string> = {
  CP_AN: "CP Asa Norte",
  CP_AS: "CP Asa Sul",
  CP_AC: "CP Águas Claras",
  CP_SG: "CP SIG",
  CP_GO: "CP Goiânia",
  CJ_AN: "CJ Asa Norte",
  CJ_SG: "CJ SIG",
  CJ_SP: "CJ Itaim",
  NZ_AC: "NZ Águas Claras",
  NZ_AS: "NZ Asa Sul",
  NZ_SG: "NZ SIG",
  NZ_GO: "NZ Goiânia",
};
const lojaNome = (c: string) => lojaNomeMap[normalizeLojaCode(c)] ?? c;

function Podium({ itens, userN }: { itens: RankItem[]; userN: string | null }) {
  const top3 = itens.slice(0, 3);
  if (top3.length === 0) return null;
  const ordered = [top3[1], top3[0], top3[2]].filter(Boolean);
  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      {ordered.map((it) => {
        const isFirst = it.posicao === 1;
        const Icon = it.posicao === 1 ? Crown : it.posicao === 2 ? Medal : Award;
        const isUser = userN && normalizeLojaCode(it.loja_codigo) === userN;
        return (
          <div
            key={it.loja_codigo}
            className={`rounded-xl p-3 text-center border transition ${
              isFirst
                ? "bg-amber-500 border-amber-400 text-black scale-105 shadow-lg"
                : "bg-card border-border/50"
            } ${isUser ? "ring-2 ring-primary" : ""}`}
          >
            <Icon
              className={`h-5 w-5 mx-auto mb-1 ${
                isFirst ? "text-black" : it.posicao === 2 ? "text-slate-400" : "text-orange-500"
              }`}
            />
            <div className={`text-xs font-bold truncate ${isFirst ? "text-black/80" : "text-muted-foreground"}`}>
              {lojaNome(it.loja_codigo)}
            </div>
            <div className={`text-lg font-bold tabular-nums ${isFirst ? "text-black" : "text-foreground"}`}>
              {it.valor.toFixed(2)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Lista({ itens, userN }: { itens: RankItem[]; userN: string | null }) {
  const max = Math.max(...itens.map((i) => i.valor), 100);
  return (
    <div className="space-y-1.5">
      {itens.map((it) => {
        const color = pctColor(it.valor);
        const pct = Math.min((it.valor / max) * 100, 100);
        const isUser = userN && normalizeLojaCode(it.loja_codigo) === userN;
        return (
          <div
            key={`${it.posicao}-${it.loja_codigo}`}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
              isUser ? "bg-primary/10 border-primary/40" : "bg-card/50 border-border/30"
            }`}
          >
            <span className="text-xs font-mono text-muted-foreground w-6 text-right">{it.posicao}º</span>
            <span className="text-sm font-medium flex-1 truncate">{lojaNome(it.loja_codigo)}</span>
            <div className="hidden sm:block flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[160px]">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-[10px] uppercase font-semibold w-20 text-right" style={{ color }}>
              {pctTier(it.valor)}
            </span>
            <span className="text-sm font-semibold tabular-nums w-16 text-right" style={{ color }}>
              {it.valor.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SupervisoresRankingTab({ userLojaCode }: { userLojaCode?: string | null }) {
  const { blocks, loading, error } = useSheetsBlocks("ranking-supervisores");
  const [tab, setTab] = useState<string>("");

  const categories = useMemo<CategoryBlock[]>(() => {
    const cats: CategoryBlock[] = [];
    for (const b of blocks) {
      if (b.block_type !== "ranking") continue;
      const itens = (b.payload?.items ?? []) as RankItem[];
      if (!itens.length) continue;
      cats.push({
        key: b.block_key,
        label: b.payload?.label ?? b.block_key,
        periodo: b.payload?.periodo ?? "",
        suffix: b.payload?.suffix ?? "%",
        itens: [...itens].sort((a, b) => a.posicao - b.posicao),
      });
    }
    return cats;
  }, [blocks]);

  const userN = userLojaCode ? normalizeLojaCode(userLojaCode) : null;
  const activeKey = tab || categories[0]?.key || "";
  const active = categories.find((c) => c.key === activeKey) ?? categories[0];
  const periodo = categories.find((c) => c.periodo)?.periodo ?? "";

  if (loading) {
    return <div className="glass-card p-12 text-center text-sm text-muted-foreground">Carregando ranking…</div>;
  }
  if (error) {
    return <div className="glass-card p-6 text-sm text-destructive">{error}</div>;
  }
  if (categories.length === 0) {
    return (
      <div className="glass-card p-6 text-sm text-muted-foreground">
        Nenhum bloco de ranking disponível. Sincronize a planilha de supervisores.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Ranking de Supervisores
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {periodo ? `Período: ${periodo} · ` : ""}
              {categories.length} categoria{categories.length > 1 ? "s" : ""} de supervisão
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px]">≥90% Excelente</Badge>
            <Badge variant="outline" className="text-[10px]">80-89% Bom</Badge>
            <Badge variant="outline" className="text-[10px]">70-79% Atenção</Badge>
            <Badge variant="outline" className="text-[10px]">{`<70% Crítico`}</Badge>
          </div>
        </div>
      </div>

      <Tabs value={activeKey} onValueChange={setTab} className="w-full">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto p-1 gap-1">
            {categories.map((c) => (
              <TabsTrigger key={c.key} value={c.key} className="text-xs">
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {categories.map((c) => (
          <TabsContent key={c.key} value={c.key} className="mt-4 space-y-4">
            <div className="glass-card p-4 md:p-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                Pódio · {c.label}
              </div>
              <Podium itens={c.itens} userN={userN} />
            </div>
            <div className="glass-card p-4 md:p-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                Ranking completo ({c.itens.length})
              </div>
              <Lista itens={c.itens} userN={userN} />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
