import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ManualSchedule {
  id: string;
  user_id: string;
  employee_id: string | null;
  schedule_date: string;
  shift_id: string;
  sector_id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  break_duration: number;
  schedule_type: "working" | "off" | "vacation" | "sick_leave";
  agreed_rate: number;
  praca_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useManualSchedules(unitId: string | null, weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["manual-schedules", unitId, weekStart, weekEnd],
    queryFn: async () => {
      if (!unitId) return [];

      const { data: sectors } = await supabase
        .from("sectors")
        .select("id")
        .eq("unit_id", unitId);

      if (!sectors || sectors.length === 0) return [];

      const sectorIds = sectors.map((s) => s.id);

      // Include partner sectors so shared-sector schedules show up in both stores
      const { data: partnerships } = await supabase
        .from("sector_partnerships" as any)
        .select("sector_id, partner_sector_id")
        .or(
          `sector_id.in.(${sectorIds.join(",")}),partner_sector_id.in.(${sectorIds.join(",")})`
        );

      const allSectorIds = new Set<string>(sectorIds);
      for (const row of (partnerships as any[]) || []) {
        allSectorIds.add(row.sector_id);
        allSectorIds.add(row.partner_sector_id);
      }

      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .in("sector_id", Array.from(allSectorIds))
        .gte("schedule_date", weekStart)
        .lte("schedule_date", weekEnd)
        .neq("status", "cancelled");

      if (error) throw error;
      return (data || []) as ManualSchedule[];
    },
    enabled: !!unitId,
  });
}

async function resolveShiftId(shiftType?: string): Promise<string> {
  if (shiftType) {
    const { data: matched } = await supabase
      .from("shifts")
      .select("id")
      .eq("type", shiftType)
      .limit(1);
    if (matched && matched.length > 0) return matched[0].id;
  }
  const { data: any } = await supabase.from("shifts").select("id").limit(1);
  if (!any || any.length === 0) throw new Error("Nenhum turno cadastrado.");
  return any[0].id;
}

async function autoCreatePendingCheckin(
  employeeId: string,
  scheduleDate: string,
  lojaId: string,
  agreedRate: number,
  scheduleId: string
) {
  try {
    // 1. Get employee CPF and unit_id
    const { data: employee } = await supabase
      .from("employees")
      .select("cpf, unit_id, worker_type")
      .eq("id", employeeId)
      .single();

    if (!employee || employee.worker_type !== "freelancer" || !employee.cpf) return;

    // 2. Get the unit_id (loja_id) from the sector
    const lojaIdToUse = employee.unit_id;

    // 3. Find freelancer_profile by CPF
    const cleanCpf = employee.cpf.replace(/\D/g, "");
    const { data: profile } = await supabase
      .from("freelancer_profiles")
      .select("id, foto_url")
      .or(`cpf.eq.${cleanCpf},cpf.eq.${employee.cpf}`)
      .maybeSingle();

    if (!profile) return; // No profile found — freelancer will register via QR Code

    // 4. Check if a pending checkin already exists for this schedule
    const { data: existingCheckin } = await supabase
      .from("freelancer_checkins")
      .select("id")
      .eq("schedule_id", scheduleId)
      .maybeSingle();

    if (existingCheckin) return; // Already has a checkin linked

    // 5. Also check if there's already a checkin for this freelancer/loja/date
    const { data: existingByDate } = await supabase
      .from("freelancer_checkins")
      .select("id")
      .eq("freelancer_id", profile.id)
      .eq("loja_id", lojaIdToUse)
      .eq("checkin_date", scheduleDate)
      .maybeSingle();

    if (existingByDate) return; // Already has a checkin for this date

    // 6. Create pending checkin record
    await supabase
      .from("freelancer_checkins")
      .insert({
        freelancer_id: profile.id,
        loja_id: lojaIdToUse,
        checkin_date: scheduleDate,
        checkin_selfie_url: profile.foto_url || "pending",
        status: "pending_schedule",
        valor_informado: agreedRate,
        schedule_id: scheduleId,
        checkin_at: new Date().toISOString(),
      } as any);
  } catch (err) {
    // Don't block the schedule save if checkin creation fails
    console.warn("Auto-create pending checkin failed:", err);
  }
}

