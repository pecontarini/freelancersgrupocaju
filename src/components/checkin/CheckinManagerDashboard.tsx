import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFreelancerCheckins, FreelancerCheckin } from "@/hooks/useFreelancerCheckins";
import { useScheduledFreelancers } from "@/hooks/useScheduledFreelancers";
import { useAuth } from "@/contexts/AuthContext";
import { CheckinApprovalCard } from "./CheckinApprovalCard";
import { CheckinBatchApproval } from "./CheckinBatchApproval";
import { CheckinPaymentOrder } from "./CheckinPaymentOrder";
import { QRCodeGenerator } from "./QRCodeGenerator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, QrCode, FileText, Clock, User, Briefcase, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  selectedUnidadeId: string | null;
}

function normalizeName(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export function CheckinManagerDashboard({ selectedUnidadeId }: Props) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { checkins, isLoading, approvePresence, rejectPresence, approveValue } = useFreelancerCheckins(
    selectedUnidadeId || undefined,
    selectedDate
  );

  const { data: scheduledFreelancers = [], isLoading: isLoadingScheduled } = useScheduledFreelancers(
    selectedUnidadeId || undefined,
    selectedDate
  );

  const pendingCount = checkins.filter(
    (c) => c.status === "completed" || (c.status !== "approved" && c.status !== "rejected")
  ).length;

  const pendingValueCount = checkins.filter(
    (c) => c.status === "approved" && c.valor_status !== "approved"
  ).length;

  const readyToSign = checkins.filter(
    (c) => c.status === "approved" && c.valor_status === "approved"
  );

  // Match scheduled freelancers with checkins by name
  const scheduledWithStatus = scheduledFreelancers.map((sf) => {
    const normalizedScheduleName = normalizeName(sf.employeeName);
    const matchedCheckin = checkins.find((c) => {
      const checkinName = c.freelancer_profiles?.nome_completo;
      return checkinName && normalizeName(checkinName) === normalizedScheduleName;
    });
    return { ...sf, checkedIn: !!matchedCheckin, checkinStatus: matchedCheckin?.status };
  });

  const formatTime = (time: string | null) => {
    if (!time) return "--:--";
    return time.substring(0, 5);
  };

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

          {/* Scheduled Freelancers Section */}
          {scheduledWithStatus.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" />
                Agendados na Escala ({scheduledWithStatus.length})
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {scheduledWithStatus.map((sf) => (
                  <Card key={sf.scheduleId} className="border-l-4" style={{
                    borderLeftColor: sf.checkedIn
                      ? "hsl(var(--primary))"
                      : "hsl(var(--destructive) / 0.5)"
                  }}>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {sf.employeeName}
                        </span>
                        {sf.checkedIn ? (
                          <Badge variant="default" className="text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Check-in realizado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1 border-amber-400 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3 w-3" />
                            Aguardando
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {sf.jobTitle && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {sf.jobTitle}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(sf.startTime)} – {formatTime(sf.endTime)}
                        </span>
                        {sf.agreedRate != null && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            R$ {sf.agreedRate.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : checkins.length === 0 && scheduledWithStatus.length === 0 ? (
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

              {readyToSign.length > 0 && (
                <CheckinBatchApproval
                  lojaId={selectedUnidadeId || ""}
                  date={selectedDate}
                  checkins={readyToSign}
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
