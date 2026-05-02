import Papa from "papaparse";

export type RankRow = { posicao: number; unidade: string; media: number };
export type RankingSet = { titulo: string; rows: RankRow[] };
export type FatRow = {
  loja: string;
  av13: number;
  totalAv: number;
  pctAv13: number;
  faturamento: number;
  rPorAv: number;
};

// ---------- helpers ----------
function parseRows(raw: string): string[][] {
  const parsed = Papa.parse<string[]>(raw, {
    header: false,
    skipEmptyLines: false,
  });
  return (parsed.data as string[][]).map((r) =>
    Array.isArray(r) ? r.map((c) => (c ?? "").toString()) : []
  );
}

function toNumberBR(value: string | undefined | null): number {
  if (value == null) return NaN;
  let s = String(value).trim();
  if (!s) return NaN;
  s = s.replace(/R\$/gi, "").replace(/%/g, "").replace(/\s/g, "");
  // remove thousand separators (.) keep decimal comma -> dot
  // Heuristic: if contains both '.' and ',', '.' is thousands, ',' is decimal
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function toPosicao(value: string | undefined | null): number {
  if (!value) return NaN;
  const s = String(value).replace(/[°º]/g, "").trim();
  const n = parseInt(s, 10);
  return isNaN(n) ? NaN : n;
}

function rowText(row: string[]): string {
  return row.join(" ").toUpperCase();
}

// ---------- 1. parseChecklistCSV ----------
export function parseChecklistCSV(raw: string): RankingSet[] {
  const rows = parseRows(raw);
  const sets: RankingSet[] = [];
  let current: RankingSet | null = null;

  for (const row of rows) {
    const text = rowText(row);
    const nonEmpty = row.filter((c) => c && c.trim() !== "");

    if (text.includes("RANKING CHECKLIST SUPERVISORES")) {
      // header row -> start new block
      const titulo =
        nonEmpty.find((c) => c.toUpperCase().includes("RANKING")) ??
        nonEmpty[0] ??
        "RANKING CHECKLIST SUPERVISORES";
      current = { titulo: titulo.trim(), rows: [] };
      sets.push(current);
      continue;
    }

    if (!current) continue;
    if (nonEmpty.length === 0) continue;
    if (text.includes("PERIODO") || text.includes("PERÍODO")) continue;
    if (text.includes("POSICAO") || text.includes("POSIÇÃO")) continue;

    // try to find posicao / unidade / media within the row (skip empty leading cells)
    const cells = nonEmpty;
    if (cells.length < 3) continue;

    const posicao = toPosicao(cells[0]);
    const unidade = (cells[1] ?? "").trim();
    const media = toNumberBR(cells[2]);

    if (isNaN(posicao) || !unidade || isNaN(media)) continue;

    current.rows.push({ posicao, unidade, media });
  }

  return sets;
}

// ---------- 2. parseNpsCSV ----------
export function parseNpsCSV(raw: string): { loja: string; media: number }[] {
  const rows = parseRows(raw);
  const out: { loja: string; media: number }[] = [];

  let lojaIdx = -1;
  let valorIdx = -1;
  let headerFound = false;

  for (const row of rows) {
    const nonEmpty = row.filter((c) => c && c.trim() !== "");
    if (nonEmpty.length === 0) continue;

    if (!headerFound) {
      const upper = row.map((c) => (c ?? "").toString().trim().toUpperCase());
      const li = upper.findIndex((c) => c === "LOJA");
      if (li !== -1) {
        lojaIdx = li;
        // pick first numeric-looking column after LOJA
        valorIdx = -1;
        for (let i = li + 1; i < row.length; i++) {
          // we'll resolve valorIdx on first data row
        }
        headerFound = true;
        continue;
      }
      continue;
    }

    const loja = (row[lojaIdx] ?? "").toString().trim();
    if (!loja) continue;
    if (loja.toUpperCase().includes("LOJA")) continue;

    // find first numeric value after lojaIdx
    let media = NaN;
    if (valorIdx === -1) {
      for (let i = lojaIdx + 1; i < row.length; i++) {
        const n = toNumberBR(row[i]);
        if (!isNaN(n)) {
          valorIdx = i;
          media = n;
          break;
        }
      }
    } else {
      media = toNumberBR(row[valorIdx]);
    }

    if (isNaN(media)) continue;
    out.push({ loja, media });
  }

  return out.sort((a, b) => b.media - a.media);
}

// ---------- 3. parseFaturamentoCSV ----------
export function parseFaturamentoCSV(
  raw: string
): { salao: FatRow[]; delivery: FatRow[] } {
  const rows = parseRows(raw);
  const salao: FatRow[] = [];
  const delivery: FatRow[] = [];
  let bucket: "salao" | "delivery" | null = null;

  for (const row of rows) {
    const text = rowText(row);
    const nonEmpty = row.filter((c) => c && c.trim() !== "");
    if (nonEmpty.length === 0) continue;

    if (text.includes("SALÃO") || text.includes("SALAO")) {
      bucket = "salao";
      continue;
    }
    if (text.includes("DELIVERY")) {
      bucket = "delivery";
      continue;
    }
    if (text.includes("LOJA") && text.includes("AVALIA")) {
      // header row
      continue;
    }
    if (!bucket) continue;
    if (nonEmpty.length < 6) continue;

    const cells = nonEmpty;
    const loja = (cells[0] ?? "").trim();
    const av13 = toNumberBR(cells[1]);
    const totalAv = toNumberBR(cells[2]);
    const pctAv13 = toNumberBR(cells[3]);
    const faturamento = toNumberBR(cells[4]);
    const rPorAv = toNumberBR(cells[5]);

    if (!loja || isNaN(totalAv)) continue;

    const fat: FatRow = { loja, av13, totalAv, pctAv13, faturamento, rPorAv };
    if (bucket === "salao") salao.push(fat);
    else delivery.push(fat);
  }

  return { salao, delivery };
}

// ---------- 4. parseBaseAvaliacoesCSV ----------
export function parseBaseAvaliacoesCSV(
  raw: string
): { nota: number; total: number; pct: number }[] {
  const rows = parseRows(raw);
  const out: { nota: number; total: number; pct: number }[] = [];
  let inBlock = false;

  for (const row of rows) {
    const text = rowText(row);
    const nonEmpty = row.filter((c) => c && c.trim() !== "");

    if (text.includes("GERAL GRUPO")) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    if (nonEmpty.length === 0) continue;
    if (text.includes("NOTA") && text.includes("TOTAL")) continue;

    const cells = nonEmpty;
    if (cells.length < 3) continue;

    const nota = toNumberBR(cells[0]);
    const total = toNumberBR(cells[1]);
    const pct = toNumberBR(cells[2]);

    if (isNaN(nota) || nota < 1 || nota > 5) {
      // stop if we leave the numeric block after collecting items
      if (out.length > 0) break;
      continue;
    }
    if (isNaN(total)) continue;

    out.push({ nota, total, pct: isNaN(pct) ? 0 : pct });
    if (out.length >= 5) break;
  }

  return out.sort((a, b) => b.nota - a.nota);
}
