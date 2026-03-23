import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2 } from "lucide-react";
import { FreelancerCheckin } from "@/hooks/useFreelancerCheckins";
import { useCheckinApprovals } from "@/hooks/useCheckinApprovals";
import { toast } from "sonner";

interface Props {
  lojaId: string;
  date: string;
  checkins: FreelancerCheckin[];
  userId: string;
}

export function CheckinBatchApproval({ lojaId, date, checkins, userId }: Props) {
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { batchApprove } = useCheckinApprovals();

  const handleBatchApprove = async () => {
    if (pin.length < 4) {
      toast.error("PIN deve ter pelo menos 4 dígitos.");
      return;
    }
    if (checkins.length === 0) {
      toast.error("Nenhum registro pendente para assinar.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Simple hash for PIN (in production, use bcrypt on backend)
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const pinHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      await batchApprove.mutateAsync({
        lojaId,
        approvalDate: date,
        approvedBy: userId,
        pinHash,
        checkinIds: checkins.map((c) => c.id),
      });

      toast.success(`${checkins.length} registro(s) assinados com sucesso!`);
      setPin("");
    } catch (err: any) {
      toast.error("Erro ao assinar: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkins.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Assinatura em Lote
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Assine {checkins.length} registro(s) concluído(s) com seu PIN para confirmar a presença.
        </p>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5 flex-1">
            <Label>PIN de Assinatura</Label>
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              inputMode="numeric"
              maxLength={8}
            />
          </div>
          <Button onClick={handleBatchApprove} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Assinar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
