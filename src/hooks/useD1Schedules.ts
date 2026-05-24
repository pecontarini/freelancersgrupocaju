import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface D1Schedule {
  id: string;
  schedule_date: string;
  employee_id: string | null;
  employee_name: string;
  employee_phone: string | null;
  job_title: string | null;
  worker_type: string;
  sector_name: string;
  sector_id: string;
  start_time: string | null;
  end_time: string | null;
  schedule_type: string;
  confirmation_status: string | null;
  denial_reason: string | null;
  /** N.º de registros mesclados (1 = sem duplicidade). */
  duplicate_count: number;
  /** Se existe um cadastro canônico vindo do Secullum para essa pessoa. */
  has_secullum_canonical: boolean;
  /** Todos os employee_id agrupados nesta linha (inclui o exibido). */
  merged_employee_ids: string[];
  /** CPF normalizado da identidade (quando disponível). */
  identity_cpf: string | null;
  /** Nome normalizado da identidade (fallback de chave). */
  identity_key: string;
}

export interface DuplicateGroup {
  identity_key: string;
  identity_cpf: string | null;
  canonical?: {
    id: string;
    name: string;
    cpf: string | null;
    secullum_id: number | null;
  };
  members: Array<{
    id: string;
    name: string;
    cpf: string | null;
    secullum_id: number | null;
    schedule_count: number;
    created_at: string;
  }>;
}

function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

/** Normaliza nome para chave de identidade. */
function normName(name: string): string {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "") // remove sufixo (CB), (SB) etc.
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Heurística: se um nome contém o outro (primeiro nome + algum sobrenome em comum),
 * considera o mesmo. Ex.: "TAINARA" vs "TAINARA PEREIRA BARBOSA".
 */
function pickIdentityKey(name: string, allKeys: Set<string>): string {
  const base = normName(name);
  if (!base) return base;
  // Tenta achar uma chave existente mais completa que englobe ou seja englobada
  const parts = base.split(" ");
  if (parts.length === 1) {
    // Procura chave maior que comece com este primeiro nome
    for (const k of allKeys) {
      const kp = k.split(" ");
      if (kp.length > 1 && kp[0] === parts[0]) return k;
    }
  }
  return base;
}

