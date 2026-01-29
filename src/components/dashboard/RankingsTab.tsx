import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Star,
  ChefHat,
  Target,
  Filter,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Progress } from "@/components/ui/progress";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { usePerformanceEntries } from "@/hooks/usePerformanceEntries";
import { useSupervisionAudits } from "@/hooks/useSupervisionAudits";
import { useCargos, type Cargo, SETOR_BACK_LABELS } from "@/hooks/useCargos";
import { formatCurrency } from "@/lib/formatters";

// Brand patterns for filtering
const BRAND_PATTERNS: Record<string, string[]> = {
  caminito: ["CAMINITO", "CP"],
  nazo: ["NAZO", "NZ"],
  caju: ["CAJU", "CJ"],
  fosters: ["FOSTERS", "FB"],
};

interface RankingItem {
  id: string;
  nome: string;
  value: number;
  trend?: "up" | "down" | "stable";
  details?: string;
  badge?: string;
}

// Get position icon
const getPositionIcon = (position: number) => {
  switch (position) {
    case 1:
      return <Trophy className="h-5 w-5 text-amber-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-slate-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-700" />;
    default:
      return <span className="text-muted-foreground font-mono">{position}º</span>;
  }
};

// Get tier badge
const getTierBadge = (score: number) => {
  if (score >= 95) return <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white">OURO</Badge>;
  if (score >= 90) return <Badge className="bg-gradient-to-r from-slate-300 to-slate-500 text-white">PRATA</Badge>;
  if (score >= 80) return <Badge className="bg-gradient-to-r from-amber-600 to-amber-800 text-white">BRONZE</Badge>;
  return <Badge variant="destructive">RED FLAG</Badge>;
};