export function useUpsertSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id?: string;
      employee_id: string;
      schedule_date: string;
      sector_id: string;
      start_time?: string | null;
      end_time?: string | null;
      break_duration?: number;
      schedule_type: "working" | "off" | "vacation" | "sick_leave";
      agreed_rate?: number;
      shift_type?: string;
      praca_id?: string | null;
    }) => {
      const shiftId = await resolveShiftId(params.shift_type);

      const payload: any = {
        employee_id: params.employee_id,
        user_id: params.employee_id,
        schedule_date: params.schedule_date,
        sector_id: params.sector_id,
        status: "scheduled",
        schedule_type: params.schedule_type,
        start_time: params.start_time || null,
        end_time: params.end_time || null,
        break_duration: params.break_duration ?? 60,
        agreed_rate: params.agreed_rate ?? 0,
        shift_id: shiftId,
        praca_id: params.praca_id ?? null,
      };

      let scheduleId: string | null = null;

      // If we already have an id, just update
      if (params.id) {
        const { error } = await supabase
          .from("schedules")
          .update(payload)
          .eq("id", params.id);
        if (error) throw error;
        scheduleId = params.id;
      } else {
        // Check for existing schedule (active or cancelled) for this cell
        const { data: existing } = await supabase
          .from("schedules")
          .select("id, status")
          .eq("employee_id", params.employee_id)
          .eq("schedule_date", params.schedule_date)
          .eq("sector_id", params.sector_id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existing && existing.length > 0) {
          // Reactivate/update the existing record
          const { error } = await supabase
            .from("schedules")
            .update(payload)
            .eq("id", existing[0].id);
          if (error) throw error;
          scheduleId = existing[0].id;
        } else {
          // No existing record — insert new
          const { data: inserted, error } = await supabase
            .from("schedules")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw error;
          scheduleId = inserted.id;
        }
      }

      // Auto-create pending checkin for freelancers
      if (scheduleId && params.schedule_type === "working") {
        // Get unit_id from sector
        const { data: sector } = await supabase
          .from("sectors")
          .select("unit_id")
          .eq("id", params.sector_id)
          .single();

        if (sector) {
          await autoCreatePendingCheckin(
            params.employee_id,
            params.schedule_date,
            sector.unit_id,
            params.agreed_rate ?? 0,
            scheduleId
          );
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      qc.invalidateQueries({ queryKey: ["freelancer-checkins"] });
      toast.success("Escala salva!");
    },
    onError: (err: Error) => {
      toast.error(err.message, { duration: 6000 });
    },
  });
}

