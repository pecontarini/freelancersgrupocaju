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

interface UnifiedLookupResult {
  nome_completo: string;
  funcao?: string;
  gerencia?: string;
  chave_pix?: string;
  telefone?: string;
  tipo_chave_pix?: string;
  foto_url?: string;
  source: "freelancer_profiles" | "employees" | "freelancer_entries";
  found_in: string[];
}

/**
 * Motor único de lookup de freelancer por CPF.
 * Usa o RPC `lookup_freelancer_unified` que normaliza CPF (com ou sem máscara)
 * em todas as 3 fontes: cadastro central, escala (employees) e histórico de budget.
 */
export function useCpfLookup() {
  const [isLookingUp, setIsLookingUp] = useState(false);

  const lookupUnifiedByCpf = useCallback(
    async (cpf: string): Promise<UnifiedLookupResult | null> => {
      const cleanCpf = cpf.replace(/\D/g, "");
      if (cleanCpf.length !== 11) return null;

      setIsLookingUp(true);
      try {
        const { data, error } = await supabase.rpc("lookup_freelancer_unified", {
          p_cpf: cleanCpf,
        });

        if (error) {
          console.error("Error in unified CPF lookup RPC:", error);
          return null;
        }

        if (!data || data.length === 0) return null;

        const row = data[0] as {
          nome_completo: string;
          funcao: string | null;
          gerencia: string | null;
          chave_pix: string | null;
          tipo_chave_pix: string | null;
          telefone: string | null;
          foto_url: string | null;
          found_in: string[] | null;
        };

        const foundIn = row.found_in ?? [];
        // Origem mais informativa para o toast
        const primarySource: UnifiedLookupResult["source"] = foundIn.includes(
          "freelancer_profiles"
        )
          ? "freelancer_profiles"
          : foundIn.includes("employees")
            ? "employees"
            : "freelancer_entries";

        const sourceLabel =
          primarySource === "freelancer_profiles"
            ? "cadastro central"
            : primarySource === "employees"
              ? "escala de freelancers"
              : "histórico de budget";

        toast.success(`Dados recuperados do ${sourceLabel}.`, { duration: 3000 });

        return {
          nome_completo: row.nome_completo,
          funcao: row.funcao ?? undefined,
          gerencia: row.gerencia ?? undefined,
          chave_pix: row.chave_pix ?? undefined,
          tipo_chave_pix: row.tipo_chave_pix ?? undefined,
          telefone: row.telefone ?? undefined,
          foto_url: row.foto_url ?? undefined,
          source: primarySource,
          found_in: foundIn,
        };
      } catch (error) {
        console.error("Error in unified CPF lookup:", error);
        return null;
      } finally {
        setIsLookingUp(false);
      }
    },
    []
  );

  /**
   * Wrapper legacy: mantém a API antiga para consumidores que ainda chamam
   * `lookupFreelancerByCpf`. Internamente delega ao motor unificado.
   */
  const lookupFreelancerByCpf = useCallback(
    async (cpf: string): Promise<FreelancerLookupResult | null> => {
      const unified = await lookupUnifiedByCpf(cpf);
      if (!unified) return null;
      return {
        nome_completo: unified.nome_completo,
        funcao: unified.funcao ?? "",
        gerencia: unified.gerencia ?? "",
        chave_pix: unified.chave_pix ?? "",
      };
    },
    [lookupUnifiedByCpf]
  );

  const lookupSupplierByCpfCnpj = useCallback(
    async (cpfCnpj: string): Promise<SupplierLookupResult | null> => {
      const cleanValue = cpfCnpj.replace(/\D/g, "");
      if (cleanValue.length !== 11 && cleanValue.length !== 14) return null;

      setIsLookingUp(true);
      try {
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
          return { fornecedor: data.fornecedor, chave_pix: data.chave_pix };
        }
        return null;
      } catch (error) {
        console.error("Error in supplier lookup:", error);
        return null;
      } finally {
        setIsLookingUp(false);
      }
    },
    []
  );

  return {
    isLookingUp,
    lookupFreelancerByCpf,
    lookupUnifiedByCpf,
    lookupSupplierByCpfCnpj,
  };
}