export function RankingsTab() {
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [selectedCargoId, setSelectedCargoId] = useState<string>("");
  const currentMonth = format(new Date(), "yyyy-MM");

  const { options: lojas, isLoading: isLoadingLojas } = useConfigLojas();
  const { aggregatedByStore, isLoading: isLoadingPerformance } = usePerformanceEntries();
  const { cargos, chefiasBack, isLoading: isLoadingCargos } = useCargos();
  
  // Get the last audits for supervision ranking
  const { audits, isLoadingAudits } = useSupervisionAudits(null);

  const isLoading = isLoadingLojas || isLoadingPerformance || isLoadingCargos || isLoadingAudits;

  // Filter stores by brand
  const filteredLojas = useMemo(() => {
    if (brandFilter === "all") return lojas;
    const patterns = BRAND_PATTERNS[brandFilter] || [];
    return lojas.filter((loja) =>
      patterns.some((pattern) => loja.nome.toUpperCase().includes(pattern))
    );
  }, [lojas, brandFilter]);

  // Ranking 1: NPS (Faturamento / Reclamações) by Unit
  const npsRanking = useMemo(() => {
    return filteredLojas
      .map((loja) => {
        const data = aggregatedByStore[loja.id];
        if (!data) return null;

        const faturamento = data.total_faturamento || 0;
        const reclamacoes = data.total_reclamacoes || 1;
        const efficiency = faturamento / reclamacoes;

        return {
          id: loja.id,
          nome: loja.nome,
          value: efficiency,
          faturamento,
          reclamacoes,
          details: `${formatCurrency(faturamento)} / ${reclamacoes} rec.`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.value || 0) - (a?.value || 0)) as (RankingItem & { faturamento: number; reclamacoes: number })[];
  }, [filteredLojas, aggregatedByStore]);

  // Ranking 2: Supervisão by Unit (latest audit score)
  const supervisaoRanking = useMemo(() => {
    // Group audits by loja and get the latest
    const latestByLoja = new Map<string, { score: number; date: string }>();
    
    for (const audit of audits) {
      const existing = latestByLoja.get(audit.loja_id);
      if (!existing || audit.audit_date > existing.date) {
        latestByLoja.set(audit.loja_id, { score: audit.global_score, date: audit.audit_date });
      }
    }

    return filteredLojas
      .map((loja) => {
        const auditData = latestByLoja.get(loja.id);
        if (!auditData) return null;

        return {
          id: loja.id,
          nome: loja.nome,
          value: auditData.score,
          details: format(new Date(auditData.date), "dd/MM/yyyy"),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.value || 0) - (a?.value || 0)) as RankingItem[];
  }, [filteredLojas, audits]);

  // Ranking 3: Reclamações x Faturamento (inverse efficiency - lower is better for complaints)
  const reclamacoesRanking = useMemo(() => {
    return filteredLojas
      .map((loja) => {
        const data = aggregatedByStore[loja.id];
        if (!data) return null;

        const faturamento = data.total_faturamento || 0;
        const reclamacoes = data.total_reclamacoes || 0;
        
        // Calculate complaints per R$ 100k of revenue
        const rate = faturamento > 0 ? (reclamacoes / faturamento) * 100000 : 0;

        return {
          id: loja.id,
          nome: loja.nome,
          value: rate,
          faturamento,
          reclamacoes,
          details: `${reclamacoes} recl. / ${formatCurrency(faturamento)}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a?.value || 0) - (b?.value || 0)) as (RankingItem & { faturamento: number; reclamacoes: number })[]; // Lower is better
  }, [filteredLojas, aggregatedByStore]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Marca:</span>
        </div>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="caminito">Caminito</SelectItem>
            <SelectItem value="nazo">Nazo</SelectItem>
            <SelectItem value="caju">Caju</SelectItem>
            <SelectItem value="fosters">Foster's</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="nps" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="nps" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            NPS Eficiência
          </TabsTrigger>
          <TabsTrigger value="supervisao" className="gap-2">
            <Target className="h-4 w-4" />
            Supervisão
          </TabsTrigger>
          <TabsTrigger value="reclamacoes" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Reclamações
          </TabsTrigger>
        </TabsList>

        {/* NPS Efficiency Ranking */}
        <TabsContent value="nps">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Ranking NPS por Unidade
              </CardTitle>
              <CardDescription>
                Eficiência = Faturamento ÷ Reclamações. Quanto maior, melhor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {npsRanking.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum dado de performance encontrado para o período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Reclamações</TableHead>
                      <TableHead className="text-right">Eficiência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {npsRanking.map((item, index) => (
                      <TableRow key={item.id} className={index < 3 ? "bg-muted/30" : ""}>
                        <TableCell>{getPositionIcon(index + 1)}</TableCell>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.faturamento)}</TableCell>
                        <TableCell className="text-right">{item.reclamacoes}</TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(item.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supervision Ranking */}
        <TabsContent value="supervisao">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Ranking Supervisão por Unidade
              </CardTitle>
              <CardDescription>
                Baseado na última auditoria de cada unidade.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {supervisaoRanking.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma auditoria encontrada para as unidades selecionadas.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Última Auditoria</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Tier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supervisaoRanking.map((item, index) => (
                      <TableRow key={item.id} className={index < 3 ? "bg-muted/30" : ""}>
                        <TableCell>{getPositionIcon(index + 1)}</TableCell>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{item.details}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={item.value} className="w-16 h-2" />
                            <span className="font-bold">{item.value.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {getTierBadge(item.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Complaints Ranking */}
        <TabsContent value="reclamacoes">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Ranking Reclamações x Faturamento
              </CardTitle>
              <CardDescription>
                Taxa = Reclamações por R$ 100k de faturamento. Quanto menor, melhor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reclamacoesRanking.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum dado de reclamações encontrado para o período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Reclamações</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Taxa/100k</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reclamacoesRanking.map((item, index) => (
                      <TableRow key={item.id} className={index < 3 ? "bg-muted/30" : ""}>
                        <TableCell>{getPositionIcon(index + 1)}</TableCell>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell className="text-right">{item.reclamacoes}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.faturamento)}</TableCell>
                        <TableCell className="text-right font-bold">
                          <span className={item.value < 5 ? "text-emerald-600" : item.value < 10 ? "text-amber-600" : "text-red-600"}>
                            {item.value.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
