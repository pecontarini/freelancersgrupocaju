import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Flame, TrendingDown } from "lucide-react";
import type { Reclamacao } from "@/hooks/useReclamacoes";

interface DoresOperacaoParetoProps {
  reclamacoes: Reclamacao[];
  lojaId?: string | null;
}

// Extract pain tags from AI-generated themes
function extractTags(reclamacao: Reclamacao): string[] {
  const tags: string[] = [];
  
  // Get themes from AI analysis
  if (reclamacao.temas && reclamacao.temas.length > 0) {
    tags.push(...reclamacao.temas);
  }
  
  // Get keywords as fallback
  if (reclamacao.palavras_chave && reclamacao.palavras_chave.length > 0) {
    tags.push(...reclamacao.palavras_chave);
  }
  
  // Default classification if no tags
  if (tags.length === 0) {
    if (reclamacao.tipo_operacao === 'delivery') {
      tags.push('#Delivery');
    } else {
      tags.push('#Salão');
    }
  }
  
  return tags.map(t => t.startsWith('#') ? t : `#${t}`);
}

export function DoresOperacaoPareto({ reclamacoes, lojaId }: DoresOperacaoParetoProps) {
  // Aggregate pain points by tag
  const paretoData = useMemo(() => {
    const tagCounts: Record<string, { count: number; graves: number }> = {};
    
    for (const rec of reclamacoes) {
      const tags = extractTags(rec);
      for (const tag of tags) {
        if (!tagCounts[tag]) {
          tagCounts[tag] = { count: 0, graves: 0 };
        }
        tagCounts[tag].count += 1;
        if (rec.is_grave) {
          tagCounts[tag].graves += 1;
        }
      }
    }
    
    // Sort by count descending and take top 10
    return Object.entries(tagCounts)
      .map(([tag, data]) => ({
        tag,
        count: data.count,
        graves: data.graves,
        isCritical: data.count >= 3 // Critical if 3+ occurrences
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reclamacoes]);
  
  // Critical pains (3+ occurrences)
  const criticalPains = useMemo(() => {
    return paretoData.filter(d => d.isCritical);
  }, [paretoData]);
  
  // Total complaints
  const totalComplaints = reclamacoes.length;
  const totalGraves = reclamacoes.filter(r => r.is_grave).length;
  
  if (reclamacoes.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-8 text-center text-muted-foreground">
          <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhuma reclamação registrada para análise.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base uppercase">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Ranking de Pareto - Dores da Operação
            </CardTitle>
            <CardDescription>
              Identificação das principais causas de reclamações
            </CardDescription>
          </div>
          {criticalPains.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <Flame className="h-3 w-3" />
              {criticalPains.length} Dores Críticas
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-2xl font-bold">{totalComplaints}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="rounded-lg bg-destructive/10 p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{totalGraves}</p>
            <p className="text-xs text-muted-foreground">Graves</p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{paretoData.length}</p>
            <p className="text-xs text-muted-foreground">Categorias</p>
          </div>
        </div>
        
        {/* Pareto Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paretoData} layout="vertical" margin={{ left: 80, right: 20 }}>
              <XAxis type="number" />
              <YAxis 
                type="category" 
                dataKey="tag" 
                width={75}
                tick={{ fontSize: 11 }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg p-2 shadow-lg">
                        <p className="font-bold">{data.tag}</p>
                        <p className="text-sm">Total: {data.count}</p>
                        <p className="text-sm text-destructive">Graves: {data.graves}</p>
                        {data.isCritical && (
                          <Badge variant="destructive" className="mt-1 text-xs">
                            DOR CRÍTICA
                          </Badge>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {paretoData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isCritical 
                      ? "hsl(var(--destructive))" 
                      : "hsl(var(--primary))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Critical Pains List */}
        {criticalPains.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold uppercase text-destructive flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Dores Críticas (3+ ocorrências)
            </h4>
            <div className="flex flex-wrap gap-2">
              {criticalPains.map(pain => (
                <Badge 
                  key={pain.tag} 
                  variant="destructive" 
                  className="text-sm py-1.5 px-3"
                >
                  {pain.tag} ({pain.count}x)
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
