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

// Format date for display: DD/MM/YYYY
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

// Validate CPF format
export function isValidCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, "");
  return numbers.length === 11;
}
