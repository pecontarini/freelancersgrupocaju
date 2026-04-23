import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScheduledFreelancers, ScheduledFreelancer } from "@/hooks/useScheduledFreelancers";
import { useFreelancerCheckins, FreelancerCheckin } from "@/hooks/useFreelancerCheckins";

export type EstacaoStatus = "available" | "in_service" | "done";

export interface EstacaoFreelancerItem {
  key: string;
  source: "schedule" | "manual" | "walkin";
  status: EstacaoStatus;
  scheduleId: string | null;
  entryId: string | null;
  checkinId: string | null;
  freelancerId: string | null;
  name: string;
  cpf: string | null;
  jobTitle: string | null;
  startTime: string | null;
  endTime: string | null;
  agreedRate: number | null;
  fotoUrl: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

const cleanCpf = (cpf?: string | null) =>
  (cpf || "").replace(/\D/g, "");

const normName = (s?: string | null) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function useEstacaoStatus(unitId?: string, date?: string) {
  const queryClient = useQueryClient();
  const { data: scheduled = [], isLoading: loadingSched } = useScheduledFreelancers(unitId, date);
  const { checkins, isLoading: loadingChk } = useFreelancerCheckins(unitId, date);

  // Realtime: refresh when the underlying tables change for today's loja
  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel(`estacao-${unitId}-${date}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "freelancer_checkins", filter: `loja_id=eq.${unitId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["freelancer-checkins", unitId, date] });
          queryClient.invalidateQueries({ queryKey: ["scheduled-freelancers", unitId, date] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "freelancer_entries", filter: `loja_id=eq.${unitId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["scheduled-freelancers", unitId, date] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedules" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["scheduled-freelancers", unitId, date] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unitId, date, queryClient]);

  const items = useMemo<EstacaoFreelancerItem[]>(() => {
    const result: EstacaoFreelancerItem[] = [];
    const usedCheckinIds = new Set<string>();

    const matchCheckin = (sf: ScheduledFreelancer): FreelancerCheckin | null => {
      // 1. by schedule_id
      if (sf.source === "schedule") {
        const m = checkins.find((c) => c.schedule_id === sf.scheduleId && !usedCheckinIds.has(c.id));
        if (m) return m;
      }
      // 2. by entry_id (manual)
      if (sf.entryId) {
        const m = checkins.find((c: any) => c.entry_id === sf.entryId && !usedCheckinIds.has(c.id));
        if (m) return m;
      }
      // 3. by CPF
      const cpf = cleanCpf(sf.cpf);
      if (cpf.length === 11) {
        const m = checkins.find(
          (c) => cleanCpf(c.freelancer_profiles?.cpf) === cpf && !usedCheckinIds.has(c.id)
        );
        if (m) return m;
      }
      // 4. by normalized name
      const nm = normName(sf.employeeName);
      if (nm) {
        const m = checkins.find(
          (c) => normName(c.freelancer_profiles?.nome_completo) === nm && !usedCheckinIds.has(c.id)
        );
        if (m) return m;
      }
      return null;
    };

    // Sort scheduled: schedules first by startTime, then manuals by name
    const sorted = [...scheduled].sort((a, b) => {
      if (a.source !== b.source) return a.source === "schedule" ? -1 : 1;
      if (a.source === "schedule") {
        return (a.startTime || "").localeCompare(b.startTime || "");
      }
      return a.employeeName.localeCompare(b.employeeName);
    });

    for (const sf of sorted) {
      const ck = matchCheckin(sf);
      let status: EstacaoStatus = "available";
      if (ck) {
        usedCheckinIds.add(ck.id);
        if (ck.status === "completed" || ck.status === "approved") {
          status = "done";
        } else if (ck.status === "open" || ck.status === "pending") {
          status = "in_service";
        } else if (ck.status === "pending_schedule") {
          status = "available";
        } else {
          status = "in_service";
        }
      }
      result.push({
        key: `${sf.source}:${sf.scheduleId || sf.entryId}`,
        source: sf.source,
        status,
        scheduleId: sf.source === "schedule" ? sf.scheduleId : null,
        entryId: sf.entryId,
        checkinId: ck?.id ?? null,
        freelancerId: ck?.freelancer_id ?? null,
        name: sf.employeeName,
        cpf: sf.cpf,
        jobTitle: sf.jobTitle,
        startTime: sf.startTime,
        endTime: sf.endTime,
        agreedRate: sf.agreedRate,
        fotoUrl: ck?.freelancer_profiles?.foto_url ?? null,
        checkedInAt: ck?.checkin_at ?? null,
        checkedOutAt: ck?.checkout_at ?? null,
      });
    }

    // Walk-ins: checkins not matched above
    for (const c of checkins) {
      if (usedCheckinIds.has(c.id)) continue;
      if (c.status === "pending_schedule") continue; // unmatched stub — skip
      const status: EstacaoStatus =
        c.status === "completed" || c.status === "approved"
          ? "done"
          : "in_service";
      result.push({
        key: `walkin:${c.id}`,
        source: "walkin",
        status,
        scheduleId: null,
        entryId: null,
        checkinId: c.id,
        freelancerId: c.freelancer_id,
        name: c.freelancer_profiles?.nome_completo || "Freelancer",
        cpf: c.freelancer_profiles?.cpf || null,
        jobTitle: null,
        startTime: null,
        endTime: null,
        agreedRate: c.valor_informado,
        fotoUrl: c.freelancer_profiles?.foto_url ?? null,
        checkedInAt: c.checkin_at,
        checkedOutAt: c.checkout_at,
      });
    }

    return result;
  }, [scheduled, checkins]);

  return {
    items,
    isLoading: loadingSched || loadingChk,
  };
}
