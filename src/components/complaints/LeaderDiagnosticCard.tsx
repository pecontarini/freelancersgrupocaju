import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Lightbulb, 
  AlertCircle, 
  TrendingDown, 
  Target,
  CheckCircle2,
  Clock,
  Users,
  Utensils,
  Truck
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { Reclamacao } from "@/hooks/useReclamacoes";

interface LeaderDiagnosticCardProps {
  reclamacoes: Reclamacao[];
  lojaId?: string | null;
  lojaNome?: string;
}

// AI-driven action recommendations based on pain point
const PAIN_ACTIONS: Record<string, { icon: React.ElementType; actions: string[] }> = {
  "#Demora": {
    icon: Clock,
    actions: [
      "Revisar tempo médio de produção no KDS",
      "Verificar escala de horários de pico",
      "Analisar gargalos na cozinha",
      "Treinar equipe em técnicas de agilidade"
    ]
  },
  "#AtendimentoLento": {
    icon: Clock,
    actions: [
      "Aumentar staff no horário de pico",
      "Implementar sistema de chamadas",
      "Redistribuir estações de atendimento",
      "Criar protocolo de atendimento rápido"
    ]
  },
  "#ComidaFria": {
    icon: Utensils,
    actions: [
      "Verificar lâmpadas de aquecimento",
      "Revisar tempo de expedição",
      "Treinar equipe de pass sobre timing",
      "Implementar controle de temperatura"
    ]
  },
  "#ErroDePedido": {
    icon: AlertCircle,
    actions: [
      "Revisar processo de conferência",
      "Implementar dupla checagem",
      "Treinar equipe sobre cardápio",
      "Melhorar comunicação cozinha-salão"
    ]
  },
  "#Delivery": {
    icon: Truck,
    actions: [
      "Verificar rotas de entrega",
      "Revisar embalagens térmicas",
      "Treinar motoboys sobre cuidados",
      "Implementar rastreamento em tempo real"
    ]
  },
  "#Atendimento": {
    icon: Users,
    actions: [
      "Realizar treinamento de hospitalidade",
      "Revisar scripts de atendimento",
      "Implementar cliente oculto",
      "Criar sistema de feedback imediato"
    ]
  },
  "default": {
    icon: Target,
    actions: [
      "Analisar causa raiz detalhadamente",
      "Reunir equipe para brainstorming",
      "Definir plano de ação com prazos",
      "Monitorar indicadores semanalmente"
    ]
  }
};

// Calculate bonus impact based on complaints
function calculateBonusImpact(gravesCount: number): number {
  // Each grave complaint above threshold reduces potential bonus
  const bonusPerComplaint = 250; // R$ 250 per grave complaint impact
  return gravesCount * bonusPerComplaint;
}

export function LeaderDiagnosticCard({ reclamacoes, lojaId, lojaNome }: LeaderDiagnosticCardProps) {
  // Find the main pain point
  const mainPain = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    
    for (const rec of reclamacoes) {
      const tags = rec.temas?.length > 0 ? rec.temas : rec.palavras_chave || [];
      for (const tag of tags) {
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
        tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
      }
    }
    
    // Find most frequent
    let maxTag = "";
    let maxCount = 0;
    for (const [tag, count] of Object.entries(tagCounts)) {
      if (count > maxCount) {
        maxTag = tag;
        maxCount = count;
      }
    }
    
    return { tag: maxTag, count: maxCount };
  }, [reclamacoes]);
  
  // Get action recommendations
  const recommendations = useMemo(() => {
    const painConfig = PAIN_ACTIONS[mainPain.tag] || PAIN_ACTIONS["default"];
    return {
      icon: painConfig.icon,
      actions: painConfig.actions
    };
  }, [mainPain.tag]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const graves = reclamacoes.filter(r => r.is_grave).length;
    const salao = reclamacoes.filter(r => r.tipo_operacao === 'salao').length;
    const delivery = reclamacoes.filter(r => r.tipo_operacao === 'delivery').length;
    const bonusImpact = calculateBonusImpact(graves);
    
    return { graves, salao, delivery, bonusImpact };
  }, [reclamacoes]);
  
  if (reclamacoes.length === 0) {
    return (
      <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
        <CardContent className="py-6 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
          <p className="font-medium text-emerald-700 dark:text-emerald-400">
            Excelente! Nenhuma dor crítica identificada este mês.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Continue mantendo a qualidade operacional.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const IconComponent = recommendations.icon;
  
  return (
    <Card className="rounded-2xl border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base uppercase">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Diagnóstico da Sua Unidade
            </CardTitle>
            <CardDescription className="mt-1">
              {lojaNome ? `Análise para ${lojaNome}` : "Análise da operação do mês"}
            </CardDescription>
          </div>
          {stats.graves > 0 && (
            <Badge variant="destructive">
              {stats.graves} Graves
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Pain Alert */}
        {mainPain.tag && mainPain.count >= 2 && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-destructive/20 p-2">
                <IconComponent className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-destructive">
                  Sua principal dor este mês é{" "}
                  <span className="font-bold">{mainPain.tag}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Isso está impactando seu bônus em até{" "}
                  <span className="font-bold text-destructive">
                    {formatCurrency(stats.bonusImpact)}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Impact Split */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-background/80 p-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Utensils className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium">Salão</span>
            </div>
            <p className="text-xl font-bold">{stats.salao}</p>
          </div>
          <div className="rounded-lg bg-background/80 p-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Truck className="h-4 w-4 text-sky-600" />
              <span className="text-sm font-medium">Delivery</span>
            </div>
            <p className="text-xl font-bold">{stats.delivery}</p>
          </div>
        </div>
        
        {/* Action Checklist */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold uppercase flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Plano de Resolução
          </h4>
          <div className="space-y-2">
            {recommendations.actions.map((action, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-3 rounded-lg bg-background/60 p-3 hover:bg-background/80 transition-colors"
              >
                <Checkbox id={`action-${idx}`} className="mt-0.5" />
                <label 
                  htmlFor={`action-${idx}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {action}
                </label>
              </div>
            ))}
          </div>
        </div>
        
        {/* Trend Warning */}
        {mainPain.count >= 3 && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-destructive font-medium">
              Tendência crítica: {mainPain.tag} apareceu {mainPain.count}x este mês
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
