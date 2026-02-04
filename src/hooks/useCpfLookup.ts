import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FreelancerLookupResult {
  nome_completo: string;
  funcao: string;
  gerencia: string;
  chave_pix: string;
}

interface SupplierLookupResult {
  fornecedor: string;
  chave_pix: string | null;
}

export function useCpfLookup() {
  const [isLookingUp, setIsLookingUp] = useState(false);

  const lookupFreelancerByCpf = useCallback(async (cpf: string): Promise<FreelancerLookupResult | null> => {
    // Remove formatting for lookup
    const cleanCpf = cpf.replace(/\D/g, "");
    
    // Only lookup if we have 11 digits
    if (cleanCpf.length !== 11) {
      return null;
    }

    setIsLookingUp(true);
    try {
      // Query for the most recent entry with this CPF
      const { data, error } = await supabase
        .from("freelancer_entries")
        .select("nome_completo, funcao, gerencia, chave_pix, created_at")
        .eq("cpf", cpf)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error looking up CPF:", error);
        return null;
      }

      if (data) {
        toast.success("Dados recuperados automaticamente para este CPF.", {
          duration: 3000,
        });
        return {
          nome_completo: data.nome_completo,
          funcao: data.funcao,
          gerencia: data.gerencia,
          chave_pix: data.chave_pix,
        };
      }

      return null;
    } catch (error) {
      console.error("Error in CPF lookup:", error);
      return null;
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const lookupSupplierByCpfCnpj = useCallback(async (cpfCnpj: string): Promise<SupplierLookupResult | null> => {
    // Remove formatting for lookup
    const cleanValue = cpfCnpj.replace(/\D/g, "");
    
    // Only lookup if we have enough digits (11 for CPF, 14 for CNPJ)
    if (cleanValue.length !== 11 && cleanValue.length !== 14) {
      return null;
    }

    setIsLookingUp(true);
    try {
      // Query for the most recent entry with this CPF/CNPJ
      const { data, error } = await supabase
        .from("maintenance_entries")
        .select("fornecedor, chave_pix, created_at")
        .eq("cpf_cnpj", cpfCnpj)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error looking up supplier:", error);
        return null;
      }

      if (data) {
        toast.success("Dados do fornecedor recuperados automaticamente.", {
          duration: 3000,
        });
        return {
          fornecedor: data.fornecedor,
          chave_pix: data.chave_pix,
        };
      }

      return null;
    } catch (error) {
      console.error("Error in supplier lookup:", error);
      return null;
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  return {
    isLookingUp,
    lookupFreelancerByCpf,
    lookupSupplierByCpfCnpj,
  };
}
