/**
 * Utilities de mês baseadas em strings puras "YYYY-MM"
 * (sem Date object para evitar bugs de timezone).
 */

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthPt(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shortMonthLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const month = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${month.charAt(0).toUpperCase() + month.slice(1)}/${String(y).slice(2)}`;
}

export function monthRange(mes: string): { start: string; end: string } {
  const [y, m] = mes.split("-").map(Number);
  const start = `${mes}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${mes}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/** Lista os 6 últimos meses incluindo o atual ["YYYY-MM" * 6]. */
export function lastSixMonths(currentMes: string): string[] {
  return Array.from({ length: 6 }, (_, i) => shiftMonth(currentMes, -(5 - i)));
}

export function formatNumberPt(value: number | null, fractionDigits = 1): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatBRL(value: number | null | undefined, maximumFractionDigits = 0): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits,
  }).format(value);
}
