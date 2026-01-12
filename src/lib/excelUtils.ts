import * as XLSX from "xlsx";
import { FreelancerEntry } from "@/types/freelancer";
import { format, parse } from "date-fns";

export interface ImportRow {
  Loja: string;
  "Nome Completo": string;
  Funcao: string;
  Gerencia: string;
  Data: string;
  Valor: number | string;
  CPF: string;
  "Chave Pix": string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedEntry {
  loja: string;
  nome_completo: string;
  funcao: string;
  gerencia: string;
  data_pop: string;
  valor: number;
  cpf: string;
  chave_pix: string;
}

const REQUIRED_COLUMNS = [
  "Loja",
  "Nome Completo",
  "Funcao",
  "Gerencia",
  "Data",
  "Valor",
  "CPF",
  "Chave Pix",
];

// Format CPF with mask
function formatCPF(cpf: string): string {
  const cleanCPF = cpf.replace(/\D/g, "");
  if (cleanCPF.length !== 11) return cpf;
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// Format date string YYYY-MM-DD to DD/MM/YYYY (timezone-safe)
function formatDateFromString(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

// Parse Brazilian date format DD/MM/YYYY
function parseDate(dateStr: string): string | null {
  // Handle Excel serial date number
  if (typeof dateStr === "number" || !isNaN(Number(dateStr))) {
    const excelDate = XLSX.SSF.parse_date_code(Number(dateStr));
    if (excelDate) {
      const date = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
      return format(date, "yyyy-MM-dd");
    }
  }

  // Handle string date
  const cleanDate = String(dateStr).trim();
  
  // Try DD/MM/YYYY format
  const brMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd");
    }
  }

  // Try YYYY-MM-DD format
  const isoMatch = cleanDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd");
    }
  }

  return null;
}

// Parse currency value (handles Brazilian format)
function parseValue(value: string | number): number | null {
  if (typeof value === "number") {
    return value;
  }

  // Remove R$, spaces, and handle Brazilian format
  const cleanValue = String(value)
    .replace(/R\$\s*/gi, "")
    .replace(/\s/g, "")
    .trim();

  // Check if it's Brazilian format (1.234,56)
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(cleanValue)) {
    const normalized = cleanValue.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }

  // Try standard format
  const normalized = cleanValue.replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
}

