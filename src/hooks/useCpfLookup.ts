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
  source: "freelancer_profiles" | "employees" | "freelancer_entries";
}

export function useCpfLookup() {
  const [isLookingUp, setIsLookingUp] = useState(false);

  const lookupFreelancerByCpf = useCallback(async (cpf: string): Promise<FreelancerLookupResult | null> => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) return null;

    setIsLookingUp(true);
    try {
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
        toast.success("Dados recuperados automaticamente para este CPF.", { duration: 3000 });
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

  const lookupUnifiedByCpf = useCallback(async (cpf: string): Promise<UnifiedLookupResult | null> => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) return null;

    setIsLookingUp(true);
    try {
      // 1. freelancer_profiles (most complete — has photo, phone, PIX)
      const { data: profile } = await supabase
        .from("freelancer_profiles")
        .select("nome_completo, telefone, tipo_chave_pix, chave_pix")
        .eq("cpf", cleanCpf)
        .maybeSingle();

      if (profile) {
        toast.success("Dados recuperados do cadastro de freelancer.", { duration: 3000 });
        return {
          nome_completo: profile.nome_completo,
          chave_pix: profile.chave_pix ?? undefined,
          telefone: profile.telefone ?? undefined,
          tipo_chave_pix: profile.tipo_chave_pix ?? undefined,
          source: "freelancer_profiles",
        };
      }

      // 2. employees (scheduling freelancers) — search both clean and formatted CPF
      const { data: employee } = await supabase
        .from("employees")
        .select("name, phone")
        .eq("worker_type", "freelancer")
        .eq("cpf", cleanCpf)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      if (employee) {
        toast.success("Dados recuperados da escala de freelancers.", { duration: 3000 });
        return {
          nome_completo: employee.name,
          telefone: employee.phone ?? undefined,
          source: "employees",
        };
      }

      // 3. freelancer_entries (budget history) — uses formatted CPF
      const { data: entry } = await supabase
        .from("freelancer_entries")
        .select("nome_completo, funcao, gerencia, chave_pix, created_at")
        .eq("cpf", cpf)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (entry) {
        toast.success("Dados recuperados do histórico de budget.", { duration: 3000 });
        return {
          nome_completo: entry.nome_completo,
          funcao: entry.funcao,
          gerencia: entry.gerencia,
          chave_pix: entry.chave_pix,
          source: "freelancer_entries",
        };
      }

      return null;
    } catch (error) {
      console.error("Error in unified CPF lookup:", error);
      return null;
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const lookupSupplierByCpfCnpj = useCallback(async (cpfCnpj: string): Promise<SupplierLookupResult | null> => {
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
        toast.success("Dados do fornecedor recuperados automaticamente.", { duration: 3000 });
        return { fornecedor: data.fornecedor, chave_pix: data.chave_pix };
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
    lookupUnifiedByCpf,
    lookupSupplierByCpfCnpj,
  };
}
