import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ExtractedSalesItem {
  nome: string;
  quantidade: number;
  unidade?: string;
}

export interface ExtractedSalesData {
  data_referencia?: string | null;
  items: ExtractedSalesItem[];
  confidence: "high" | "medium" | "low";
}

export function useSalesExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedSalesData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const extractFromFile = async (file: File): Promise<ExtractedSalesData | null> => {
    setIsExtracting(true);
    setExtractionError(null);
    setExtractedData(null);

    try {
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.functions.invoke("extract-sales-report", {
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
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}
