import { useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  AlertTriangle, 
  Flame, 
  Clock,
  MessageSquare,
  TrendingDown,
  Utensils,
  Truck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Reclamacao } from "@/hooks/useReclamacoes";

interface MobileAlertsFeedProps {
  reclamacoes: Reclamacao[];
  lojaId?: string | null;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM", { locale: ptBR });
}

export function MobileAlertsFeed({ reclamacoes, lojaId }: MobileAlertsFeedProps) {
  // Sort by date (most recent first) and take last 10
  const recentAlerts = useMemo(() => {
    return [...reclamacoes]
      .sort((a, b) => new Date(b.data_reclamacao).getTime() - new Date(a.data_reclamacao).getTime())
      .slice(0, 10);
  }, [reclamacoes]);
  
  // Critical pain points (3+ occurrences)
  const criticalPains = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    
    for (const rec of reclamacoes) {
      const tags = rec.temas?.length > 0 ? rec.temas : rec.palavras_chave || [];
      for (const tag of tags) {
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
        tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
      }
    }
    
    return Object.entries(tagCounts)
      .filter(([_, count]) => count >= 3)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [reclamacoes]);
  
  if (reclamacoes.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-6 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum alerta no momento.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base uppercase">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Alertas do Turno
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Critical Tags Banner */}
        {criticalPains.length > 0 && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold text-destructive uppercase">
                Dores Críticas
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {criticalPains.map(pain => (
                <Badge 
                  key={pain.tag} 
                  variant="destructive" 
                  className="text-xs"
                >
                  {pain.tag} ({pain.count}x)
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Recent Alerts List */}
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {recentAlerts.map((rec, idx) => (
              <div 
                key={rec.id}
                className={`
                  rounded-lg p-3 flex items-start gap-3
                  ${rec.is_grave 
                    ? 'bg-destructive/5 border border-destructive/20' 
                    : 'bg-muted/50'
                  }
                `}
              >
                <div className={`
                  rounded-full p-1.5
                  ${rec.is_grave ? 'bg-destructive/20' : 'bg-muted'}
                `}>
                  {rec.tipo_operacao === 'delivery' 
                    ? <Truck className={`h-4 w-4 ${rec.is_grave ? 'text-destructive' : 'text-muted-foreground'}`} />
                    : <Utensils className={`h-4 w-4 ${rec.is_grave ? 'text-destructive' : 'text-muted-foreground'}`} />
                  }
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(rec.data_reclamacao)}
                    </span>
                    {rec.is_grave && (
                      <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                        GRAVE
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 capitalize">
                      {rec.fonte}
                    </Badge>
                  </div>
                  
                  {/* Summary or themes */}
                  {rec.resumo_ia ? (
                    <p className="text-sm line-clamp-2">{rec.resumo_ia}</p>
                  ) : rec.temas && rec.temas.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {rec.temas.slice(0, 3).map((tema, tIdx) => (
                        <span key={tIdx} className="text-xs text-primary">
                          {tema.startsWith('#') ? tema : `#${tema}`}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nota: {rec.nota_reclamacao}/5
                    </p>
                  )}
                </div>
                
                {/* Rating */}
                <div className={`
                  font-bold text-lg
                  ${rec.nota_reclamacao <= 2 ? 'text-destructive' : 
                    rec.nota_reclamacao <= 3 ? 'text-amber-500' : 
                    'text-muted-foreground'}
                `}>
                  {rec.nota_reclamacao}★
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
