import jsPDF from "jspdf";
import { PDF_COLORS } from "@/lib/pdf/grupoCajuPdfTheme";

/**
 * CAJUPAR - PDF IMAGE UTILITIES
 * 
 * Professional image handling for audit reports.
 * - No placeholder text when images fail to load
 * - Clean borders for loaded images
 * - Proper error handling
 */

/**
 * Attempt to add an image from URL to PDF
 * Returns true if successful, false otherwise
 */
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

      // Try each format
      for (const fmt of formats) {
        try {
          doc.addImage(img, fmt, x, y, w, h);
          resolve(true);
          return;
        } catch {
          // Try next format
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

/**
 * Draw a subtle placeholder when no image exists
 * Only used internally - not exported to prevent "Sem Imagem" text
 */
export function drawImagePlaceholder(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  // Simple dashed border placeholder without text
  doc.setFillColor(...PDF_COLORS.gray50);
  doc.setDrawColor(...PDF_COLORS.gray300);
  doc.setLineWidth(0.3);
  
  try {
    (doc as any).setLineDashPattern([2, 2], 0);
  } catch {
    // Solid fallback
  }
  
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  
  try {
    (doc as any).setLineDashPattern([], 0);
  } catch {
    // Ignore
  }
  
  // Camera icon (subtle)
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  
  // Small circle to suggest image/camera
  doc.setFillColor(...PDF_COLORS.gray300);
  doc.circle(centerX, centerY - 2, 5, "F");
  
  // Lens detail
  doc.setFillColor(...PDF_COLORS.gray50);
  doc.circle(centerX, centerY - 2, 2.5, "F");
}
