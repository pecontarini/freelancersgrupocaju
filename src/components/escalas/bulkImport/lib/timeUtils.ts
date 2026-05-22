/**
 * Normalizes an Excel cell value into "HH:MM:SS".
 * Accepts:
 *  - number (Excel time fraction of a day, 0.5 = 12:00)
 *  - string "HH:MM", "H:MM" or "HH:MM:SS"
 * Throws on invalid input.
 */
export function normalizarHora(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") {
    throw new Error("Hora vazia");
  }

  if (typeof valor === "number") {
    const totalMin = Math.round(valor * 24 * 60);
    if (totalMin < 0 || totalMin > 24 * 60) {
      throw new Error(`Hora numérica fora do intervalo: ${valor}`);
    }
    const h = Math.floor(totalMin / 60)
      .toString()
      .padStart(2, "0");
    const m = (totalMin % 60).toString().padStart(2, "0");
    return `${h}:${m}:00`;
  }

  const str = String(valor).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error(`Hora inválida: ${str}`);
  }
  const hh = match[1].padStart(2, "0");
  const mm = match[2];
  const ss = match[3] ?? "00";
  return `${hh}:${mm}:${ss}`;
}
