import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ExtractedInvoiceData {
  cnpj?: string | null;
  fornecedor?: string | null;
  numero_nf?: string | null;
  data_servico?: string | null;
  valor?: string | null;
  chave_pix?: string | null;
  confidence: "high" | "medium" | "low";
}

export function useInvoiceExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedInvoiceData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const extractFromFile = async (file: File): Promise<ExtractedInvoiceData | null> => {
    setIsExtracting(true);
    setExtractionError(null);
    setExtractedData(null);

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.functions.invoke("extract-invoice-data", {
        body: {
          imageBase64: base64,
          mimeType: file.type,
        },
      });

      if (error) {
        throw new Error(error.message || "Erro ao extrair dados");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setExtractedData(data);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao processar documento";
      setExtractionError(message);
      return null;
    } finally {
      setIsExtracting(false);
    }
  };

  const clearExtractedData = () => {
    setExtractedData(null);
    setExtractionError(null);
  };

  return {
    isExtracting,
    extractedData,
    extractionError,
    extractFromFile,
    clearExtractedData,
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}
