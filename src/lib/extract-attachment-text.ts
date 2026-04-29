// Helpers para extrair conteúdo de anexos do chat IA (PDF, texto, imagem).
// PDF: usa pdfjs-dist via dynamic import (não pesa no bundle inicial).
// Imagens: convertidas em data URL base64 para envio multimodal.
// Textos: lidos como string.

export type AttachmentKind = "text" | "image";

export interface ExtractedAttachment {
  name: string;
  mime: string;
  size: number;
  kind: AttachmentKind;
  /** Texto extraído (PDF/TXT/MD). Vazio para imagens. */
  text: string;
  /** data: URL base64 para imagens. Vazio para textos. */
  dataUrl: string;
  /** True se o texto extraído foi truncado por exceder o limite. */
  truncated: boolean;
}

const MAX_TEXT_CHARS = 50_000;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES = 3;

const TEXT_EXT = /\.(txt|md|csv|log|json)$/i;
const EXCEL_EXT = /\.(xlsx|xls|xlsm)$/i;
const EXCEL_MIME = /(spreadsheetml|ms-excel)/i;

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

function isPlainText(file: File): boolean {
  return file.type.startsWith("text/") || TEXT_EXT.test(file.name);
}

function isExcel(file: File): boolean {
  return EXCEL_EXT.test(file.name) || EXCEL_MIME.test(file.type);
}

async function extractExcelText(file: File): Promise<string> {
  const XLSX: any = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
    parts.push(`--- Aba: ${name} ---\n${csv}`);
    if (parts.join("\n\n").length > MAX_TEXT_CHARS) break;
  }
  return parts.join("\n\n");
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error ?? new Error("Falha ao ler arquivo"));
    r.readAsDataURL(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  // Dynamic import para não inflar o bundle inicial.
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  // Worker via CDN (mesma versão da lib instalada).
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const pageText = tc.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    parts.push(`--- Página ${i} ---\n${pageText}`);
    if (parts.join("\n\n").length > MAX_TEXT_CHARS) break;
  }
  return parts.join("\n\n");
}

export async function extractAttachment(file: File): Promise<ExtractedAttachment> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `${file.name} tem ${(file.size / 1024 / 1024).toFixed(1)} MB — limite é ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
    );
  }

  if (isImage(file)) {
    const dataUrl = await fileToDataUrl(file);
    return {
      name: file.name,
      mime: file.type || "image/*",
      size: file.size,
      kind: "image",
      text: "",
      dataUrl,
      truncated: false,
    };
  }

  if (isPdf(file)) {
    const raw = await extractPdfText(file);
    const truncated = raw.length > MAX_TEXT_CHARS;
    return {
      name: file.name,
      mime: "application/pdf",
      size: file.size,
      kind: "text",
      text: truncated ? raw.slice(0, MAX_TEXT_CHARS) + "\n\n[...conteúdo truncado]" : raw,
      dataUrl: "",
      truncated,
    };
  }

  if (isPlainText(file)) {
    const raw = await file.text();
    const truncated = raw.length > MAX_TEXT_CHARS;
    return {
      name: file.name,
      mime: file.type || "text/plain",
      size: file.size,
      kind: "text",
      text: truncated ? raw.slice(0, MAX_TEXT_CHARS) + "\n\n[...conteúdo truncado]" : raw,
      dataUrl: "",
      truncated,
    };
  }

  throw new Error(`Tipo não suportado: ${file.name}. Use PDF, imagem ou texto.`);
}
