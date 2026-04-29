// Hook para processar UM POP anexado contra MÚLTIPLAS unidades em paralelo.
// Cada unidade é tratada individualmente: a IA recebe o anexo e o contexto
// (setores disponíveis na marca, headcount, configuração atual) e devolve
// uma proposta via tool calling. O COO revisa e aplica unidade por unidade.

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import {
  sectorsForBrand,
  SECTOR_LABELS,
  type Brand,
  type SectorKey,
} from "@/lib/holding/sectors";
import type { ExtractedAttachment } from "@/lib/extract-attachment-text";
import { matchSheetToUnit } from "@/lib/holding/sheet-matcher";
import type { ProposedPayload } from "@/hooks/usePOPWizard";
import type { HoldingStaffingConfigRow } from "@/hooks/useHoldingConfig";

export type UnitJobStatus =
  | "queued"
  | "streaming"
  | "ready"
  | "failed"
  | "applying"
  | "applied"
  | "discarded";

export interface UnitTarget {
  unitId: string;
  unitName: string;
  brand: Brand;
}

export interface UnitJob extends UnitTarget {
  status: UnitJobStatus;
  assistantText: string;
  proposed?: ProposedPayload;
  currentConfig?: HoldingStaffingConfigRow[];
  error?: string;
  appliedCount?: number;
}

interface RunArgs {
  attachment: ExtractedAttachment;
  targets: UnitTarget[];
  monthYear: string;
  /** Concurrency cap. Default 3. */
  concurrency?: number;
  /** When true, apply each proposal automatically as soon as it's ready. Default false. */
  autoApply?: boolean;
}

const SECTOR_KEYS_BY_BRAND: Record<Brand, SectorKey[]> = {
  "Caju Limão": sectorsForBrand("Caju Limão"),
  "Foster's Burguer": sectorsForBrand("Foster's Burguer"),
  Caminito: sectorsForBrand("Caminito"),
  Nazo: sectorsForBrand("Nazo"),
};

async function loadUnitContext(unitId: string, monthYear: string) {
  const [cfg, headcount] = await Promise.all([
    fetchAllRows<HoldingStaffingConfigRow>(() =>
      supabase
        .from("holding_staffing_config")
        .select("*")
        .eq("unit_id", unitId)
        .eq("month_year", monthYear),
    ).catch(() => [] as HoldingStaffingConfigRow[]),
    loadHeadcount(unitId).catch(() => ({} as Record<string, number>)),
  ]);
  return { cfg, headcount };
}

