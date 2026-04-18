import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AppGlassBackground } from "@/components/layout/AppGlassBackground";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";

import { AgendaMonthView } from "@/components/agenda/AgendaMonthView";
import { AgendaWeekView } from "@/components/agenda/AgendaWeekView";
import { AgendaListView } from "@/components/agenda/AgendaListView";
import { AgendaEventModal, type AgendaEventoForm } from "@/components/agenda/AgendaEventModal";
import { combineDateTime, splitDateTime } from "@/components/agenda/agendaUtils";
import { useAgendaEventos, type AgendaEvento } from "@/hooks/useAgendaEventos";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getTokenFromSupabase,
  initGoogleAuth,
  requestGoogleToken,
  saveTokenToSupabase,
  updateCalendarEvent,
} from "@/services/googleCalendar";

type ViewMode = "mensal" | "semanal" | "lista";

export default function Agenda() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isOperator } = useUserProfile();
  const { selectedUnidadeId, setSelectedUnidadeId } = useUnidade();
  const canSeeAll = isAdmin || isOperator;

  const [view, setView] = useState<ViewMode>("mensal");
  const [hasGoogleToken, setHasGoogleToken] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvento | null>(null);
  const [initialModal, setInitialModal] = useState<Partial<AgendaEventoForm> | undefined>();
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [profilesById, setProfilesById] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: eventos = [], create, update, remove, toggleConcluido } = useAgendaEventos({
    allUsers: canSeeAll,
  });

  useEffect(() => {
    initGoogleAuth().catch(() => {});
    getTokenFromSupabase()
      .then((t) => setHasGoogleToken(!!t?.access_token))
      .catch(() => setHasGoogleToken(false));
  }, []);

  // Carregar nomes dos donos quando admin
  useEffect(() => {
    if (!canSeeAll || eventos.length === 0) return;
    const ids = Array.from(new Set(eventos.map((e) => e.user_id)));
    if (ids.length === 0) return;
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach((p: any) => {
          map[p.user_id] = p.full_name ?? "Usuário";
        });
        setProfilesById(map);
      });
  }, [canSeeAll, eventos]);

  const filteredEventos = useMemo(() => {
    if (!canSeeAll || filterUserId === "all") return eventos;
    return eventos.filter((e) => e.user_id === filterUserId);
  }, [eventos, canSeeAll, filterUserId]);

  const completionByUser = useMemo(() => {
    if (!canSeeAll) return [];
    const stats = new Map<string, { total: number; done: number }>();
    eventos.forEach((e) => {
      const cur = stats.get(e.user_id) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (e.concluido) cur.done += 1;
      stats.set(e.user_id, cur);
    });
    return Array.from(stats.entries()).map(([userId, s]) => ({
      userId,
      name: profilesById[userId] ?? "Usuário",
      total: s.total,
      done: s.done,
      pct: s.total ? Math.round((s.done / s.total) * 100) : 0,
    }));
  }, [eventos, canSeeAll, profilesById]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const token = await requestGoogleToken();
      await saveTokenToSupabase(token);
      setHasGoogleToken(true);
      toast.success("Google Calendar conectado!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Falha ao conectar Google.");
    } finally {
      setConnecting(false);
    }
  };

  const openCreate = (preDate?: Date) => {
    setEditing(null);
    if (preDate) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${preDate.getFullYear()}-${pad(preDate.getMonth() + 1)}-${pad(preDate.getDate())}`;
      setInitialModal({ data_inicio_date: dateStr, data_fim_date: dateStr });
    } else {
      setInitialModal(undefined);
    }
    setModalOpen(true);
  };

  const openEdit = (e: AgendaEvento) => {
    setEditing(e);
    const ini = splitDateTime(e.data_inicio);
    const fim = splitDateTime(e.data_fim ?? e.data_inicio);
    setInitialModal({
      id: e.id,
      titulo: e.titulo,
      descricao: e.descricao ?? "",
      data_inicio_date: ini.date,
      data_inicio_time: ini.time,
      data_fim_date: fim.date,
      data_fim_time: fim.time,
      categoria: e.categoria,
      concluido: e.concluido,
      google_event_id: e.google_event_id,
      syncGoogle: !!e.google_event_id,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (form: AgendaEventoForm) => {
    try {
      setSaving(true);
      const data_inicio = combineDateTime(form.data_inicio_date, form.data_inicio_time);
      const data_fim =
        form.data_fim_date && form.data_fim_time
          ? combineDateTime(form.data_fim_date, form.data_fim_time)
          : null;

      let googleEventId: string | null = form.google_event_id ?? null;
      const tokenRow = form.syncGoogle ? await getTokenFromSupabase() : null;

      if (editing) {
        if (form.syncGoogle && tokenRow?.access_token) {
          try {
            if (googleEventId) {
              await updateCalendarEvent(tokenRow.access_token, googleEventId, {
                titulo: form.titulo,
                descricao: form.descricao,
                data_inicio,
                data_fim,
                categoria: form.categoria,
              });
            } else {
              const created = await createCalendarEvent(tokenRow.access_token, {
                titulo: form.titulo,
                descricao: form.descricao,
                data_inicio,
                data_fim,
                categoria: form.categoria,
              });
              googleEventId = created?.id ?? null;
            }
          } catch (err: any) {
            toast.warning(`Salvo localmente, mas falhou no Google: ${err?.message ?? "erro"}`);
          }
        }
        await update.mutateAsync({
          id: editing.id,
          titulo: form.titulo,
          descricao: form.descricao || null,
          data_inicio,
          data_fim,
          categoria: form.categoria,
          concluido: form.concluido,
          google_event_id: googleEventId,
        });
        toast.success("Evento atualizado.");
      } else {
        if (form.syncGoogle && tokenRow?.access_token) {
          try {
            const created = await createCalendarEvent(tokenRow.access_token, {
              titulo: form.titulo,
              descricao: form.descricao,
              data_inicio,
              data_fim,
              categoria: form.categoria,
            });
            googleEventId = created?.id ?? null;
          } catch (err: any) {
            toast.warning(`Salvo localmente, mas falhou no Google: ${err?.message ?? "erro"}`);
          }
        }
        await create.mutateAsync({
          titulo: form.titulo,
          descricao: form.descricao || null,
          data_inicio,
          data_fim,
          categoria: form.categoria,
          concluido: false,
          google_event_id: googleEventId,
        });
        toast.success("Evento criado.");
      }
      setModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      if (editing.google_event_id) {
        const tokenRow = await getTokenFromSupabase();
        if (tokenRow?.access_token) {
          try {
            await deleteCalendarEvent(tokenRow.access_token, editing.google_event_id);
          } catch (err) {
            console.warn("Falha ao excluir no Google:", err);
          }
        }
      }
      await remove.mutateAsync(editing.id);
      toast.success("Evento excluído.");
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao excluir.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleConcluido = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      await toggleConcluido.mutateAsync({ id: editing.id, concluido: !editing.concluido });
      toast.success(editing.concluido ? "Evento reaberto." : "Evento concluído.");
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidebarProvider>
      <AppGlassBackground />
      <div className="flex min-h-screen w-full">
        <AppSidebar activeTab="agenda" onTabChange={(tab) => navigate(`/?tab=${tab}`)} />
        <SidebarInset>
          <PortalHeader
            title="Agenda Operacional"
            subtitle="Calendário integrado ao Google Calendar"
            selectedUnidadeId={selectedUnidadeId}
            onUnidadeChange={setSelectedUnidadeId}
          />

          <main className="container mx-auto max-w-7xl p-4 md:p-6">
            {hasGoogleToken === null ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !hasGoogleToken ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex min-h-[60vh] items-center justify-center"
              >
                <Card className="max-w-md p-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Calendar className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="font-display text-xl font-semibold">Conecte seu Google Calendar</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Sincronize seus eventos operacionais e pessoais em um único lugar. Você poderá criar,
                    editar e acompanhar tudo direto pelo portal.
                  </p>
                  <Button className="mt-6 w-full" onClick={handleConnect} disabled={connecting}>
                    {connecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon className="mr-2 h-4 w-4" />
                    )}
                    Conectar Google Calendar
                  </Button>
                </Card>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
                    <TabsList>
                      <TabsTrigger value="mensal">Mensal</TabsTrigger>
                      <TabsTrigger value="semanal">Semanal</TabsTrigger>
                      <TabsTrigger value="lista">Lista</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="flex items-center gap-2">
                    {canSeeAll && (
                      <Select value={filterUserId} onValueChange={setFilterUserId}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filtrar por pessoa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as pessoas</SelectItem>
                          {Object.entries(profilesById).map(([id, name]) => (
                            <SelectItem key={id} value={id}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button onClick={() => openCreate()}>
                      <Plus className="mr-1 h-4 w-4" /> Novo Evento
                    </Button>
                  </div>
                </div>

                {canSeeAll && view === "lista" && completionByUser.length > 0 && (
                  <Card className="p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
                      Conclusão por usuário
                    </h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {completionByUser.map((u) => (
                        <div key={u.userId} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-sm font-medium">{u.name}</span>
                            <span className="text-sm font-bold text-primary">{u.pct}%</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {u.done} de {u.total} concluídos
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {view === "mensal" && (
                  <AgendaMonthView
                    eventos={filteredEventos}
                    onSelectEvent={openEdit}
                    onCreateForDate={openCreate}
                  />
                )}
                {view === "semanal" && (
                  <AgendaWeekView eventos={filteredEventos} onSelectEvent={openEdit} />
                )}
                {view === "lista" && (
                  <AgendaListView
                    eventos={filteredEventos}
                    onSelectEvent={openEdit}
                    showOwner={canSeeAll}
                    ownerNameById={profilesById}
                  />
                )}
              </motion.div>
            )}
          </main>

          <AgendaEventModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            initial={initialModal}
            onSubmit={handleSubmit}
            onDelete={editing ? handleDelete : undefined}
            onToggleConcluido={editing ? handleToggleConcluido : undefined}
            saving={saving}
            isEdit={!!editing}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
