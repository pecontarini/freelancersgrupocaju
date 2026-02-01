import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ExtractedNFeItem {
  nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  unidade?: string;
}

export interface ExtractedNFeData {
  numero_nf?: string | null;
  data_emissao?: string | null;
  fornecedor?: string | null;
  cnpj_fornecedor?: string | null;
  items: ExtractedNFeItem[];
  valor_total_nota?: number | null;
  confidence: "high" | "medium" | "low";
}

export function useNFeExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedNFeData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const extractFromFile = async (file: File): Promise<ExtractedNFeData | null> => {
    setIsExtracting(true);
    setExtractionError(null);
    setExtractedData(null);

    try {
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.functions.invoke("extract-nfe-data", {
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
