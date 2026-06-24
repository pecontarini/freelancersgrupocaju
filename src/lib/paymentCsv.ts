import { supabase } from "@/integrations/supabase/client";
import { FreelancerEntry } from "@/types/freelancer";

// ============================================================
// Helpers
// ============================================================

const stripAccents = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const onlyDigits = (s: string): string => (s || "").replace(/\D/g, "");

export const formatCpfMask = (cpf: string): string => {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

export const formatCnpjMask = (cnpj: string): string => {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

// 100 -> "100"; 123.4 -> "123,4"; 123.45 -> "123,45"; 1500 -> "1500"
export const formatBrlPlain = (n: number): string => {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(".", ",");
};

// "YYYY-MM-DD" -> "DD/MM/YYYY" (puro string, sem timezone)
export const ymdToBr = (ymd: string): string => {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
};

// "YYYY-MM-DD" -> "DD/MM"
export const ymdToBrShort = (ymd: string): string => {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
};

// ============================================================
// Windows-1252 encoder
// Mapeia codepoints fora de Latin-1 (0x80-0x9F window) e
// fallback "?" para tudo que não couber.
// ============================================================

const WIN1252_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

export const toLatin1Bytes = (str: string): Uint8Array => {
  const out: number[] = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0xff) {
      out.push(cp);
    } else if (cp in WIN1252_EXTRA) {
      out.push(WIN1252_EXTRA[cp]);
    } else {
      out.push(0x3f); // "?"
    }
  }
  return new Uint8Array(out);
};

// ============================================================
// Tipos
// ============================================================

export interface PaymentCsvBuildParams {
  entries: FreelancerEntry[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  cnpjEmpresa: string; // CNPJ da unidade
}

export interface PaymentCsvResult {
  bytes: Uint8Array;
  rowsCount: number;
  skippedCpfs: string[];
}

// Header byte-a-byte igual ao template do ERP
const HEADER =
  "CNPJ Empresa;Série Título;Nº Título;Nº Parcela;Nº Documento;CNPJ Fornecedor;Portador;Data Documento;Data Vencimento;Data Competência;Valor Desconto;Valor Multa Atraso;Valor Juros Dia; Valor Original ;Observações do Título;Cód Conta Gerencial;Cód Centro de Custo;Evento;RFP";

const EOL = "\r\n";

// ============================================================
// Build
// ============================================================

export const buildPaymentCsv = (
  params: PaymentCsvBuildParams,
): PaymentCsvResult => {
  const { entries, startDate, endDate, cnpjEmpresa } = params;

  const cnpjFormatted = formatCnpjMask(cnpjEmpresa);
  const dataDoc = ymdToBr(startDate);
  const today = new Date();
  const dataHoje = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  const periodLabel = `${ymdToBrShort(startDate)} A ${ymdToBrShort(endDate)}`;

  // Agrupa por CPF
  const groups = new Map<
    string,
    { nome: string; total: number; dias: Set<string>; cpfRaw: string }
  >();
  const skipped: string[] = [];

  for (const e of entries) {
    const cpfDigits = onlyDigits(e.cpf);
    if (cpfDigits.length !== 11) {
      skipped.push(e.cpf || e.nome_completo);
      continue;
    }
    const g = groups.get(cpfDigits) ?? {
      nome: e.nome_completo,
      total: 0,
      dias: new Set<string>(),
      cpfRaw: cpfDigits,
    };
    g.total += Number(e.valor) || 0;
    g.dias.add(e.data_pop);
    groups.set(cpfDigits, g);
  }

  const sorted = [...groups.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );

  const lines: string[] = [HEADER];

  for (const g of sorted) {
    const nomeUpper = stripAccents(g.nome).toUpperCase().trim();
    const obs = `FREELANCER ${nomeUpper} - ${g.dias.size} DIA(S) ${periodLabel}`;
    const row = [
      cnpjFormatted, // CNPJ Empresa
      "", // Série Título
      "", // Nº Título
      "1", // Nº Parcela
      "", // Nº Documento
      formatCpfMask(g.cpfRaw), // CNPJ Fornecedor (CPF do freelancer)
      "2", // Portador
      dataDoc, // Data Documento
      dataHoje, // Data Vencimento (data de geração do CSV)
      dataDoc, // Data Competência
      "0", // Valor Desconto
      "0", // Valor Multa Atraso
      "0", // Valor Juros Dia
      formatBrlPlain(g.total), // Valor Original
      obs, // Observações
      "272", // Cód Conta Gerencial
      "3", // Cód Centro de Custo
      "", // Evento
      "", // RFP
    ].join(";");
    lines.push(row);
  }

  const text = lines.join(EOL) + EOL;
  return {
    bytes: toLatin1Bytes(text),
    rowsCount: sorted.length,
    skippedCpfs: skipped,
  };
};

// ============================================================
// Lookup CNPJ
// ============================================================

export const fetchUnitCnpj = async (
  lojaId: string,
): Promise<{ cnpj: string | null; nome: string | null }> => {
  const { data, error } = await supabase
    .from("config_lojas")
    .select("cnpj, nome")
    .eq("id", lojaId)
    .maybeSingle();
  if (error) throw error;
  return { cnpj: data?.cnpj ?? null, nome: data?.nome ?? null };
};

// ============================================================
// Download
// ============================================================

export const downloadCsvBytes = (bytes: Uint8Array, filename: string): void => {
  // Cast: Blob aceita BufferSource, mas a tipagem do TS varia entre runtimes.
  const blob = new Blob([bytes as BlobPart], {
    type: "text/csv;charset=windows-1252",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const sanitizeUnitName = (s: string): string =>
  stripAccents(s)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toUpperCase();

export const ymdCompact = (ymd: string): string => ymd.replace(/-/g, "");
