import { useMemo, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useActionPlans } from "@/hooks/useActionPlans";
import { ActionPlanResolutionForm } from "./ActionPlanResolutionForm";
import type { Reclamacao } from "@/hooks/useReclamacoes";

interface LeaderDiagnosticCardProps {
  reclamacoes: Reclamacao[];
  lojaId?: string | null;
  lojaNome?: string;
}

// AI-driven action recommendations based on pain point
const PAIN_ICONS: Record<string, React.ElementType> = {
  "#Demora": Clock,
  "#AtendimentoLento": Clock,
  "#ComidaFria": Utensils,
  "#ErroDePedido": AlertCircle,
  "#Delivery": Truck,
  "#Atendimento": Users,
  "default": Target,
};

// Calculate bonus impact based on complaints
function calculateBonusImpact(gravesCount: number): number {
  // Each grave complaint above threshold reduces potential bonus
  const bonusPerComplaint = 250; // R$ 250 per grave complaint impact
  return gravesCount * bonusPerComplaint;
}

export function LeaderDiagnosticCard({ reclamacoes, lojaId, lojaNome }: LeaderDiagnosticCardProps) {
  const currentMonth = format(new Date(), "yyyy-MM");
  const { actionPlans, createActionPlan, updateActionPlan } = useActionPlans(lojaId, currentMonth);
  
  // Find all pain points with counts
  const painPoints = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    
    for (const rec of reclamacoes) {
      const tags = rec.temas?.length > 0 ? rec.temas : rec.palavras_chave || [];
      for (const tag of tags) {
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
        tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
      }
    }
    
    // Convert to sorted array
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .filter(p => p.count >= 2) // Only show if appears 2+ times
      .sort((a, b) => b.count - a.count);
  }, [reclamacoes]);

  // Main pain point
  const mainPain = painPoints[0] || { tag: "", count: 0 };
  
  // Auto-create action plans for critical pains
  useEffect(() => {
    if (!lojaId) return;
    
    painPoints.forEach(pain => {
      // Check if action plan already exists
      const exists = actionPlans.some(
        ap => ap.pain_tag === pain.tag && ap.loja_id === lojaId
      );
      
      if (!exists && pain.count >= 2) {
        createActionPlan.mutate({
          loja_id: lojaId,
          pain_tag: pain.tag,
          referencia_mes: currentMonth,
        });
      }
    });
  }, [painPoints, lojaId, actionPlans, createActionPlan, currentMonth]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const graves = reclamacoes.filter(r => r.is_grave).length;
    const salao = reclamacoes.filter(r => r.tipo_operacao === 'salao').length;
    const delivery = reclamacoes.filter(r => r.tipo_operacao === 'delivery').length;
    const bonusImpact = calculateBonusImpact(graves);
    
    // Count resolved action plans
    const resolved = actionPlans.filter(ap => ap.status === 'resolved').length;
    const pending = actionPlans.filter(ap => ap.status === 'pending').length;
    
    return { graves, salao, delivery, bonusImpact, resolved, pending };
  }, [reclamacoes, actionPlans]);
  
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
  
  const IconComponent = PAIN_ICONS[mainPain.tag] || PAIN_ICONS["default"];
  
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
          <div className="flex gap-2">
            {stats.pending > 0 && (
              <Badge variant="destructive">
                {stats.pending} Pendente{stats.pending > 1 ? "s" : ""}
              </Badge>
            )}
            {stats.resolved > 0 && (
              <Badge className="bg-emerald-500">
                {stats.resolved} Resolvido{stats.resolved > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
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
        
        {/* Action Plans - Structured Resolution Forms */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Planos de Resolução
          </h4>
          
          {actionPlans.length > 0 ? (
            <div className="space-y-2">
              {actionPlans.map((plan) => (
                <ActionPlanResolutionForm
                  key={plan.id}
                  actionPlan={plan}
                  onUpdate={async (input) => {
                    await updateActionPlan.mutateAsync(input);
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum plano de ação pendente.
            </p>
          )}
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
