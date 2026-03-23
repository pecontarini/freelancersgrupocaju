import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, X, DollarSign, Clock, MapPin, User } from "lucide-react";
import { FreelancerCheckin } from "@/hooks/useFreelancerCheckins";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  checkin: FreelancerCheckin;
  userId: string;
  onApprovePresence: (id: string) => void;
  onRejectPresence: (id: string, reason: string) => void;
  onApproveValue: (id: string, valor: number) => void;
}

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const statusLabels: Record<string, string> = {
  open: "Em aberto",
  completed: "Concluído",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

export function CheckinApprovalCard({ checkin, userId, onApprovePresence, onRejectPresence, onApproveValue }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [valueEdit, setValueEdit] = useState(checkin.valor_informado?.toString() || "");
  const [showValueEdit, setShowValueEdit] = useState(false);

  const fp = checkin.freelancer_profiles;

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    onRejectPresence(checkin.id, rejectReason);
    setRejectOpen(false);
  };

  const handleApproveValue = () => {
    const val = parseFloat(valueEdit.replace(",", "."));
    if (val > 0) onApproveValue(checkin.id, val);
    setShowValueEdit(false);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {/* Header: status + name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-foreground">{fp?.nome_completo || "—"}</span>
              <span className="text-xs text-muted-foreground">{fp?.cpf}</span>
            </div>
            <Badge className={statusColors[checkin.status] || ""}>
              {statusLabels[checkin.status] || checkin.status}
            </Badge>
          </div>

          {/* Photos side by side */}
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">Foto Cadastro</p>
              {fp?.foto_url ? (
                <img src={fp.foto_url} alt="Cadastro" className="w-full aspect-square object-cover rounded-lg border border-border" />
              ) : (
                <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">Selfie Check-in</p>
              <img src={checkin.checkin_selfie_url} alt="Selfie" className="w-full aspect-square object-cover rounded-lg border border-border" />
            </div>
          </div>

          {/* Checkout selfie if exists */}
          {checkin.checkout_selfie_url && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Selfie Check-out</p>
              <img src={checkin.checkout_selfie_url} alt="Checkout" className="w-24 h-24 object-cover rounded-lg border border-border" />
            </div>
          )}

          {/* Times */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Entrada: {format(new Date(checkin.checkin_at), "HH:mm", { locale: ptBR })}
            </span>
            {checkin.checkout_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Saída: {format(new Date(checkin.checkout_at), "HH:mm", { locale: ptBR })}
              </span>
            )}
            {checkin.checkin_lat && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> GPS ✓
              </span>
            )}
          </div>

          {/* Value section */}
          <div className="flex items-center justify-between rounded-lg bg-muted p-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Valor informado</p>
                <p className="font-medium text-sm">R$ {checkin.valor_informado?.toFixed(2) || "—"}</p>
              </div>
            </div>
            {checkin.valor_status === "approved" ? (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Aprovado</p>
                <p className="font-medium text-sm text-green-600 dark:text-green-400">R$ {checkin.valor_aprovado?.toFixed(2)}</p>
              </div>
            ) : checkin.status === "approved" || checkin.status === "completed" ? (
              <Button size="sm" variant="outline" onClick={() => setShowValueEdit(true)}>
                Confirmar Valor
              </Button>
            ) : null}
          </div>

          {/* Value edit inline */}
          {showValueEdit && (
            <div className="flex items-center gap-2">
              <Input
                value={valueEdit}
                onChange={(e) => setValueEdit(e.target.value)}
                placeholder="Valor aprovado"
                inputMode="decimal"
                className="flex-1"
              />
              <Button size="sm" onClick={handleApproveValue}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowValueEdit(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Action buttons */}
          {(checkin.status === "completed" || checkin.status === "open") && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={() => onApprovePresence(checkin.id)}
              >
                <Check className="h-4 w-4 mr-1" /> Aprovar Presença
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => setRejectOpen(true)}
              >
                <X className="h-4 w-4 mr-1" /> Rejeitar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da Rejeição</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Informe o motivo da rejeição..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