export function useCancelSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("schedules")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      toast.success("Escala removida!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}

export function useBulkVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      employee_id: string;
      sector_id: string;
      start_date: string;
      end_date: string;
      shift_type?: string;
    }) => {
      const dates: string[] = [];
      const start = new Date(params.start_date + "T12:00:00");
      const end = new Date(params.end_date + "T12:00:00");
      if (end < start) throw new Error("Data final deve ser após a data inicial.");
      const diffDays = Math.round((end.getTime() - start.getTime()) / (86400000)) + 1;
      if (diffDays > 45) throw new Error("Período máximo de 45 dias.");

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        dates.push(`${yyyy}-${mm}-${dd}`);
      }

      const shiftId = await resolveShiftId(params.shift_type);

      // Cancel existing working schedules in the range
      const { data: existing } = await supabase
        .from("schedules")
        .select("id, schedule_date")
        .eq("employee_id", params.employee_id)
        .eq("sector_id", params.sector_id)
        .gte("schedule_date", params.start_date)
        .lte("schedule_date", params.end_date)
        .neq("status", "cancelled");

      if (existing && existing.length > 0) {
        const cancelIds = existing.map((e) => e.id);
        await supabase
          .from("schedules")
          .update({ status: "cancelled" })
          .in("id", cancelIds);
      }

      // Insert vacation for all dates
      const toInsert = dates.map((date) => ({
        employee_id: params.employee_id,
        user_id: params.employee_id,
        schedule_date: date,
        sector_id: params.sector_id,
        shift_id: shiftId,
        status: "scheduled",
        schedule_type: "vacation" as const,
        start_time: null,
        end_time: null,
        break_duration: 0,
        agreed_rate: 0,
      }));

      const { error } = await supabase.from("schedules").insert(toInsert);
      if (error) throw error;

      return dates.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(`Férias lançadas: ${count} dia(s)!`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelEmployeeWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      employee_id: string;
      sector_ids: string[];
      week_start: string;
      week_end: string;
    }) => {
      const { data: existing, error: fetchErr } = await supabase
        .from("schedules")
        .select("id")
        .eq("employee_id", params.employee_id)
        .in("sector_id", params.sector_ids)
        .gte("schedule_date", params.week_start)
        .lte("schedule_date", params.week_end)
        .neq("status", "cancelled");

      if (fetchErr) throw fetchErr;
      if (!existing || existing.length === 0) {
        // No schedules to cancel — still counts as success for CLT base removal
        return 0;
      }

      const ids = existing.map((e) => e.id);
      const { error } = await supabase
        .from("schedules")
        .update({ status: "cancelled" })
        .in("id", ids);
      if (error) throw error;

      return ids.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(count > 0 ? `${count} escala(s) removida(s)!` : "Funcionário removido da semana.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCopyPreviousDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      sourceDate: string;
      targetDate: string;
      unitId: string;
    }) => {
      const { data: sectors } = await supabase
        .from("sectors")
        .select("id")
        .eq("unit_id", params.unitId);

      if (!sectors || sectors.length === 0) return;

      const sectorIds = sectors.map((s) => s.id);

      const { data: sourceSchedules, error: fetchErr } = await supabase
        .from("schedules")
        .select("*")
        .in("sector_id", sectorIds)
        .eq("schedule_date", params.sourceDate)
        .neq("status", "cancelled");

      if (fetchErr) throw fetchErr;
      if (!sourceSchedules || sourceSchedules.length === 0) {
        throw new Error("Nenhuma escala encontrada no dia anterior.");
      }

      // Check for existing entries on target date
      const { data: existing } = await supabase
        .from("schedules")
        .select("employee_id, sector_id")
        .in("sector_id", sectorIds)
        .eq("schedule_date", params.targetDate)
        .neq("status", "cancelled");

      const existingKeys = new Set(
        (existing || []).map((e) => `${e.employee_id}_${e.sector_id}`)
      );

      const toInsert = sourceSchedules
        .filter((s) => !existingKeys.has(`${s.employee_id}_${s.sector_id}`))
        .map((s) => ({
          employee_id: s.employee_id!,
          user_id: s.employee_id!,
          schedule_date: params.targetDate,
          shift_id: s.shift_id,
          sector_id: s.sector_id,
          status: "scheduled",
          start_time: s.start_time,
          end_time: s.end_time,
          break_duration: s.break_duration,
          schedule_type: s.schedule_type,
          agreed_rate: s.agreed_rate,
        }));

      if (toInsert.length === 0) {
        throw new Error("Todos os funcionários já estão escalados neste dia.");
      }

      const { error } = await supabase.from("schedules").insert(toInsert);
      if (error) throw error;

      return toInsert.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      toast.success(`${count} escala(s) copiada(s)!`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Copy a single employee's full week to the NEXT week (date + 7) ───
// Reads source employee's active schedules within [sourceWeekStart, sourceWeekEnd]
// (across given sectors) and replicates them shifted +7 days for the same employee.
// Honours destination uniqueness: skips by default, updates if overwrite=true.
export function useCopyEmployeeToNextWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      employeeId: string;
      sourceWeekStart: string; // YYYY-MM-DD
      sourceWeekEnd: string;   // YYYY-MM-DD
      sectorIds: string[];
      overwrite?: boolean;
    }) => {
      if (!params.sectorIds.length) {
        throw new Error("Nenhum setor informado.");
      }

      const addDays = (iso: string, days: number) => {
        const d = new Date(iso + "T12:00:00");
        d.setDate(d.getDate() + days);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      };

      const targetWeekStart = addDays(params.sourceWeekStart, 7);
      const targetWeekEnd = addDays(params.sourceWeekEnd, 7);

      // 1. Fetch source schedules
      const { data: sourceSchedules, error: srcErr } = await supabase
        .from("schedules")
        .select("*")
        .eq("employee_id", params.employeeId)
        .in("sector_id", params.sectorIds)
        .gte("schedule_date", params.sourceWeekStart)
        .lte("schedule_date", params.sourceWeekEnd)
        .neq("status", "cancelled");
      if (srcErr) throw srcErr;
      if (!sourceSchedules || sourceSchedules.length === 0) {
        throw new Error("Este colaborador não tem escalas na semana atual.");
      }

      // 2. Fetch existing destination schedules in target week
      const { data: existing } = await supabase
        .from("schedules")
        .select("id, schedule_date, sector_id")
        .eq("employee_id", params.employeeId)
        .in("sector_id", params.sectorIds)
        .gte("schedule_date", targetWeekStart)
        .lte("schedule_date", targetWeekEnd)
        .neq("status", "cancelled");

      const existingMap = new Map<string, string>();
      (existing || []).forEach((e) => {
        existingMap.set(`${e.schedule_date}_${e.sector_id}`, e.id);
      });

      let copied = 0;
      let skipped = 0;

      for (const s of sourceSchedules) {
        const targetDate = addDays(s.schedule_date, 7);
        const key = `${targetDate}_${s.sector_id}`;
        const existsId = existingMap.get(key);

        const payload = {
          employee_id: params.employeeId,
          user_id: params.employeeId,
          schedule_date: targetDate,
          shift_id: s.shift_id,
          sector_id: s.sector_id,
          status: "scheduled",
          start_time: s.start_time,
          end_time: s.end_time,
          break_duration: s.break_duration,
          schedule_type: s.schedule_type,
          agreed_rate: s.agreed_rate,
          praca_id: s.praca_id ?? null,
        };

        if (existsId) {
          if (!params.overwrite) {
            skipped++;
            continue;
          }
          const { error } = await supabase
            .from("schedules")
            .update(payload)
            .eq("id", existsId);
          if (error) throw error;
          copied++;
        } else {
          const { error } = await supabase.from("schedules").insert(payload);
          if (error) throw error;
          copied++;
        }
      }

      return { copied, skipped, targetWeekStart, targetWeekEnd };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      const msg = res.skipped > 0
        ? `${res.copied} escala(s) copiada(s) para próxima semana, ${res.skipped} ignorada(s).`
        : `${res.copied} escala(s) copiada(s) para próxima semana!`;
      toast.success(msg);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Copy ALL employees' schedules from current week to NEXT week (batch) ───
export function useCopyWeekToNextWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      sourceWeekStart: string;
      sourceWeekEnd: string;
      sectorIds: string[];
      overwrite?: boolean;
    }) => {
      if (!params.sectorIds.length) {
        throw new Error("Nenhum setor informado.");
      }

      const addDays = (iso: string, days: number) => {
        const d = new Date(iso + "T12:00:00");
        d.setDate(d.getDate() + days);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      };

      const targetWeekStart = addDays(params.sourceWeekStart, 7);
      const targetWeekEnd = addDays(params.sourceWeekEnd, 7);

      // Fetch all source schedules in the week range
      const { data: sourceSchedules, error: srcErr } = await supabase
        .from("schedules")
        .select("*")
        .in("sector_id", params.sectorIds)
        .gte("schedule_date", params.sourceWeekStart)
        .lte("schedule_date", params.sourceWeekEnd)
        .neq("status", "cancelled");
      if (srcErr) throw srcErr;
      if (!sourceSchedules || sourceSchedules.length === 0) {
        throw new Error("Não há escalas na semana atual para copiar.");
      }

      // Fetch existing destination
      const { data: existing } = await supabase
        .from("schedules")
        .select("id, schedule_date, sector_id, employee_id")
        .in("sector_id", params.sectorIds)
        .gte("schedule_date", targetWeekStart)
        .lte("schedule_date", targetWeekEnd)
        .neq("status", "cancelled");

      const existingMap = new Map<string, string>();
      (existing || []).forEach((e) => {
        existingMap.set(`${e.employee_id}_${e.schedule_date}_${e.sector_id}`, e.id);
      });

      let copied = 0;
      let skipped = 0;

      for (const s of sourceSchedules) {
        if (!s.employee_id) continue;
        const targetDate = addDays(s.schedule_date, 7);
        const key = `${s.employee_id}_${targetDate}_${s.sector_id}`;
        const existsId = existingMap.get(key);

        const payload = {
          employee_id: s.employee_id,
          user_id: s.employee_id,
          schedule_date: targetDate,
          shift_id: s.shift_id,
          sector_id: s.sector_id,
          status: "scheduled",
          start_time: s.start_time,
          end_time: s.end_time,
          break_duration: s.break_duration,
          schedule_type: s.schedule_type,
          agreed_rate: s.agreed_rate,
          praca_id: s.praca_id ?? null,
        };

        if (existsId) {
          if (!params.overwrite) {
            skipped++;
            continue;
          }
          const { error } = await supabase
            .from("schedules")
            .update(payload)
            .eq("id", existsId);
          if (error) throw error;
          copied++;
        } else {
          const { error } = await supabase.from("schedules").insert(payload);
          if (error) throw error;
          copied++;
        }
      }

      return { copied, skipped };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      const msg = res.skipped > 0
        ? `Semana replicada: ${res.copied} escala(s), ${res.skipped} ignorada(s).`
        : `Semana replicada: ${res.copied} escala(s) copiada(s)!`;
      toast.success(msg);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Copy a full week of schedules from one employee to another ───
// Reads source employee's schedules in the week range (across given sectors)
// and clones them onto target employee. Honours uniqueness by skipping
// dates already filled on the destination unless overwrite=true.
export function useCopyEmployeeWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      sourceEmployeeId: string;
      targetEmployeeId: string;
      weekStart: string;
      weekEnd: string;
      sectorIds: string[];
      overwrite?: boolean;
    }) => {
      if (params.sourceEmployeeId === params.targetEmployeeId) {
        throw new Error("Origem e destino são o mesmo colaborador.");
      }
      if (!params.sectorIds.length) {
        throw new Error("Nenhum setor informado.");
      }

      // 1. Fetch source schedules
      const { data: sourceSchedules, error: srcErr } = await supabase
        .from("schedules")
        .select("*")
        .eq("employee_id", params.sourceEmployeeId)
        .in("sector_id", params.sectorIds)
        .gte("schedule_date", params.weekStart)
        .lte("schedule_date", params.weekEnd)
        .neq("status", "cancelled");
      if (srcErr) throw srcErr;
      if (!sourceSchedules || sourceSchedules.length === 0) {
        throw new Error("O colaborador de origem não tem escalas nesta semana.");
      }

      // 2. Fetch existing destination schedules
      const { data: existing } = await supabase
        .from("schedules")
        .select("id, schedule_date, sector_id")
        .eq("employee_id", params.targetEmployeeId)
        .in("sector_id", params.sectorIds)
        .gte("schedule_date", params.weekStart)
        .lte("schedule_date", params.weekEnd)
        .neq("status", "cancelled");

      const existingMap = new Map<string, string>();
      (existing || []).forEach((e) => {
        existingMap.set(`${e.schedule_date}_${e.sector_id}`, e.id);
      });

      let copied = 0;
      let skipped = 0;

      for (const s of sourceSchedules) {
        const key = `${s.schedule_date}_${s.sector_id}`;
        const existsId = existingMap.get(key);

        const payload = {
          employee_id: params.targetEmployeeId,
          user_id: params.targetEmployeeId,
          schedule_date: s.schedule_date,
          shift_id: s.shift_id,
          sector_id: s.sector_id,
          status: "scheduled",
          start_time: s.start_time,
          end_time: s.end_time,
          break_duration: s.break_duration,
          schedule_type: s.schedule_type,
          agreed_rate: s.agreed_rate,
          praca_id: s.praca_id ?? null,
        };

        if (existsId) {
          if (!params.overwrite) {
            skipped++;
            continue;
          }
          const { error } = await supabase
            .from("schedules")
            .update(payload)
            .eq("id", existsId);
          if (error) throw error;
          copied++;
        } else {
          const { error } = await supabase.from("schedules").insert(payload);
          if (error) throw error;
          copied++;
        }
      }

      return { copied, skipped };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      const msg = res.skipped > 0
        ? `${res.copied} escala(s) copiada(s), ${res.skipped} ignorada(s).`
        : `${res.copied} escala(s) copiada(s)!`;
      toast.success(msg);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
