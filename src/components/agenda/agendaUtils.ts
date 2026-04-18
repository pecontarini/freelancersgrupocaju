export type AgendaCategoria = "reuniao" | "operacional" | "pessoal" | "outro";

export const CATEGORIA_INFO: Record<
  AgendaCategoria,
  { label: string; color: string; bg: string; border: string; text: string }
> = {
  reuniao: {
    label: "Reunião",
    color: "#3B82F6",
    bg: "bg-[#3B82F6]/15",
    border: "border-[#3B82F6]/40",
    text: "text-[#3B82F6]",
  },
  operacional: {
    label: "Operacional",
    color: "hsl(14, 70%, 48%)",
    bg: "bg-primary/15",
    border: "border-primary/40",
    text: "text-primary",
  },
  pessoal: {
    label: "Pessoal",
    color: "#22C55E",
    bg: "bg-[#22C55E]/15",
    border: "border-[#22C55E]/40",
    text: "text-[#22C55E]",
  },
  outro: {
    label: "Outro",
    color: "#6B7280",
    bg: "bg-[#6B7280]/15",
    border: "border-[#6B7280]/40",
    text: "text-[#6B7280]",
  },
};

export function combineDateTime(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0, 0, 0).toISOString();
}

export function splitDateTime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const dt = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}

export function formatDateTimeBR(iso: string): string {
  const dt = new Date(iso);
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const WEEK_DAYS_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
export const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
