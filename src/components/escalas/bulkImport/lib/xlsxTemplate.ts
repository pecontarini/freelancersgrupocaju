import * as XLSX from "xlsx";
import { downloadWorkbook } from "@/lib/excelUtils";
import { addDaysLocal, toLocalISODate } from "./weekUtils";
import { normalizarHora } from "./timeUtils";

export type TemplateRow = {
  employee_id: string;
  nome: string;
  cpf_mascarado: string;
  cargo: string;
  setor_padrao: string;
};

export type ImportSlot = {
  employee_id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
};

export type ParsePreviewRow = {
  rowIndex: number; // 1-based row in the sheet (excludes header)
  employee_id: string;
  nome: string;
  diasPreenchidos: number;
};

export type ParseResult = {
  slots: ImportSlot[];
  previewRows: ParsePreviewRow[];
  parseErrors: { rowIndex: number; motivo: string }[];
  totalRows: number;
};

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export function buildTemplateWorkbook(
  data: TemplateRow[],
  weekStart: Date,
  unidadeNome: string,
): { workbook: XLSX.WorkBook; fileName: string } {
  const headerEscala = [
    "ID Funcionário",
    "Nome",
    "CPF",
    "Cargo",
    "Setor",
    ...DIAS.flatMap((d) => [`${d} Início`, `${d} Fim`]),
  ];

  const rowsEscala = data.map((emp) => [
    emp.employee_id,
    emp.nome,
    emp.cpf_mascarado,
    emp.cargo,
    emp.setor_padrao,
    ...Array(14).fill(""),
  ]);

  const wsEscala = XLSX.utils.aoa_to_sheet([headerEscala, ...rowsEscala]);
  wsEscala["!cols"] = [
    { hidden: true, wch: 0 },
    { wch: 30 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    ...Array(14).fill({ wch: 10 }),
  ];

  const instrucoes = [
    ["INSTRUÇÕES DE PREENCHIMENTO"],
    [""],
    ["1. Preencha apenas as colunas de horário (Início e Fim de cada dia)."],
    ["2. Use o formato HH:MM em 24 horas. Exemplo: 09:00 e 17:00."],
    ["3. Para folgas, deixe as duas células do dia em branco."],
    ["4. NÃO altere as colunas Nome, CPF, Cargo ou Setor — elas servem para conferência."],
    ["5. Funcionário ausente da planilha precisa ser cadastrado primeiro no Secullum pelo DP."],
    ['6. Após preencher, salve e use o botão "Importar Escala Preenchida" no Painel.'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
  wsInstr["!cols"] = [{ wch: 100 }];

  const cargosUnicos = [...new Set(data.map((e) => e.cargo).filter(Boolean))].sort();
  const wsCargos = XLSX.utils.aoa_to_sheet([
    ["CARGOS VÁLIDOS NESTA UNIDADE"],
    [""],
    ...cargosUnicos.map((c) => [c]),
  ]);
  wsCargos["!cols"] = [{ wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsEscala, "Escala");
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");
  XLSX.utils.book_append_sheet(wb, wsCargos, "Cargos válidos");

  const semanaStr = toLocalISODate(weekStart);
  const unidadeSafe = unidadeNome.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `Escala_${unidadeSafe}_${semanaStr}.xlsx`;
  return { workbook: wb, fileName };
}

export function downloadTemplateWorkbook(
  data: TemplateRow[],
  weekStart: Date,
  unidadeNome: string,
): string {
  const { workbook, fileName } = buildTemplateWorkbook(data, weekStart, unidadeNome);
  downloadWorkbook(workbook, fileName);
  return fileName;
}

export async function parseFilledWorkbook(file: File, weekStart: Date): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const wsEscala = wb.Sheets["Escala"];
  if (!wsEscala) {
    throw new Error('Aba "Escala" não encontrada no arquivo');
  }

  const rows = XLSX.utils.sheet_to_json<any[]>(wsEscala, { header: 1, blankrows: false });
  const dataRows = rows.slice(1);

  const slots: ImportSlot[] = [];
  const previewRows: ParsePreviewRow[] = [];
  const parseErrors: { rowIndex: number; motivo: string }[] = [];

  dataRows.forEach((row, idx) => {
    const rowIndex = idx + 2; // header is row 1
    const employeeId = row?.[0];
    const nome = row?.[1] ?? "";
    if (!employeeId) return;

    let diasPreenchidos = 0;

    for (let diaIdx = 0; diaIdx < 7; diaIdx++) {
      const colInicio = 5 + diaIdx * 2;
      const colFim = colInicio + 1;
      const inicio = row?.[colInicio];
      const fim = row?.[colFim];
      const hasInicio = inicio !== undefined && inicio !== null && inicio !== "";
      const hasFim = fim !== undefined && fim !== null && fim !== "";

      if (!hasInicio && !hasFim) continue;
      if (hasInicio !== hasFim) {
        parseErrors.push({
          rowIndex,
          motivo: `${nome || employeeId}: ${DIAS[diaIdx]} com apenas um horário preenchido`,
        });
        continue;
      }

      try {
        const start_time = normalizarHora(inicio);
        const end_time = normalizarHora(fim);
        const data = addDaysLocal(weekStart, diaIdx);
        slots.push({
          employee_id: String(employeeId),
          schedule_date: toLocalISODate(data),
          start_time,
          end_time,
        });
        diasPreenchidos++;
      } catch (e: any) {
        parseErrors.push({
          rowIndex,
          motivo: `${nome || employeeId} (${DIAS[diaIdx]}): ${e.message}`,
        });
      }
    }

    if (diasPreenchidos > 0) {
      previewRows.push({
        rowIndex,
        employee_id: String(employeeId),
        nome: String(nome),
        diasPreenchidos,
      });
    }
  });

  return { slots, previewRows, parseErrors, totalRows: dataRows.length };
}