export function validateAndParseFile(
  file: File
): Promise<{ entries: ParsedEntry[]; errors: ValidationError[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<ImportRow>(firstSheet, {
          defval: "",
        });

        if (jsonData.length === 0) {
          reject(new Error("O arquivo está vazio ou não contém dados válidos."));
          return;
        }

        // Check required columns
        const firstRow = jsonData[0];
        const missingColumns = REQUIRED_COLUMNS.filter(
          (col) => !(col in firstRow)
        );
        if (missingColumns.length > 0) {
          reject(
            new Error(
              `Colunas obrigatórias não encontradas: ${missingColumns.join(", ")}`
            )
          );
          return;
        }

        const entries: ParsedEntry[] = [];
        const errors: ValidationError[] = [];

        jsonData.forEach((row, index) => {
          const rowNum = index + 2; // +2 because Excel is 1-indexed and has header

          // Validate required fields
          if (!row.Loja?.toString().trim()) {
            errors.push({ row: rowNum, field: "Loja", message: "Campo obrigatório" });
          }
          if (!row["Nome Completo"]?.toString().trim()) {
            errors.push({ row: rowNum, field: "Nome Completo", message: "Campo obrigatório" });
          }
          if (!row.Funcao?.toString().trim()) {
            errors.push({ row: rowNum, field: "Funcao", message: "Campo obrigatório" });
          }
          if (!row.Gerencia?.toString().trim()) {
            errors.push({ row: rowNum, field: "Gerencia", message: "Campo obrigatório" });
          }
          if (!row.CPF?.toString().trim()) {
            errors.push({ row: rowNum, field: "CPF", message: "Campo obrigatório" });
          }
          if (!row["Chave Pix"]?.toString().trim()) {
            errors.push({ row: rowNum, field: "Chave Pix", message: "Campo obrigatório" });
          }

          // Validate and parse date
          const parsedDate = parseDate(row.Data);
          if (!parsedDate) {
            errors.push({
              row: rowNum,
              field: "Data",
              message: "Formato inválido. Use DD/MM/AAAA",
            });
          }

          // Validate and parse value
          const parsedValue = parseValue(row.Valor);
          if (parsedValue === null || parsedValue <= 0) {
            errors.push({
              row: rowNum,
              field: "Valor",
              message: "Valor deve ser um número positivo",
            });
          }

          // Validate CPF format (11 digits)
          const cleanCPF = row.CPF?.toString().replace(/\D/g, "");
          if (cleanCPF && cleanCPF.length !== 11) {
            errors.push({
              row: rowNum,
              field: "CPF",
              message: "CPF deve ter 11 dígitos",
            });
          }

          // If no errors for this row, add to entries
          const rowErrors = errors.filter((e) => e.row === rowNum);
          if (rowErrors.length === 0 && parsedDate && parsedValue) {
            entries.push({
              loja: row.Loja.toString().trim(),
              nome_completo: row["Nome Completo"].toString().trim(),
              funcao: row.Funcao.toString().trim(),
              gerencia: row.Gerencia.toString().trim(),
              data_pop: parsedDate,
              valor: parsedValue,
              cpf: formatCPF(row.CPF.toString().trim()),
              chave_pix: row["Chave Pix"].toString().trim(),
            });
          }
        });

        resolve({ entries, errors });
      } catch (error) {
        reject(new Error("Erro ao processar o arquivo. Verifique se é um Excel válido."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Erro ao ler o arquivo."));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function generateTemplate(): void {
  const templateData = [
    {
      Loja: "Loja Exemplo",
      "Nome Completo": "João da Silva",
      Funcao: "Garçom",
      Gerencia: "FRONT",
      Data: "15/01/2025",
      Valor: 1500.00,
      CPF: "123.456.789-00",
      "Chave Pix": "email@exemplo.com",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  
  // Set column widths
  worksheet["!cols"] = [
    { wch: 15 }, // Loja
    { wch: 25 }, // Nome Completo
    { wch: 15 }, // Funcao
    { wch: 15 }, // Gerencia
    { wch: 12 }, // Data
    { wch: 12 }, // Valor
    { wch: 15 }, // CPF
    { wch: 25 }, // Chave Pix
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
  
  XLSX.writeFile(workbook, "modelo_importacao.xlsx");
}

export function exportToExcel(entries: FreelancerEntry[], filename: string): void {
  // Prepare data with formatted columns - using timezone-safe date formatting
  const exportData = entries.map((entry) => ({
    Data: formatDateFromString(entry.data_pop),
    Loja: entry.loja,
    "Nome Completo": entry.nome_completo,
    Função: entry.funcao,
    Gerência: entry.gerencia,
    CPF: entry.cpf,
    "Chave PIX": entry.chave_pix,
    Valor: entry.valor,
  }));

  // Calculate total
  const totalValue = entries.reduce((sum, e) => sum + e.valor, 0);

  // Add total row
  exportData.push({
    Data: "",
    Loja: "",
    "Nome Completo": "",
    Função: "",
    Gerência: "",
    CPF: "",
    "Chave PIX": "TOTAL GERAL:",
    Valor: totalValue,
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 12 }, // Data
    { wch: 18 }, // Loja
    { wch: 28 }, // Nome Completo
    { wch: 15 }, // Função
    { wch: 15 }, // Gerência
    { wch: 15 }, // CPF
    { wch: 28 }, // Chave PIX
    { wch: 14 }, // Valor
  ];

  // Apply header styling (bold + background color)
  const headerCells = ["A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"];
  headerCells.forEach((cell) => {
    if (worksheet[cell]) {
      worksheet[cell].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } },
        alignment: { horizontal: "center" },
      };
    }
  });

  // Format currency column (Valor - column H)
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  for (let row = 1; row <= range.e.r; row++) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: 7 }); // Column H (Valor)
    if (worksheet[cellRef] && typeof worksheet[cellRef].v === "number") {
      worksheet[cellRef].z = '"R$"#,##0.00';
    }
  }

  // Style total row (last row)
  const lastRow = range.e.r;
  const totalLabelCell = XLSX.utils.encode_cell({ r: lastRow, c: 6 }); // Column G
  const totalValueCell = XLSX.utils.encode_cell({ r: lastRow, c: 7 }); // Column H
  
  if (worksheet[totalLabelCell]) {
    worksheet[totalLabelCell].s = {
      font: { bold: true },
      alignment: { horizontal: "right" },
    };
  }
  if (worksheet[totalValueCell]) {
    worksheet[totalValueCell].s = {
      font: { bold: true },
    };
    worksheet[totalValueCell].z = '"R$"#,##0.00';
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