async function loadHeadcount(unitId: string): Promise<Record<string, number>> {
  const labels = Object.values(SECTOR_LABELS);
  const { data: secs } = await supabase
    .from("sectors")
    .select("id, name")
    .eq("unit_id", unitId)
    .in("name", labels);
  const sectors = (secs as Array<{ id: string; name: string }> | null) ?? [];
  if (!sectors.length) return {};
  const labelToKey = new Map<string, SectorKey>();
  for (const [k, label] of Object.entries(SECTOR_LABELS)) {
    labelToKey.set(label, k as SectorKey);
  }
  const sectorIdToKey = new Map<string, SectorKey>();
  for (const s of sectors) {
    const k = labelToKey.get(s.name);
    if (k) sectorIdToKey.set(s.id, k);
  }
  const sectorIds = sectors.map((s) => s.id);
  const { data: sjt } = await supabase
    .from("sector_job_titles" as any)
    .select("sector_id, job_title_id")
    .in("sector_id", sectorIds);
  const jobTitleToSector = new Map<string, SectorKey>();
  for (const row of ((sjt as unknown) as Array<{ sector_id: string; job_title_id: string }> | null) ?? []) {
    const k = sectorIdToKey.get(row.sector_id);
    if (k && !jobTitleToSector.has(row.job_title_id)) {
      jobTitleToSector.set(row.job_title_id, k);
    }
  }
  const { data: emps } = await supabase
    .from("employees")
    .select("job_title_id")
    .eq("unit_id", unitId)
    .eq("active", true)
    .eq("worker_type", "clt");
  const counts: Record<string, number> = {};
  for (const e of (emps as Array<{ job_title_id: string | null }> | null) ?? []) {
    if (!e.job_title_id) continue;
    const k = jobTitleToSector.get(e.job_title_id);
    if (k) counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

async function runForUnit(
  target: UnitTarget,
  attachment: ExtractedAttachment,
  monthYear: string,
  setText: (t: string) => void,
): Promise<{ proposed: ProposedPayload; currentConfig: HoldingStaffingConfigRow[] }> {
  const { cfg, headcount } = await loadUnitContext(target.unitId, monthYear);
  const availableSectors = SECTOR_KEYS_BY_BRAND[target.brand];

  // Roteamento aba → unidade (Excel multi-aba): manda só o pedaço da unidade.
  const sheetMatch = attachment.sheets
    ? matchSheetToUnit(attachment.sheets, target.unitName, target.brand)
    : null;

  const focusedText = sheetMatch
    ? `--- Aba: ${sheetMatch.sheet.name} ---\n${sheetMatch.sheet.text}`
    : attachment.text;

  const userInstruction = sheetMatch
    ? `O ANEXO abaixo já está FILTRADO para a unidade "${target.unitName}" ` +
      `(${target.brand}) — aba "${sheetMatch.sheet.name}". Use APENAS esses ` +
      `números para gerar a Tabela Mínima COMPLETA (7 dias × 2 turnos × cada setor disponível). ` +
      `Setores citados na aba que não estão em "availableSectors" devem ser ignorados ` +
      `(mencione em summary).`
    : `Use o POP corporativo abaixo como FONTE PRIMÁRIA para gerar a Tabela ` +
      `Mínima COMPLETA da unidade "${target.unitName}" (${target.brand}). ` +
      `Cubra todos os 7 dias da semana × 2 turnos para cada setor disponível. ` +
      `Setores citados no POP que não estão na lista de "availableSectors" desta marca ` +
      `devem ser silenciosamente ignorados (mencione-os em summary como não aplicáveis).`;

  let userContent: any;
  if (attachment.kind === "image") {
    userContent = [
      { type: "text", text: userInstruction },
      { type: "image_url", image_url: { url: attachment.dataUrl } },
    ];
  } else {
    const block = `## ANEXO: ${attachment.name}${attachment.truncated ? " (truncado)" : ""}\n${focusedText}`;
    userContent = `${block}\n\n---\n${userInstruction}`;
  }

  const payload = {
    messages: [{ role: "user", content: userContent }],
    mode: "validate" as const,
    context: {
      brand: target.brand,
      unitId: target.unitId,
      unitName: target.unitName,
      monthYear,
      currentConfig: cfg.map((r) => ({
        sector_key: r.sector_key,
        shift_type: r.shift_type,
        day_of_week: r.day_of_week,
        required_count: r.required_count,
        extras_count: r.extras_count,
      })),
      effectiveHeadcount: headcount,
      availableSectors,
      sheetMatched: !!sheetMatch,
      sheetName: sheetMatch?.sheet.name ?? null,
    },
  };

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pop-wizard-chat`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch {/* ignore */}
    throw new Error(msg);
  }
  if (!resp.body) throw new Error("Sem corpo de resposta");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantSoFar = "";
  let toolArgs = "";
  let toolName = "";
  let done = false;

  while (!done) {
    const { value, done: d } = await reader.read();
    if (d) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        done = true;
        break;
      }
      try {
        const parsed = JSON.parse(json);
        const delta = parsed.choices?.[0]?.delta;
        if (delta?.content) {
          assistantSoFar += delta.content;
          setText(assistantSoFar);
        }
        const tcs = delta?.tool_calls;
        if (Array.isArray(tcs)) {
          for (const tc of tcs) {
            if (tc.function?.name) toolName = tc.function.name;
            if (tc.function?.arguments) toolArgs += tc.function.arguments;
          }
        }
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  if (toolName !== "propose_staffing_changes" || !toolArgs) {
    throw new Error(
      "A IA não devolveu uma proposta estruturada. Tente novamente ou troque o anexo.",
    );
  }
  const proposed = JSON.parse(toolArgs) as ProposedPayload;
  if (!Array.isArray(proposed.changes)) {
    throw new Error("Formato de proposta inválido.");
  }
  return { proposed, currentConfig: cfg };
}

export function usePOPWizardBatch() {
  const [jobs, setJobs] = useState<UnitJob[]>([]);
  const [running, setRunning] = useState(false);

  // Mantém a referência do anexo + monthYear para retry posterior
  const lastRunRef = useRef<{ attachment: ExtractedAttachment; monthYear: string } | null>(null);

  const updateJob = useCallback((unitId: string, patch: Partial<UnitJob>) => {
    setJobs((prev) => prev.map((j) => (j.unitId === unitId ? { ...j, ...patch } : j)));
  }, []);

  const reset = useCallback(() => {
    setJobs([]);
    setRunning(false);
    lastRunRef.current = null;
  }, []);

  const applyJob = useCallback(
    async (job: UnitJob, monthYearArg: string) => {
      if (!job?.proposed?.changes?.length) return;
      updateJob(job.unitId, { status: "applying" });
      let ok = 0;
      let fail = 0;
      for (const c of job.proposed.changes) {
        const { error } = await supabase
          .from("holding_staffing_config")
          .upsert(
            {
              unit_id: job.unitId,
              brand: job.brand,
              sector_key: c.sector_key,
              shift_type: c.shift_type,
              day_of_week: c.day_of_week,
              month_year: monthYearArg,
              required_count: c.required_count,
              extras_count: c.extras_count,
              updated_at: new Date().toISOString(),
            } as never,
            {
              onConflict: "unit_id,sector_key,shift_type,day_of_week,month_year",
            },
          );
        if (error) fail++;
        else ok++;
      }
      if (fail === 0) {
        updateJob(job.unitId, { status: "applied", appliedCount: ok });
        toast.success(`${job.unitName}: ${ok} célula(s) aplicada(s).`);
      } else {
        updateJob(job.unitId, {
          status: "failed",
          error: `${fail} de ${ok + fail} falharam ao salvar.`,
        });
        toast.warning(`${job.unitName}: ${ok} ok, ${fail} com erro.`);
      }
    },
    [updateJob],
  );

  const run = useCallback(
    async ({ attachment, targets, monthYear, concurrency = 3, autoApply = false }: RunArgs) => {
      lastRunRef.current = { attachment, monthYear };
      const initial: UnitJob[] = targets.map((t) => ({
        ...t,
        status: "queued",
        assistantText: "",
      }));
      setJobs(initial);
      setRunning(true);

      const queue = [...targets];
      const workers: Promise<void>[] = [];
      const worker = async () => {
        while (queue.length > 0) {
          const t = queue.shift();
          if (!t) return;
          updateJob(t.unitId, { status: "streaming" });
          try {
            const { proposed, currentConfig } = await runForUnit(
              t,
              attachment,
              monthYear,
              (txt) => updateJob(t.unitId, { assistantText: txt }),
            );
            updateJob(t.unitId, { status: "ready", proposed, currentConfig });
            if (autoApply) {
              const readyJob: UnitJob = {
                ...t,
                status: "ready",
                assistantText: "",
                proposed,
                currentConfig,
              };
              await applyJob(readyJob, monthYear);
            }
          } catch (err: any) {
            const msg = err?.message ?? "Falha ao gerar proposta.";
            updateJob(t.unitId, { status: "failed", error: msg });
          }
        }
      };
      for (let i = 0; i < Math.max(1, concurrency); i++) workers.push(worker());
      await Promise.all(workers);
      setRunning(false);
    },
    [updateJob, applyJob],
  );

  const applyOne = useCallback(
    async (unitId: string) => {
      const ctx = lastRunRef.current;
      const job = jobs.find((j) => j.unitId === unitId);
      if (!job || !ctx) return;
      await applyJob(job, ctx.monthYear);
    },
    [jobs, applyJob],
  );

  const applyAllReady = useCallback(async () => {
    const readyIds = jobs.filter((j) => j.status === "ready").map((j) => j.unitId);
    for (const id of readyIds) {
      // sequencial para feedback claro e evitar burst no banco
      // eslint-disable-next-line no-await-in-loop
      await applyOne(id);
    }
  }, [jobs, applyOne]);

  const discardOne = useCallback(
    (unitId: string) => updateJob(unitId, { status: "discarded" }),
    [updateJob],
  );

  const retryOne = useCallback(
    async (unitId: string) => {
      const ctx = lastRunRef.current;
      const job = jobs.find((j) => j.unitId === unitId);
      if (!job || !ctx) return;
      updateJob(unitId, { status: "streaming", error: undefined, assistantText: "" });
      try {
        const { proposed, currentConfig } = await runForUnit(
          job,
          ctx.attachment,
          ctx.monthYear,
          (txt) => updateJob(unitId, { assistantText: txt }),
        );
        updateJob(unitId, { status: "ready", proposed, currentConfig });
      } catch (err: any) {
        updateJob(unitId, { status: "failed", error: err?.message ?? "Falha." });
      }
    },
    [jobs, updateJob],
  );

  const summary = useMemo(() => {
    const total = jobs.length;
    const ready = jobs.filter((j) => j.status === "ready").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const applied = jobs.filter((j) => j.status === "applied").length;
    const streaming = jobs.filter(
      (j) => j.status === "streaming" || j.status === "applying",
    ).length;
    return { total, ready, failed, applied, streaming };
  }, [jobs]);

  return {
    jobs,
    running,
    summary,
    run,
    applyOne,
    applyAllReady,
    discardOne,
    retryOne,
    reset,
  };
}
