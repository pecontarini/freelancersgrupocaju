import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { useMissoes } from "@/hooks/useMissoes";
import { supabase } from "@/integrations/supabase/client";
import { useUnidadeMembros } from "@/hooks/useUnidadeMembros";
import { MissaoDetailDialog } from "../card/MissaoDetailDialog";
import { PrioridadeBadge, StatusBadge } from "../shared/Badges";

export function DiretoriaView() {
  const { data: missoes = [], isLoading } = useMissoes({ unidadeId: null });
  const { data: membros = [] } = useUnidadeMembros(null);

  const [responsaveisMap, setResponsaveisMap] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [lojas, setLojas] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from("config_lojas")
      .select("id, nome")
      .then(({ data }) => {
        const m: Record<string, string> = {};
        (data ?? []).forEach((l: any) => {
          m[l.id] = l.nome;
        });
        setLojas(m);
      });
  }, []);

  useEffect(() => {
    if (missoes.length === 0) return;
    const ids = missoes.map((m) => m.id);
    supabase
      .from("missao_membros" as any)
      .select("missao_id, user_id, papel")
      .in("missao_id", ids)
      .eq("papel", "responsavel")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((r: any) => {
          const m = membros.find((x) => x.user_id === r.user_id);
          map[r.missao_id] = m?.nome ?? "—";
        });
        setResponsaveisMap(map);
      });
  }, [missoes, membros]);

  const porUnidade = useMemo(() => {
    const map = new Map<string, { total: number; done: number; nome: string }>();
    missoes.forEach((m) => {
      const key = m.unidade_id ?? "sem-unidade";
      const nome = m.unidade_id ? lojas[m.unidade_id] ?? "—" : "Sem unidade";
      const cur = map.get(key) ?? { total: 0, done: 0, nome };
      cur.total += 1;
      if (m.status === "concluido") cur.done += 1;
      cur.nome = nome;
      map.set(key, cur);
    });
    return Array.from(map.entries()).map(([k, v]) => ({
      key: k,
      nome: v.nome,
      total: v.total,
      done: v.done,
      pct: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }));
  }, [missoes, lojas]);

  const porResponsavel = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    Object.entries(responsaveisMap).forEach(([missaoId, nome]) => {
      const missao = missoes.find((mm) => mm.id === missaoId);
      if (!missao) return;
      const cur = map.get(nome) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (missao.status === "concluido") cur.done += 1;
      map.set(nome, cur);
    });
    return Array.from(map.entries())
      .map(([nome, v]) => ({
        nome,
        total: v.total,
        done: v.done,
        pct: v.total ? Math.round((v.done / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [responsaveisMap, missoes]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Execução por unidade
          </h3>
          <div className="space-y-3">
            {porUnidade.map((u) => (
              <div key={u.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{u.nome}</span>
                  <span className="text-muted-foreground">
                    {u.done}/{u.total} ({u.pct}%)
                  </span>
                </div>
                <Progress value={u.pct} className="h-2" />
              </div>
            ))}
            {porUnidade.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            )}
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Execução por responsável
          </h3>
          <div className="space-y-3">
            {porResponsavel.map((r) => (
              <div key={r.nome}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{r.nome}</span>
                  <span className="text-muted-foreground">
                    {r.done}/{r.total} ({r.pct}%)
                  </span>
                </div>
                <Progress value={r.pct} className="h-2" />
              </div>
            ))}
            {porResponsavel.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Todas as missões ({missoes.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="px-2 py-2 text-left">Missão</th>
                <th className="px-2 py-2 text-left">Unidade</th>
                <th className="px-2 py-2 text-left">Responsável</th>
                <th className="px-2 py-2 text-left">Prioridade</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {missoes.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setOpenId(m.id)}
                  className="cursor-pointer border-b border-border/40 hover:bg-muted/40"
                >
                  <td className="max-w-xs truncate px-2 py-2 font-medium">{m.titulo}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {m.unidade_id ? lojas[m.unidade_id] ?? "—" : "—"}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{responsaveisMap[m.id] ?? "—"}</td>
                  <td className="px-2 py-2">
                    <PrioridadeBadge prioridade={m.prioridade} className="px-1.5 py-0 text-[10px]" />
                  </td>
                  <td className="px-2 py-2">
                    <StatusBadge status={m.status} className="px-1.5 py-0 text-[10px]" />
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {m.prazo
                      ? new Date(m.prazo + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
              {missoes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma missão criada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MissaoDetailDialog missaoId={openId} open={!!openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
