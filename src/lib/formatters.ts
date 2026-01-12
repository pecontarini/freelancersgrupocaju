// Format CPF: 000.000.000-00
export function formatCPF(value: string): string {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
}

// Format currency: R$ 0,00
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Parse currency input to number
export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// Format currency input as user types
export function formatCurrencyInput(value: string): string {
  const numbers = value.replace(/\D/g, "");
  const amount = parseInt(numbers, 10) / 100;
  
  if (isNaN(amount) || amount === 0) return "";
  
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

// Format date for display: DD/MM/YYYY (timezone-safe)
export function formatDate(date: string | Date): string {
  if (typeof date === "string") {
    // If it's a YYYY-MM-DD string, parse it without timezone conversion
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
  }
  // Fallback for Date objects - use UTC to avoid timezone shift
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Format a Date object to YYYY-MM-DD string using local date (timezone-safe for saving)
export function formatDateForDatabase(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Parse a YYYY-MM-DD string to a Date object without timezone shift
export function parseDateString(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  return new Date(dateStr);
}

// Validate CPF format
export function isValidCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, "");
  return numbers.length === 11;
}
