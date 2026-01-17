import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FreelancerLookupResult {
  nome_completo: string;
  funcao: string;
  chave_pix: string;
}

interface SupplierLookupResult {
  fornecedor: string;
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
        .select("nome_completo, funcao, chave_pix, created_at")
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
    if (cleanValue.length < 11) {
      return null;
    }

    setIsLookingUp(true);
    try {
      // Query for the most recent entry with this supplier (using numero_nf as a proxy since we don't have CPF/CNPJ in maintenance)
      // Actually, let's search by fornecedor name containing the CPF/CNPJ or by the numero_nf
      const { data, error } = await supabase
        .from("maintenance_entries")
        .select("fornecedor, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error looking up supplier:", error);
        return null;
      }

      // The maintenance table doesn't have CPF/CNPJ field, so this lookup 
      // won't work unless we add that field. For now, return null.
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
