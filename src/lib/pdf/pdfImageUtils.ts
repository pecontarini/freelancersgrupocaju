import jsPDF from "jspdf";

export async function addImageFromUrl(
  doc: jsPDF,
  url: string,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<boolean> {
  // Attempt multiple formats; jsPDF may throw if mismatched.
  const formats: Array<"JPEG" | "PNG" | "WEBP"> = ["JPEG", "PNG", "WEBP"];

  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  }).catch(() => null);

  if (!img.complete || img.naturalWidth === 0) return false;

  for (const fmt of formats) {
    try {
      doc.addImage(img, fmt, x, y, w, h);
      return true;
    } catch {
      // try next format
    }
  }

  return false;
}

export function drawNoEvidencePlaceholder(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("SEM", x + w / 2, y + h / 2 - 2, { align: "center" });
  doc.text("EVIDÊNCIA", x + w / 2, y + h / 2 + 4, { align: "center" });
}
