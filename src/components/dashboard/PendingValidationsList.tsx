import { useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  MessageSquare,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type ActionPlan, type UpdateActionPlanInput, useActionPlanComments } from "@/hooks/useActionPlans";
import { ActionPlanTimeline } from "@/components/complaints/ActionPlanTimeline";
import type { ConfigOption } from "@/hooks/useConfigOptions";
import { useIsMobile } from "@/hooks/use-mobile";

interface PendingValidationsListProps {
  actionPlans: ActionPlan[];
  allActionPlans: ActionPlan[];
  lojas: ConfigOption[];
  onUpdate: (input: UpdateActionPlanInput) => Promise<void>;
}

export function PendingValidationsList({
  actionPlans,
  allActionPlans,
  lojas,
  onUpdate,
}: PendingValidationsListProps) {
  const isMobile = useIsMobile();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  const lojaMap = useMemo(() => {
    return new Map(lojas.map((l) => [l.id, l.nome]));
  }, [lojas]);

  const handleApprove = async (plan: ActionPlan) => {
    setIsUpdating(plan.id);
    try {
      await onUpdate({ id: plan.id, status: "resolved" });
    } finally {
      setIsUpdating(null);
    }
  };

  const handleReject = async () => {
    if (!selectedPlan) return;
    setIsUpdating(selectedPlan.id);
    try {
      await onUpdate({ id: selectedPlan.id, status: "pending" });
      setIsRejectDialogOpen(false);
      setSelectedPlan(null);
      setRejectComment("");
    } finally {
      setIsUpdating(null);
    }
  };

  const pendingCount = allActionPlans.filter((ap) => ap.status === "pending").length;

  if (actionPlans.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
          <h3 className="font-semibold text-lg">Nenhuma pendência de aprovação</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Todas as justificativas foram validadas.
          </p>
          {pendingCount > 0 && (
            <p className="text-sm text-amber-600 mt-3">
              <Clock className="h-4 w-4 inline mr-1" />
              {pendingCount} plano{pendingCount > 1 ? "s" : ""} aguardando resposta dos gerentes.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base uppercase flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Aguardando sua Validação
        </h3>
        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
          {actionPlans.length} pendente{actionPlans.length > 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="space-y-3">
        {actionPlans.map((plan) => (
          <Card key={plan.id} className="rounded-xl border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-primary">{plan.pain_tag}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {lojaMap.get(plan.loja_id) || "—"}
                      </p>
                    </div>
                    <Badge className="bg-amber-500 flex-shrink-0">Em Análise</Badge>
                  </div>

                  {/* Resolution details */}
                  {plan.causa_raiz && (
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase">Causa Raiz</p>
                        <p className="text-sm">{plan.causa_raiz}</p>
                      </div>
                      {plan.medida_tomada && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase">Medida Tomada</p>
                          <p className="text-sm">{plan.medida_tomada}</p>
                        </div>
                      )}
                      {plan.acao_preventiva && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase">Ação Preventiva</p>
                          <p className="text-sm">{plan.acao_preventiva}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Evidence */}
                  {plan.evidencia_url && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Evidência</p>
                      <a
                        href={plan.evidencia_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={plan.evidencia_url}
                          alt="Evidência"
                          className="rounded-lg max-h-32 object-cover border"
                        />
                      </a>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2">
                    <span>
                      Enviado:{" "}
                      {plan.resolved_at
                        ? formatDistanceToNow(new Date(plan.resolved_at), { locale: ptBR, addSuffix: true })
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className={`flex ${isMobile ? "flex-row w-full" : "flex-col"} gap-2`}>
                  <Button
                    size={isMobile ? "default" : "sm"}
                    className={`bg-emerald-600 hover:bg-emerald-700 ${isMobile ? "flex-1" : ""}`}
                    onClick={() => handleApprove(plan)}
                    disabled={isUpdating === plan.id}
                  >
                    {isUpdating === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Aprovar
                      </>
                    )}
                  </Button>

                  <Button
                    size={isMobile ? "default" : "sm"}
                    variant="outline"
                    className={isMobile ? "flex-1" : ""}
                    onClick={() => {
                      setSelectedPlan(plan);
                      setIsRejectDialogOpen(true);
                    }}
                    disabled={isUpdating === plan.id}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Ajuste
                  </Button>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size={isMobile ? "default" : "sm"} variant="ghost" className={isMobile ? "flex-1" : ""}>
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Timeline
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-background max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{plan.pain_tag}</DialogTitle>
                        <DialogDescription>
                          {lojaMap.get(plan.loja_id)} • Histórico de comunicação
                        </DialogDescription>
                      </DialogHeader>
                      <ActionPlanTimeline actionPlanId={plan.id} />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Solicitar Ajuste</DialogTitle>
            <DialogDescription>
              O plano será reaberto para o gerente com seu comentário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Plano: {selectedPlan?.pain_tag}</p>
              <p className="text-sm text-muted-foreground">
                {selectedPlan ? lojaMap.get(selectedPlan.loja_id) : ""}
              </p>
            </div>
            <Textarea
              placeholder="Descreva o ajuste necessário (será adicionado à timeline)..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReject} disabled={isUpdating !== null}>
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Solicitar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
