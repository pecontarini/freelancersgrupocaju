import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Database,
  History,
  Save,
  Plus,
  Target,
  Users,
  Building2,
  Loader2,
  ChevronDown,
  Link2,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface HoldingCentralTabProps {
  selectedUnidadeId: string | null;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function truncateUrl(url: string, max = 60): string {
  if (!url) return "—";
  return url.length > max ? `${url.slice(0, max)}…` : url;
}

const DIAS_SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
const TURNOS = ["MANHA", "TARDE", "NOITE", "ALMOCO", "JANTAR"] as const;
const SETORES = ["salao", "delivery", "cozinha", "bar", "parrilla", "sushi", "caixa"] as const;

// ──────────────────────────────────────────────────────────────
// Root
// ──────────────────────────────────────────────────────────────

export function HoldingCentralTab({ selectedUnidadeId }: HoldingCentralTabProps) {
  return (
    <Tabs defaultValue="upload" className="space-y-4">
      <TabsList className="h-auto w-full justify-start gap-1 bg-muted/40 p-1 flex-wrap">
        <TabsTrigger
          value="upload"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
        >
          <Database className="h-4 w-4" />
          <span>Upload de Dados</span>
        </TabsTrigger>
        <TabsTrigger
          value="metas"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
        >
          <Target className="h-4 w-4" />
          <span>Config de Metas</span>
        </TabsTrigger>
        <TabsTrigger
          value="escalas"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
        >
          <Users className="h-4 w-4" />
          <span>Escalas Mínimas</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-4 space-y-4">
        <UploadDadosView />
      </TabsContent>
      <TabsContent value="metas" className="mt-4 space-y-4">
        <MetasView />
      </TabsContent>
      <TabsContent value="escalas" className="mt-4 space-y-4">
        <EscalasView selectedUnidadeId={selectedUnidadeId} />
      </TabsContent>
    </Tabs>
  );
}

// ──────────────────────────────────────────────────────────────
// ABA A — Upload de Dados
// ──────────────────────────────────────────────────────────────

function UploadDadosView() {
  return (
    <div className="space-y-4">
      <AiImportSection />
      <SheetsSourcesSection />
      <SincronizacoesHistorySection />
      <LancamentoManualSection />
    </div>
  );
}

function SheetsSourcesSection() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: sources, isLoading } = useQuery({
    queryKey: ["holding-sheets-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sheets_sources")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("sheets_sources")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holding-sheets-sources"] });
      toast.success("Fonte atualizada.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Fontes de Dados (Google Sheets)</CardTitle>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Fonte
            </Button>
          </DialogTrigger>
          <NovaFonteDialog onClose={() => setOpen(false)} />
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !sources || sources.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma fonte cadastrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead>Última Sincronização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((src: any) => (
                  <TableRow key={src.id}>
                    <TableCell className="font-medium">{src.nome}</TableCell>
                    <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        title={src.url}
                        className="hover:text-primary hover:underline"
                      >
                        {truncateUrl(src.url)}
                      </a>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={!!src.ativo}
                        onCheckedChange={(v) =>
                          toggleAtivo.mutate({ id: src.id, ativo: v })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {src.ultima_sincronizacao
                        ? format(new Date(src.ultima_sincronizacao), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })
                        : "Nunca"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NovaFonteDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [gid, setGid] = useState("0");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sheets_sources").insert({
        nome: nome.trim(),
        url: url.trim(),
        gid: gid.trim() || "0",
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holding-sheets-sources"] });
      toast.success("Fonte adicionada com sucesso!");
      setNome("");
      setUrl("");
      setGid("0");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao adicionar fonte."),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nova Fonte de Dados</DialogTitle>
        <DialogDescription>
          Adicione uma nova planilha Google Sheets como fonte de sincronização.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="src-nome">Nome</Label>
          <Input
            id="src-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Faturamento Diário"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="src-url">URL (export CSV)</Label>
          <Input
            id="src-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="src-gid">GID</Label>
          <Input
            id="src-gid"
            value={gid}
            onChange={(e) => setGid(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => create.mutate()}
          disabled={!nome.trim() || !url.trim() || create.isPending}
        >
          {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function statusVariant(status: string): { label: string; className: string } {
  switch ((status || "").toLowerCase()) {
    case "concluido":
    case "concluído":
    case "ok":
    case "success":
      return { label: "concluído", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" };
    case "erro":
    case "error":
    case "failed":
      return { label: "erro", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" };
    case "processando":
    case "processing":
    case "running":
      return { label: "processando", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" };
    default:
      return { label: status || "—", className: "bg-muted text-muted-foreground border-muted" };
  }
}

function SincronizacoesHistorySection() {
  const { data, isLoading } = useQuery({
    queryKey: ["holding-sincronizacoes-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sincronizacoes_sheets")
        .select("*, config_lojas(nome)")
        .order("created_at", { ascending: false })
        .range(0, 19);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Histórico de Sincronizações</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma sincronização registrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s: any) => {
                  const sv = statusVariant(s.status);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.config_lojas?.nome ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{s.referencia_mes ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.linhas_importadas ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", sv.className)}>
                          {sv.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LancamentoManualSection() {
  const queryClient = useQueryClient();
  const [lojaId, setLojaId] = useState<string>("");
  const [mes, setMes] = useState<string>(currentMonth());
  const [faturamento, setFaturamento] = useState<string>("");
  const [reclamacoes, setReclamacoes] = useState<string>("");
  const [supervisao, setSupervisao] = useState<number>(0);
  const [nps, setNps] = useState<number>(0);

  const { data: lojas } = useQuery({
    queryKey: ["holding-lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_lojas")
        .select("id, nome")
        .order("nome", { ascending: true })
        .range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        loja_id: lojaId,
        month_year: mes,
        faturamento: faturamento ? Number(faturamento) : 0,
        num_reclamacoes: reclamacoes ? Number(reclamacoes) : 0,
        supervisao_score: supervisao,
        nps_score: nps,
      };
      const { error } = await supabase
        .from("store_performance")
        .upsert(payload, { onConflict: "loja_id,month_year" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holding-store-performance"] });
      toast.success("Performance lançada/atualizada com sucesso!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar."),
  });

  const canSubmit = lojaId && /^\d{4}-\d{2}$/.test(mes);

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Save className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Lançamento Manual de Performance</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {(lojas ?? []).map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Faturamento (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={faturamento}
              onChange={(e) => setFaturamento(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nº Reclamações</Label>
            <Input
              type="number"
              min="0"
              value={reclamacoes}
              onChange={(e) => setReclamacoes(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>Score Supervisão</Label>
              <span className="font-semibold tabular-nums">{supervisao.toFixed(0)}%</span>
            </div>
            <Slider
              value={[supervisao]}
              onValueChange={(v) => setSupervisao(v[0])}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>Score NPS</Label>
              <span className="font-semibold tabular-nums">{nps.toFixed(0)}%</span>
            </div>
            <Slider
              value={[nps]}
              onValueChange={(v) => setNps(v[0])}
              min={0}
              max={100}
              step={1}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => upsert.mutate()}
            disabled={!canSubmit || upsert.isPending}
            className="gap-2"
          >
            {upsert.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Performance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────
// ABA B — Config de Metas
// ──────────────────────────────────────────────────────────────

function MetasView() {
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [filterFamilia, setFilterFamilia] = useState<string>("all");

  const { data: cargos, isLoading } = useQuery({
    queryKey: ["holding-cargos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true })
        .range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (cargos ?? []).filter((c: any) => {
      if (filterCategoria !== "all" && c.categoria !== filterCategoria) return false;
      if (filterFamilia !== "all" && c.familia_operacional !== filterFamilia) return false;
      return true;
    });
  }, [cargos, filterCategoria, filterFamilia]);

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Metas por Cargo</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="gerencia">Gerência</SelectItem>
                <SelectItem value="chefia">Chefia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Família Operacional</Label>
            <Select value={filterFamilia} onValueChange={setFilterFamilia}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="front">Front</SelectItem>
                <SelectItem value="back">Back</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum cargo encontrado com os filtros aplicados.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((cargo: any) => (
              <CargoRow key={cargo.id} cargo={cargo} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CargoRow({ cargo }: { cargo: any }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border border-border/60 bg-card/40">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40"
          >
            <div className="flex items-center gap-2">
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  open && "rotate-180"
                )}
              />
              <span className="font-medium">{cargo.nome}</span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {cargo.categoria}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase">
                {cargo.familia_operacional}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Pote máx: R$ {Number(cargo.pote_variavel_max ?? 0).toLocaleString("pt-BR")}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/60 px-3 py-3">
            <MetasCargoEditor cargoId={cargo.id} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function MetasCargoEditor({ cargoId }: { cargoId: string }) {
  const queryClient = useQueryClient();

  const { data: metas, isLoading } = useQuery({
    queryKey: ["holding-metas-cargo", cargoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_cargo")
        .select("*")
        .eq("cargo_id", cargoId)
        .order("codigo_meta", { ascending: true })
        .range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateMeta = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { teto_valor?: number; peso?: number; ativo?: boolean };
    }) => {
      const { error } = await supabase.from("metas_cargo").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holding-metas-cargo", cargoId] });
      toast.success("Meta atualizada.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!metas || metas.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        Nenhuma meta cadastrada para este cargo.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead className="w-32">Teto (R$)</TableHead>
            <TableHead className="w-24">Peso</TableHead>
            <TableHead className="w-20 text-center">Ativo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metas.map((m: any) => (
            <TableRow key={m.id}>
              <TableCell className="text-xs font-medium uppercase">
                {m.codigo_meta}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={m.teto_valor ?? 0}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (val !== Number(m.teto_valor)) {
                      updateMeta.mutate({ id: m.id, patch: { teto_valor: val } });
                    }
                  }}
                  className="h-8 text-sm"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={m.peso ?? 0}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (val !== Number(m.peso)) {
                      updateMeta.mutate({ id: m.id, patch: { peso: val } });
                    }
                  }}
                  className="h-8 text-sm"
                />
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={!!m.ativo}
                  onCheckedChange={(v) =>
                    updateMeta.mutate({ id: m.id, patch: { ativo: v } })
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ABA C — Escalas Mínimas
// ──────────────────────────────────────────────────────────────

function EscalasView({ selectedUnidadeId }: { selectedUnidadeId: string | null }) {
  const queryClient = useQueryClient();
  const [unidade, setUnidade] = useState<string>(selectedUnidadeId ?? "");
  const [open, setOpen] = useState(false);

  const { data: lojas } = useQuery({
    queryKey: ["holding-lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_lojas")
        .select("id, nome")
        .order("nome", { ascending: true })
        .range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pracas, isLoading } = useQuery({
    queryKey: ["holding-pracas", unidade],
    queryFn: async () => {
      if (!unidade) return [];
      const { data, error } = await supabase
        .from("pracas_plano_chao")
        .select("*")
        .eq("unit_id", unidade)
        .order("dia_semana", { ascending: true })
        .range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!unidade,
  });

  const updateQtd = useMutation({
    mutationFn: async ({ id, qtd }: { id: string; qtd: number }) => {
      const { error } = await supabase
        .from("pracas_plano_chao")
        .update({ qtd_necessaria: qtd })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holding-pracas", unidade] });
      toast.success("Praça atualizada.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Escalas Mínimas (Plano de Chão)</CardTitle>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!unidade} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Praça
            </Button>
          </DialogTrigger>
          <NovaPracaDialog
            unitId={unidade}
            onClose={() => setOpen(false)}
          />
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Unidade</Label>
          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma unidade" />
            </SelectTrigger>
            <SelectContent>
              {(lojas ?? []).map((l: any) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!unidade ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Selecione uma unidade para ver as praças.
          </p>
        ) : isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !pracas || pracas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma praça configurada para esta unidade.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Praça</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead className="w-32 text-right">Qtd Necessária</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pracas.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome_praca}</TableCell>
                    <TableCell className="text-xs uppercase">{p.setor}</TableCell>
                    <TableCell className="text-xs uppercase">{p.turno}</TableCell>
                    <TableCell className="text-xs uppercase">{p.dia_semana}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        defaultValue={p.qtd_necessaria}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (val !== Number(p.qtd_necessaria)) {
                            updateQtd.mutate({ id: p.id, qtd: val });
                          }
                        }}
                        className="h-8 w-24 text-right text-sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NovaPracaDialog({
  unitId,
  onClose,
}: {
  unitId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [nomePraca, setNomePraca] = useState("");
  const [setor, setSetor] = useState<string>("");
  const [turno, setTurno] = useState<string>("");
  const [diaSemana, setDiaSemana] = useState<string>("");
  const [qtd, setQtd] = useState<string>("1");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pracas_plano_chao").insert({
        unit_id: unitId,
        nome_praca: nomePraca.trim(),
        setor,
        turno,
        dia_semana: diaSemana,
        qtd_necessaria: Number(qtd) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holding-pracas", unitId] });
      toast.success("Praça criada com sucesso!");
      setNomePraca("");
      setSetor("");
      setTurno("");
      setDiaSemana("");
      setQtd("1");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao criar praça."),
  });

  const canSubmit = unitId && nomePraca.trim() && setor && turno && diaSemana;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nova Praça</DialogTitle>
        <DialogDescription>
          Adicione uma nova posição mínima ao plano de chão da unidade.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="space-y-1.5">
          <Label>Nome da Praça</Label>
          <Input
            value={nomePraca}
            onChange={(e) => setNomePraca(e.target.value)}
            placeholder="Ex.: Praça do Salão Direita"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Setor</Label>
            <Select value={setor} onValueChange={setSetor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {SETORES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Turno</Label>
            <Select value={turno} onValueChange={setTurno}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TURNOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Dia da Semana</Label>
            <Select value={diaSemana} onValueChange={setDiaSemana}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {DIAS_SEMANA.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Qtd Necessária</Label>
            <Input
              type="number"
              min="1"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => create.mutate()}
          disabled={!canSubmit || create.isPending}
        >
          {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar Praça
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
