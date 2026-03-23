import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFreelancerCheckins, FreelancerCheckin } from "@/hooks/useFreelancerCheckins";
import { useAuth } from "@/contexts/AuthContext";
import { CheckinApprovalCard } from "./CheckinApprovalCard";
import { CheckinBatchApproval } from "./CheckinBatchApproval";
import { CheckinPaymentOrder } from "./CheckinPaymentOrder";
import { QRCodeGenerator } from "./QRCodeGenerator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, QrCode, FileText } from "lucide-react";

interface Props {
  selectedUnidadeId: string | null;
}

export function CheckinManagerDashboard({ selectedUnidadeId }: Props) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { checkins, isLoading, approvePresence, rejectPresence, approveValue } = useFreelancerCheckins(
    selectedUnidadeId || undefined,
    selectedDate
  );

  const pendingCount = checkins.filter(
    (c) => c.status === "completed" || (c.status !== "approved" && c.status !== "rejected")
  ).length;

  const pendingValueCount = checkins.filter(
    (c) => c.status === "approved" && c.valor_status !== "approved"
  ).length;

  return (
    <div className="space-y-4 fade-in">
      <Tabs defaultValue="presenca" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="presenca" className="flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4" />
            <span className="hidden sm:inline">Presença</span>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 text-[10px] px-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pagamento" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamento</span>
          </TabsTrigger>
          <TabsTrigger value="qrcode" className="flex items-center gap-1.5">
            <QrCode className="h-4 w-4" />
            <span className="hidden sm:inline">QR Code</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presenca" className="space-y-4 mt-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <p className="text-sm text-muted-foreground pb-2">
              {checkins.length} registro(s)
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : checkins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro de presença nesta data.</p>
          ) : (
            <div className="space-y-3">
              {checkins.map((checkin) => (
                <CheckinApprovalCard
                  key={checkin.id}
                  checkin={checkin}
                  userId={user?.id || ""}
                  onApprovePresence={(id) => approvePresence.mutate({ checkinId: id, userId: user?.id || "" })}
                  onRejectPresence={(id, reason) => rejectPresence.mutate({ checkinId: id, userId: user?.id || "", reason })}
                  onApproveValue={(id, valor) => approveValue.mutate({ checkinId: id, userId: user?.id || "", valorAprovado: valor })}
                />
              ))}

              {pendingCount > 0 && (
                <CheckinBatchApproval
                  lojaId={selectedUnidadeId || ""}
                  date={selectedDate}
                  checkins={checkins.filter((c) => c.status === "completed")}
                  userId={user?.id || ""}
                />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pagamento" className="mt-4">
          <CheckinPaymentOrder
            lojaId={selectedUnidadeId || ""}
            date={selectedDate}
            unitName={""}
            pendingApprovalCount={pendingCount + pendingValueCount}
          />
        </TabsContent>

        <TabsContent value="qrcode" className="mt-4">
          <QRCodeGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
