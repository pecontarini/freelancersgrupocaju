// AI-generated "open vacancy" slots persisted in Supabase (table `ai_draft_slots`).
// Persistence allows multiple users (e.g. generator + linker) to collaborate.
// Realtime subscription keeps editors in sync without refresh.

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DraftDay =
  | { kind: "off" }
  | {
      kind: "work";
      start_time: string;
      end_time: string;
      break_min: number;
      shift_type?: string;
    };

export interface DraftSlot {
  id: string;
  unit_id: string;
  sector_id: string;
  sector_name?: string; // hydrated client-side, not stored
  week_start: string;
  label: string;
  tipo: string;
  responsavel?: boolean;
  job_title_id?: string | null;
  days: Record<string, DraftDay>;
  created_by?: string | null;
  created_at?: string;
}

const KEY = (unit?: string | null, sector?: string | null, week?: string | null) =>
  ["ai-draft-slots", unit, sector, week] as const;

// ---------- Read hook ----------
export function useDraftSlotsFor(
  unitId: string | null,
  sectorId: string | null,
  weekStart: string | null,
) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: KEY(unitId, sectorId, weekStart),
    enabled: !!unitId && !!sectorId && !!weekStart,
    queryFn: async (): Promise<DraftSlot[]> => {
      const { data, error } = await supabase
        .from("ai_draft_slots")
        .select("*")
        .eq("unit_id", unitId!)
        .eq("sector_id", sectorId!)
        .eq("week_start", weekStart!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        unit_id: r.unit_id,
        sector_id: r.sector_id,
        week_start: r.week_start,
        label: r.label,
        tipo: r.tipo,
        responsavel: r.responsavel,
        days: (r.days ?? {}) as Record<string, DraftDay>,
        created_by: r.created_by,
        created_at: r.created_at,
      }));
    },
  });

  // Realtime: invalidate on any change for this slice
  useEffect(() => {
    if (!unitId || !sectorId || !weekStart) return;
    const ch = supabase
      .channel(`ai-drafts-${unitId}-${sectorId}-${weekStart}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_draft_slots",
          filter: `unit_id=eq.${unitId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: KEY(unitId, sectorId, weekStart) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [unitId, sectorId, weekStart, qc]);

  return q.data ?? [];
}

// ---------- Insert (used by Gerador IA) ----------
export async function insertDraftSlots(
  slots: Omit<DraftSlot, "id" | "created_at" | "created_by">[],
): Promise<{ inserted: number }> {
  if (!slots.length) return { inserted: 0 };
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // Replace previous drafts for the same (unit, sector, week)
  const groups = new Map<string, { unit: string; sector: string; week: string }>();
  for (const s of slots) {
    const k = `${s.unit_id}|${s.sector_id}|${s.week_start}`;
    if (!groups.has(k))
      groups.set(k, { unit: s.unit_id, sector: s.sector_id, week: s.week_start });
  }
  for (const g of groups.values()) {
    await supabase
      .from("ai_draft_slots")
      .delete()
      .eq("unit_id", g.unit)
      .eq("sector_id", g.sector)
      .eq("week_start", g.week);
  }

  const payload = slots.map((s) => ({
    unit_id: s.unit_id,
    sector_id: s.sector_id,
    week_start: s.week_start,
    label: s.label,
    tipo: s.tipo,
    responsavel: !!s.responsavel,
    days: s.days,
    created_by: userId,
  }));
  const { error, data } = await supabase
    .from("ai_draft_slots")
    .insert(payload)
    .select("id");
  if (error) throw error;
  return { inserted: data?.length ?? 0 };
}

// ---------- Mutations used by the Editor ----------
export async function removeDraftSlot(id: string) {
  const { error } = await supabase.from("ai_draft_slots").delete().eq("id", id);
  if (error) {
    toast.error(`Falha ao remover vaga: ${error.message}`);
    throw error;
  }
}

export async function clearDraftSlotsFor(
  unitId: string,
  sectorId: string,
  weekStart: string,
) {
  const { error } = await supabase
    .from("ai_draft_slots")
    .delete()
    .eq("unit_id", unitId)
    .eq("sector_id", sectorId)
    .eq("week_start", weekStart);
  if (error) {
    toast.error(`Falha ao limpar vagas: ${error.message}`);
    throw error;
  }
}

export async function updateDraftSlotDay(
  id: string,
  date: string,
  day: DraftDay | null,
) {
  // Read current days, mutate, persist
  const { data: row, error: readErr } = await supabase
    .from("ai_draft_slots")
    .select("days")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  const days: Record<string, DraftDay> = (row?.days ?? {}) as any;
  if (day === null) delete days[date];
  else days[date] = day;
  const { error } = await supabase
    .from("ai_draft_slots")
    .update({ days })
    .eq("id", id);
  if (error) throw error;
}
