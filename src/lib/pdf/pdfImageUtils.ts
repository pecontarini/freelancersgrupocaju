import jsPDF from "jspdf";
import { PDF_BRAND } from "@/lib/pdf/grupoCajuPdfTheme";

export async function addImageFromUrl(
  doc: jsPDF,
  url: string,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<boolean> {
  const formats: Array<"JPEG" | "PNG" | "WEBP"> = ["JPEG", "PNG", "WEBP"];

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      if (img.naturalWidth === 0) {
        resolve(false);
        return;
      }

      for (const fmt of formats) {
        try {
          doc.addImage(img, fmt, x, y, w, h);
          resolve(true);
          return;
        } catch {
          // try next format
        }
      }
      resolve(false);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    img.src = url;
  });
}

export function drawNoEvidencePlaceholder(doc: jsPDF, x: number, y: number, w: number, h: number) {
  // Dashed border placeholder
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");

  // Camera icon simulation (simplified)
  const centerX = x + w / 2;
  const centerY = y + h / 2;

  // Icon circle
  doc.setFillColor(...PDF_BRAND.border);
  doc.circle(centerX, centerY - 2, 8, "F");

  // Text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text("SEM", centerX, centerY + 8, { align: "center" });
  doc.text("EVIDÊNCIA", centerX, centerY + 12, { align: "center" });
}
