/**
 * Deduplicação de funcionários no importador em massa de equipe.
 * Compara linhas extraídas do PDF/Excel/Imagem contra os funcionários
 * ativos da unidade (e contra o próprio arquivo).
 */
import { stringSimilarity, normalizeString } from "@/lib/fuzzyMatch";

export type DedupStatus =
  | "new" // não bate com ninguém — vai ser criado
  | "duplicate_db" // bate com alguém ativo da unidade (CPF ou nome+cargo)
  | "duplicate_file" // bate com outra linha mais acima do próprio arquivo
  | "possible"; // similaridade alta com alguém da unidade — precisa decisão

export type DedupDecision = "ignore" | "create" | "merge";

export interface ExistingEmployeeLite {
  id: string;
  name: string;
  cpf: string | null;
  job_title: string | null;
}

export interface ParsedRowLite {
  name: string;
  job_title: string;
  phone: string;
  cpf?: string | null;
}

export interface DedupResult {
  status: DedupStatus;
  /** Funcionário existente que bateu (db ou possível duplicado) */
  candidate: ExistingEmployeeLite | null;
  similarity: number;
  /** Decisão atual do usuário (default vem do status) */
  decision: DedupDecision;
}

const SIMILARITY_THRESHOLD = 0.85;

export function normalizeName(s: string): string {
  return normalizeString(s || "").toLowerCase();
}

export function normalizeCpf(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

function defaultDecision(status: DedupStatus): DedupDecision {
  switch (status) {
    case "new":
      return "create";
    case "duplicate_db":
    case "duplicate_file":
      return "ignore";
    case "possible":
      return "ignore"; // padrão seguro: usuário marca "Criar novo" se for xará legítimo
  }
}

/**
 * Classifica cada linha extraída em relação aos funcionários ativos da unidade.
 * Também detecta duplicidade dentro do próprio arquivo (mesma pessoa listada 2×).
 */
export function classifyImportRows(
  rows: ParsedRowLite[],
  existing: ExistingEmployeeLite[]
): DedupResult[] {
  // Pré-normaliza os existentes
  const norm = existing.map((e) => ({
    ref: e,
    name: normalizeName(e.name),
    job: normalizeName(e.job_title || ""),
    cpf: normalizeCpf(e.cpf),
  }));

  // Acompanha o que já apareceu no próprio arquivo
  const seenInFile = new Map<string, number>(); // chave normalizada → índice

  return rows.map((row, idx) => {
    const rowName = normalizeName(row.name);
    const rowJob = normalizeName(row.job_title);
    const rowCpf = normalizeCpf(row.cpf || "");

    // 1. Match por CPF (quando os dois lados têm)
    if (rowCpf.length >= 11) {
      const byCpf = norm.find((e) => e.cpf && e.cpf === rowCpf);
      if (byCpf) {
        return {
          status: "duplicate_db",
          candidate: byCpf.ref,
          similarity: 1,
          decision: defaultDecision("duplicate_db"),
        };
      }
    }

    // 2. Match exato por nome+cargo normalizados (cargo opcional se um lado vazio)
    const exact = norm.find(
      (e) =>
        e.name === rowName &&
        (e.job === rowJob || e.job === "" || rowJob === "")
    );
    if (exact) {
      return {
        status: "duplicate_db",
        candidate: exact.ref,
        similarity: 1,
        decision: defaultDecision("duplicate_db"),
      };
    }

    // 3. Duplicado dentro do próprio arquivo (mesmo nome normalizado já visto)
    if (rowName && seenInFile.has(rowName)) {
      return {
        status: "duplicate_file",
        candidate: null,
        similarity: 1,
        decision: defaultDecision("duplicate_file"),
      };
    }

    // 4. Similaridade alta com algum existente
    let bestSim = 0;
    let bestRef: ExistingEmployeeLite | null = null;
    for (const e of norm) {
      if (!e.name) continue;
      const sim = stringSimilarity(row.name, e.ref.name);
      if (sim > bestSim) {
        bestSim = sim;
        bestRef = e.ref;
      }
    }
    if (bestSim >= SIMILARITY_THRESHOLD && bestRef) {
      // registra no arquivo como visto também
      if (rowName) seenInFile.set(rowName, idx);
      return {
        status: "possible",
        candidate: bestRef,
        similarity: bestSim,
        decision: defaultDecision("possible"),
      };
    }

    // 5. Novo
    if (rowName) seenInFile.set(rowName, idx);
    return {
      status: "new",
      candidate: null,
      similarity: bestSim,
      decision: defaultDecision("new"),
    };
  });
}