export function useD1Schedules(unitId: string | null, date: string) {
  return useQuery({
    queryKey: ["d1-schedules", unitId, date],
    queryFn: async () => {
      if (!unitId) return { schedules: [] as D1Schedule[], duplicateGroups: [] as DuplicateGroup[] };

      const [{ data: sectors }, { data: unitEmployees }] = await Promise.all([
        supabase.from("sectors").select("id, name").eq("unit_id", unitId),
        supabase
          .from("employees")
          .select("id, name, cpf, secullum_id, phone, job_title, worker_type, created_at")
          .eq("unit_id", unitId),
      ]);

      if (!sectors?.length) return { schedules: [], duplicateGroups: [] };

      const sectorIds = sectors.map((s) => s.id);
      const sectorMap = new Map(sectors.map((s) => [s.id, s.name]));

      // Pré-computa chaves de identidade dos employees
      const allKeys = new Set<string>();
      (unitEmployees || []).forEach((e: any) => {
        if (e.name) allKeys.add(normName(e.name));
      });

      // Indexa employees por identidade (CPF prioritário, depois nome normalizado)
      type EmpInfo = {
        id: string;
        name: string;
        cpf: string | null;
        secullum_id: number | null;
        phone: string | null;
        job_title: string | null;
        worker_type: string;
        created_at: string;
        identity_cpf: string | null;
        identity_key: string;
      };
      const empById = new Map<string, EmpInfo>();
      // Para cada identidade, lista de employees
      const idToEmps = new Map<string, EmpInfo[]>();

      (unitEmployees || []).forEach((e: any) => {
        const cpfDigits = onlyDigits(e.cpf);
        const identity_cpf = cpfDigits.length === 11 ? cpfDigits : null;
        const identity_key = identity_cpf
          ? `CPF:${identity_cpf}`
          : `NAME:${pickIdentityKey(e.name || "", allKeys)}`;
        const info: EmpInfo = {
          id: e.id,
          name: e.name || "—",
          cpf: identity_cpf,
          secullum_id: e.secullum_id ?? null,
          phone: e.phone || null,
          job_title: e.job_title || null,
          worker_type: e.worker_type || "clt",
          created_at: e.created_at,
          identity_cpf,
          identity_key,
        };
        empById.set(e.id, info);
        if (!idToEmps.has(identity_key)) idToEmps.set(identity_key, []);
        idToEmps.get(identity_key)!.push(info);
      });

      // Resolve canônico (Secullum) por identidade
      const canonicalByKey = new Map<string, EmpInfo>();
      idToEmps.forEach((emps, key) => {
        const sec = emps.find((e) => e.secullum_id !== null);
        if (sec) canonicalByKey.set(key, sec);
        else {
          // fallback: mais informação (CPF > telefone > mais recente)
          const sorted = [...emps].sort((a, b) => {
            const scoreA = (a.cpf ? 2 : 0) + (a.phone ? 1 : 0);
            const scoreB = (b.cpf ? 2 : 0) + (b.phone ? 1 : 0);
            if (scoreA !== scoreB) return scoreB - scoreA;
            return (b.created_at || "").localeCompare(a.created_at || "");
          });
          canonicalByKey.set(key, sorted[0]);
        }
      });

      const { data: schedules, error } = await supabase
        .from("schedules")
        .select(`
          id, schedule_date, employee_id, sector_id,
          start_time, end_time, schedule_type,
          confirmation_status, denial_reason,
          shifts!schedules_shift_id_fkey ( start_time, end_time )
        `)
        .in("sector_id", sectorIds)
        .eq("schedule_date", date)
        .neq("status", "cancelled")
        .eq("schedule_type", "working");

      if (error) throw error;

      // Agrupa schedules por identity_key + sector_id
      type RowAcc = {
        items: any[];
        sector_id: string;
      };
      const groups = new Map<string, RowAcc>();
      const scheduleCountByEmp = new Map<string, number>();

      (schedules || []).forEach((s: any) => {
        const emp = s.employee_id ? empById.get(s.employee_id) : null;
        const identity_key = emp?.identity_key || `SCHED:${s.id}`;
        const groupKey = `${identity_key}|${s.sector_id}`;
        scheduleCountByEmp.set(s.employee_id, (scheduleCountByEmp.get(s.employee_id) || 0) + 1);
        if (!groups.has(groupKey)) groups.set(groupKey, { items: [], sector_id: s.sector_id });
        groups.get(groupKey)!.items.push(s);
      });

      // Para cada grupo, escolhe linha exibida (confirmed > denied > pending; depois preenchido; depois mais recente)
      function pickPriority(items: any[]): any {
        const score = (s: any) => {
          let v = 0;
          if (s.confirmation_status === "confirmed") v += 100;
          else if (s.confirmation_status === "denied") v += 50;
          if (s.start_time && s.end_time) v += 10;
          return v;
        };
        return [...items].sort((a, b) => {
          const sd = score(b) - score(a);
          if (sd !== 0) return sd;
          return (b.created_at || "").localeCompare(a.created_at || "");
        })[0];
      }

      const result: D1Schedule[] = [];
      groups.forEach((g, groupKey) => {
        const chosen = pickPriority(g.items);
        const identity_key = groupKey.split("|")[0];
        const canonical = canonicalByKey.get(identity_key);
        const displayed = canonical || empById.get(chosen.employee_id);
        const allEmpIds = Array.from(new Set(g.items.map((i) => i.employee_id).filter(Boolean)));
        const duplicate_count = idToEmps.get(identity_key)?.length || allEmpIds.length;

        result.push({
          id: chosen.id,
          schedule_date: chosen.schedule_date,
          employee_id: chosen.employee_id,
          employee_name: displayed?.name || "—",
          employee_phone: displayed?.phone || null,
          job_title: displayed?.job_title || null,
          worker_type: displayed?.worker_type || "clt",
          sector_name: sectorMap.get(g.sector_id) || "—",
          sector_id: g.sector_id,
          start_time: chosen.start_time || chosen.shifts?.start_time || null,
          end_time: chosen.end_time || chosen.shifts?.end_time || null,
          schedule_type: chosen.schedule_type,
          confirmation_status: chosen.confirmation_status,
          denial_reason: chosen.denial_reason,
          duplicate_count,
          has_secullum_canonical: !!canonical?.secullum_id,
          merged_employee_ids: allEmpIds,
          identity_cpf: displayed?.identity_cpf || null,
          identity_key,
        });
      });

      // Lista de grupos duplicados da unidade (para o diálogo de fusão)
      const duplicateGroups: DuplicateGroup[] = [];
      idToEmps.forEach((emps, key) => {
        if (emps.length < 2) return;
        const canonical = emps.find((e) => e.secullum_id !== null);
        duplicateGroups.push({
          identity_key: key,
          identity_cpf: canonical?.identity_cpf || emps.find((e) => e.identity_cpf)?.identity_cpf || null,
          canonical: canonical
            ? { id: canonical.id, name: canonical.name, cpf: canonical.cpf, secullum_id: canonical.secullum_id }
            : undefined,
          members: emps.map((e) => ({
            id: e.id,
            name: e.name,
            cpf: e.cpf,
            secullum_id: e.secullum_id,
            schedule_count: scheduleCountByEmp.get(e.id) || 0,
            created_at: e.created_at,
          })),
        });
      });

      return { schedules: result, duplicateGroups };
    },
    enabled: !!unitId,
    refetchInterval: 30_000,
  });
}
