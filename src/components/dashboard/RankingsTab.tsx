import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  AlertTriangle,
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
import { useReclamacoes } from "@/hooks/useReclamacoes";
import { formatCurrency } from "@/lib/formatters";

// Brand patterns for filtering
const BRAND_PATTERNS: Record<string, string[]> = {
  caminito: ["CAMINITO", "CP"],
  nazo: ["NAZO", "NZ"],
  caju: ["CAJU", "CJ"],
  fosters: ["FOSTERS", "FB"],
};

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
  const currentMonth = format(new Date(), "yyyy-MM");

  const { options: lojas, isLoading: isLoadingLojas } = useConfigLojas();
  const { aggregatedByStore, isLoading: isLoadingPerformance } = usePerformanceEntries();
  
  // STRICT SEPARATION: Supervision data ONLY from audits (PDF data)
  const { audits, isLoadingAudits } = useSupervisionAudits(null);
  
  // STRICT SEPARATION: Reclamações data for complaints ranking
  const { agregadoPorLoja, isLoading: isLoadingReclamacoes } = useReclamacoes(undefined, currentMonth);

  const isLoading = isLoadingLojas || isLoadingPerformance || isLoadingAudits || isLoadingReclamacoes;

  // Filter stores by brand
  const filteredLojas = useMemo(() => {
    if (brandFilter === "all") return lojas;
    const patterns = BRAND_PATTERNS[brandFilter] || [];
    return lojas.filter((loja) =>
      patterns.some((pattern) => loja.nome.toUpperCase().includes(pattern))
    );
  }, [lojas, brandFilter]);

  // ============================================
  // RANKING 1: NPS by Unit
  // Based ONLY on NPS values - no cargo filtering
  // ============================================
  const npsRanking = useMemo(() => {
    return filteredLojas
      .map((loja) => {
        const data = aggregatedByStore[loja.id];
        if (!data || data.total_faturamento === 0) return null;

        // NPS efficiency = Faturamento / Reclamações
        const faturamento = data.total_faturamento || 0;
        const reclamacoes = data.total_reclamacoes || 1;
        const npsEfficiency = faturamento / reclamacoes;

        return {
          id: loja.id,
          nome: loja.nome,
          npsEfficiency,
          faturamento,
          reclamacoes,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.npsEfficiency || 0) - (a?.npsEfficiency || 0));
  }, [filteredLojas, aggregatedByStore]);

  // ============================================
  // RANKING 2: Supervisão by Unit
  // Based ONLY on audit/PDF data - NEVER Sheets or complaints
  // ============================================
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
          score: auditData.score,
          auditDate: auditData.date,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.score || 0) - (a?.score || 0));
  }, [filteredLojas, audits]);

  // ============================================
  // RANKING 3: Reclamações x Faturamento
  // Formula: índice = faturamento_total / total_reclamacoes_graves
  // Higher is better (more revenue per grave complaint)
  // ============================================
  const reclamacoesRanking = useMemo(() => {
    return filteredLojas
      .map((loja) => {
        const data = aggregatedByStore[loja.id];
        const recData = agregadoPorLoja[loja.id];
        
        if (!data || data.total_faturamento === 0) return null;

        const faturamento = data.total_faturamento;
        // Use graves from reclamacoes table if available, fallback to total_reclamacoes
        const reclamacoesGraves = recData?.graves || Math.ceil(data.total_reclamacoes * 0.5) || 1;
        
        // índice = faturamento / reclamações graves
        const indice = faturamento / reclamacoesGraves;

        return {
          id: loja.id,
          nome: loja.nome,
          faturamento,
          reclamacoesGraves,
          indice,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.indice || 0) - (a?.indice || 0)); // Higher is better
  }, [filteredLojas, aggregatedByStore, agregadoPorLoja]);

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
            NPS
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

        {/* RANKING 1: NPS */}
        <TabsContent value="nps">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Ranking NPS por Unidade
              </CardTitle>
              <CardDescription>
                Baseado APENAS em NPS (Faturamento ÷ Reclamações). Sem filtro de cargo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {npsRanking.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum dado de NPS encontrado para o período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Reclamações</TableHead>
                      <TableHead className="text-right">Eficiência NPS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {npsRanking.map((item, index) => (
                      <TableRow key={item!.id} className={index < 3 ? "bg-muted/30" : ""}>
                        <TableCell>{getPositionIcon(index + 1)}</TableCell>
                        <TableCell className="font-medium">{item!.nome}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item!.faturamento)}</TableCell>
                        <TableCell className="text-right">{item!.reclamacoes}</TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(item!.npsEfficiency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RANKING 2: Supervisão (ONLY from audits) */}
        <TabsContent value="supervisao">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Ranking Supervisão por Unidade
              </CardTitle>
              <CardDescription>
                Baseado APENAS em dados de auditoria/PDF. Não usa planilhas ou reclamações.
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
                      <TableRow key={item!.id} className={index < 3 ? "bg-muted/30" : ""}>
                        <TableCell>{getPositionIcon(index + 1)}</TableCell>
                        <TableCell className="font-medium">{item!.nome}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(item!.auditDate), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={item!.score} className="w-16 h-2" />
                            <span className="font-bold">{item!.score.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {getTierBadge(item!.score)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RANKING 3: Reclamações x Faturamento */}
        <TabsContent value="reclamacoes">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Ranking Reclamações x Faturamento
              </CardTitle>
              <CardDescription>
                Índice = Faturamento ÷ Reclamações Graves (nota ≤ 3). Maior é melhor.
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
                      <TableHead className="text-right">Rec. Graves</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Índice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reclamacoesRanking.map((item, index) => (
                      <TableRow key={item!.id} className={index < 3 ? "bg-muted/30" : ""}>
                        <TableCell>{getPositionIcon(index + 1)}</TableCell>
                        <TableCell className="font-medium">{item!.nome}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive" className="text-xs">
                            {item!.reclamacoesGraves}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item!.faturamento)}</TableCell>
                        <TableCell className="text-right font-bold">
                          <span className={item!.indice > 100000 ? "text-emerald-600" : item!.indice > 50000 ? "text-amber-600" : "text-red-600"}>
                            {formatCurrency(item!.indice)}
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
