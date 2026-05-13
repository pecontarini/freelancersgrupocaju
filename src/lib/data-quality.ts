/**
 * Data Quality helpers
 * ────────────────────
 * Regra global do projeto:
 *   "Dia/registro sem dado preenchido = INEXISTENTE para fins
 *    de visualização e cálculo."
 *
 * Não mostrar como zero. Não incluir em médias.
 * Não renderizar ponto em gráfico. Não aparecer na tabela.
 */

const EXCEL_ERROR_TOKENS = new Set([
  "#DIV/0!",
  "#N/A",
  "#REF!",
  "#VALUE!",
  "#NAME?",
  "#NULL!",
  "#NUM!",
  "#ERROR!",
  "#GETTING_DATA",
]);

/**
 * Retorna true se o valor representa "ausência de dado".
 * Cobre: null, undefined, string vazia, erros de fórmula Excel/Sheets,
 * e strings não numéricas que não são interpretáveis.
 *
 * IMPORTANTE: 0 NÃO é considerado missing aqui — pode ser um zero
 * legítimo (ex: faturamento de dia fechado). Use `isMissingDay`
 * para avaliar o dia como um todo.
 */
export function isMissingValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "number") return !Number.isFinite(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return true;
    if (EXCEL_ERROR_TOKENS.has(s.toUpperCase())) return true;
    // tenta parse pt-BR ou en
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n)) {
      // string não numérica — só é missing se for um marcador conhecido
      return /^(—|-|n\/?a|sem dado|nd|null)$/i.test(s);
    }
    return false;
  }
  return false;
}

/**
 * Retorna true se TODAS as colunas relevantes do dia estão
 * vazias/missing/zero — sinal de que o dia ainda não foi preenchido
 * pela operação. Aceita uma lista opcional de chaves a inspecionar.
 */
export function isMissingDay(
  dayRow: Record<string, unknown>,
  keys?: string[],
): boolean {
  const cols = keys ?? Object.keys(dayRow).filter((k) => k !== "data" && k !== "loja_code" && k !== "loja_codigo");
  if (cols.length === 0) return true;
  for (const k of cols) {
    const v = dayRow[k];
    if (isMissingValue(v)) continue;
    if (typeof v === "number" && v === 0) continue;
    if (typeof v === "string" && v.trim() === "0") continue;
    return false;
  }
  return true;
}

/**
 * Filtra registros, removendo aqueles cujo dia está totalmente vazio
 * OU cuja data é futura sem dado.
 */
export function filterValidDays<T extends Record<string, unknown>>(
  rows: T[],
  options?: { keys?: string[]; today?: Date },
): T[] {
  const today = options?.today ?? new Date();
  const todayStr = today.toISOString().slice(0, 10);
  return rows.filter((row) => {
    const data = row["data"] ?? row["date"];
    // descarta dia futuro inteiramente
    if (typeof data === "string" && data > todayStr) return false;
    if (isMissingDay(row, options?.keys)) return false;
    return true;
  });
}

/**
 * Calcula a média ignorando valores missing. Retorna null se não
 * houver nenhum valor válido.
 */
export function calculateMeanIgnoringMissing(
  values: Array<number | null | undefined>,
): number | null {
  const valid = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Coerce a value to a finite number, or null if missing/invalid.
 */
export function toNumberOrNull(v: unknown): number | null {
  if (isMissingValue(v)) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.trim().replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
